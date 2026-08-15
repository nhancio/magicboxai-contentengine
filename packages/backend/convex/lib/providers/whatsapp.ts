import { BaseProvider } from "./base";
import {
  BadBodyError,
  NotEnoughScopesError,
  type AuthUrlInput,
  type ConnectedProfile,
  type ExchangeInput,
  type PostFormat,
  type ProviderToken,
  type PublishInput,
  type PublishResult,
  type SocialProvider,
} from "./types";

/**
 * Pinned Graph version — match Facebook Pages provider.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * WhatsApp Cloud API via the same Meta app as Facebook Pages (`META_APP_ID`).
 *
 * WHY separate from `facebook.ts`: a Facebook Page and a WhatsApp phone number
 * are different destinations with different publish contracts (feed post vs
 * A2P message-to-recipient). Same OAuth host + credentials, different scopes
 * and discovery.
 *
 * Connect discovers WABA phone numbers the user can manage. Publish sends to
 * opted-in E.164 recipients via `options.recipients` / `options.to` (required).
 * Outside the 24h service window, Meta only accepts approved templates —
 * pass `options.templateName` (+ optional `templateLanguage`) for those sends.
 */
class WhatsAppProvider extends BaseProvider implements SocialProvider {
  readonly id = "whatsapp" as const;
  readonly displayName = "WhatsApp";
  readonly scopes = [
    "whatsapp_business_management",
    "whatsapp_business_messaging",
    "business_management",
  ];
  readonly credentialEnv = {
    clientId: "META_APP_ID",
    clientSecret: "META_APP_SECRET",
  };
  readonly limits = {
    maxCaptionLength: 4096,
    maxImages: 1,
    maxVideos: 1,
    requiresMedia: false,
    supportedFormats: ["image", "video", "post"] as PostFormat[],
  };

  buildAuthUrl(input: AuthUrlInput): string {
    const params = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      state: input.state,
      response_type: "code",
      scope: this.scopes.join(","),
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  async exchangeCode(input: ExchangeInput): Promise<ConnectedProfile[]> {
    const short = await this.http(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          redirect_uri: input.redirectUri,
          code: input.code,
        }).toString(),
    );

    const long = await this.http(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: input.clientId,
          client_secret: input.clientSecret,
          fb_exchange_token: short.access_token,
        }).toString(),
    );

    const userToken: string = long.access_token;
    const phones = await this.discoverPhoneNumbers(userToken);

    if (phones.length === 0) {
      throw new BadBodyError(
        "no_whatsapp_numbers: create a WhatsApp Business Account + phone number " +
          "in Meta Business Suite (WhatsApp Manager), grant this app access, then reconnect",
      );
    }

    return phones.map((phone) => ({
      externalId: phone.phoneNumberId,
      username: phone.displayPhoneNumber,
      displayName: phone.verifiedName || phone.displayPhoneNumber,
      token: {
        accessToken: userToken,
        ...(long.expires_in
          ? { expiresAt: Date.now() + Number(long.expires_in) * 1000 }
          : {}),
        phoneNumberId: phone.phoneNumberId,
        wabaId: phone.wabaId,
        scopes: this.scopes,
      },
    }));
  }

  /**
   * Walk businesses → owned / client WABAs → phone numbers.
   * Some portfolios only expose assigned WABAs on the user node.
   */
  private async discoverPhoneNumbers(userToken: string): Promise<
    Array<{
      phoneNumberId: string;
      displayPhoneNumber: string;
      verifiedName?: string;
      wabaId: string;
    }>
  > {
    const found: Array<{
      phoneNumberId: string;
      displayPhoneNumber: string;
      verifiedName?: string;
      wabaId: string;
    }> = [];
    const seen = new Set<string>();

    const pushPhones = (
      wabaId: string,
      numbers: Array<{
        id?: string;
        display_phone_number?: string;
        verified_name?: string;
      }>,
    ) => {
      for (const n of numbers) {
        if (!n.id || !n.display_phone_number || seen.has(n.id)) continue;
        seen.add(n.id);
        found.push({
          phoneNumberId: n.id,
          displayPhoneNumber: n.display_phone_number,
          verifiedName: n.verified_name,
          wabaId,
        });
      }
    };

    const wabaFields =
      "id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}";

    // 1) Businesses the user administers → owned + client WABAs
    try {
      const businesses = await this.http(
        `${GRAPH}/me/businesses?` +
          new URLSearchParams({
            fields: [
              "id",
              "name",
              `owned_whatsapp_business_accounts{${wabaFields}}`,
              `client_whatsapp_business_accounts{${wabaFields}}`,
            ].join(","),
            access_token: userToken,
          }).toString(),
      );

      for (const biz of businesses.data ?? []) {
        for (const waba of biz.owned_whatsapp_business_accounts?.data ?? []) {
          pushPhones(waba.id, waba.phone_numbers?.data ?? []);
        }
        for (const waba of biz.client_whatsapp_business_accounts?.data ?? []) {
          pushPhones(waba.id, waba.phone_numbers?.data ?? []);
        }
      }
    } catch {
      // Fall through to assigned WABAs — some roles can't list /me/businesses.
    }

    // 2) WABAs assigned directly to the user
    if (found.length === 0) {
      try {
        const assigned = await this.http(
          `${GRAPH}/me/assigned_whatsapp_business_accounts?` +
            new URLSearchParams({
              fields: wabaFields,
              access_token: userToken,
            }).toString(),
        );
        for (const waba of assigned.data ?? []) {
          pushPhones(waba.id, waba.phone_numbers?.data ?? []);
        }
      } catch {
        // No assigned WABAs either.
      }
    }

    return found;
  }

  async refresh(
    _token: ProviderToken,
    _clientId: string,
    _clientSecret: string,
  ): Promise<ProviderToken> {
    throw new NotEnoughScopesError(
      "WhatsApp user tokens cannot be refreshed — reconnect the account",
    );
  }

  async publish(token: ProviderToken, input: PublishInput): Promise<PublishResult> {
    this.validate(this, input);

    const phoneNumberId = token.phoneNumberId;
    if (!phoneNumberId) {
      throw new BadBodyError("WhatsApp account missing phoneNumberId — reconnect");
    }

    const recipients = this.resolveRecipients(input);
    if (recipients.length === 0) {
      throw new BadBodyError(
        "WhatsApp needs at least one opted-in recipient. Set content.perPlatform.whatsapp.recipients " +
          "(E.164 numbers, e.g. [\"9198xxxxxxxx\"]) or options.recipients / options.to",
      );
    }

    const caption = this.composeText(input);
    const image = input.media.find((m) => m.type === "image");
    const video = input.media.find((m) => m.type === "video");
    if (image && video) {
      throw new BadBodyError(
        "WhatsApp cannot send an image and a video in the same message; send them separately",
      );
    }

    const templateName =
      typeof input.options?.templateName === "string"
        ? input.options.templateName.trim()
        : "";
    const templateLanguage =
      typeof input.options?.templateLanguage === "string"
        ? input.options.templateLanguage.trim()
        : "en";

    const results: string[] = [];
    for (const to of recipients) {
      if (token.accessToken?.startsWith("sandbox_") || phoneNumberId.startsWith("sandbox_")) {
        // Virtual Sandbox Simulator: simulate instantaneous Meta Cloud API delivery
        const simulatedMid = `wamid.HBgTestSimulator_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        results.push(simulatedMid);
        continue;
      }

      const body = templateName
        ? this.buildTemplateBody({
            to,
            templateName,
            templateLanguage,
            caption,
            imageUrl: image?.url,
            videoUrl: video?.url,
          })
        : this.buildSessionBody({
            to,
            caption,
            imageUrl: image?.url,
            videoUrl: video?.url,
          });

      const res: { messages?: Array<{ id?: string }>; error?: { message?: string } } =
        await this.http(`${GRAPH}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

      const mid = res.messages?.[0]?.id;
      if (!mid) {
        throw new BadBodyError(
          `WhatsApp send returned no message id: ${JSON.stringify(res).slice(0, 300)}`,
        );
      }
      results.push(mid);
    }

    const externalId = results[0]!;
    return {
      externalId: results.length > 1 ? results.join(",") : externalId,
      // No public permalink for 1:1 chats; deep-link to wa.me for the first recipient.
      permalink: `https://wa.me/${recipients[0]}`,
    };
  }

  private resolveRecipients(input: PublishInput): string[] {
    const opts = input.options ?? {};
    const raw: unknown[] = [];

    if (Array.isArray(opts.recipients)) raw.push(...opts.recipients);
    if (typeof opts.to === "string") raw.push(opts.to);
    if (Array.isArray(opts.to)) raw.push(...opts.to);

    const cleaned = raw
      .map((n) => String(n).replace(/[^\d]/g, ""))
      .filter((n) => n.length >= 8 && n.length <= 15);

    return [...new Set(cleaned)];
  }

  private buildSessionBody(args: {
    to: string;
    caption: string;
    imageUrl?: string;
    videoUrl?: string;
  }): Record<string, unknown> {
    const base = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: args.to,
    };

    if (args.videoUrl) {
      return {
        ...base,
        type: "video",
        video: {
          link: args.videoUrl,
          ...(args.caption ? { caption: args.caption.slice(0, 1024) } : {}),
        },
      };
    }
    if (args.imageUrl) {
      return {
        ...base,
        type: "image",
        image: {
          link: args.imageUrl,
          ...(args.caption ? { caption: args.caption.slice(0, 1024) } : {}),
        },
      };
    }
    if (!args.caption.trim()) {
      throw new BadBodyError("WhatsApp text messages need a caption");
    }
    return {
      ...base,
      type: "text",
      text: { preview_url: true, body: args.caption },
    };
  }

  private buildTemplateBody(args: {
    to: string;
    templateName: string;
    templateLanguage: string;
    caption: string;
    imageUrl?: string;
    videoUrl?: string;
  }): Record<string, unknown> {
    const components: Array<Record<string, unknown>> = [];

    if (args.imageUrl || args.videoUrl) {
      components.push({
        type: "header",
        parameters: [
          args.videoUrl
            ? { type: "video", video: { link: args.videoUrl } }
            : { type: "image", image: { link: args.imageUrl } },
        ],
      });
    }

    if (args.caption.trim()) {
      components.push({
        type: "body",
        parameters: [{ type: "text", text: args.caption.slice(0, 1024) }],
      });
    }

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: args.to,
      type: "template",
      template: {
        name: args.templateName,
        language: { code: args.templateLanguage },
        ...(components.length ? { components } : {}),
      },
    };
  }
}

export const whatsapp = new WhatsAppProvider();
