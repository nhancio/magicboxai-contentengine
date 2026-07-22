import { BaseProvider } from "./base";
import {
  BadBodyError,
  NotEnoughScopesError,
  type AuthUrlInput,
  type ConnectedProfile,
  type ExchangeInput,
  type ProviderToken,
  type PublishInput,
  type PublishResult,
  type SocialProvider,
} from "./types";

/**
 * Instagram — Instagram API with Instagram Login (Business Login for Instagram).
 *
 * Meta's newer apps (and the "API setup with Instagram login" product) reject
 * the old Facebook-Login scopes (`instagram_basic`, `instagram_content_publish`,
 * `pages_*`). This provider uses:
 *   - Authorize: www.instagram.com/oauth/authorize
 *   - Tokens:    api.instagram.com + graph.instagram.com
 *   - Publish:   graph.instagram.com
 *
 * No Facebook Page is required. Credentials are the Instagram App ID/Secret
 * from App Dashboard → Instagram → API setup with Instagram login
 * (not the Facebook App ID used by the Facebook Page provider).
 */
const GRAPH = "https://graph.instagram.com/v21.0";

/** Container polling: 20 attempts x 6s == ~2 min ceiling. */
const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 6000;

class InstagramProvider extends BaseProvider implements SocialProvider {
  readonly id = "instagram" as const;
  readonly displayName = "Instagram";

  readonly scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
  ];

  readonly credentialEnv = {
    clientId: "META_IG_APP_ID",
    clientSecret: "META_IG_APP_SECRET",
  };

  readonly limits = {
    maxCaptionLength: 2200,
    maxImages: 1,
    maxVideos: 1,
    requiresMedia: true,
  };

  buildAuthUrl(i: AuthUrlInput): string {
    const params = new URLSearchParams({
      client_id: i.clientId,
      redirect_uri: i.redirectUri,
      state: i.state,
      response_type: "code",
      scope: this.scopes.join(","),
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(i: ExchangeInput): Promise<ConnectedProfile[]> {
    // 1) code -> short-lived Instagram User token (+ Instagram-scoped user id)
    const shortBody = new URLSearchParams({
      client_id: i.clientId,
      client_secret: i.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: i.redirectUri,
      code: i.code,
    });
    const short = await this.http("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: shortBody,
    });

    // Response shape: { access_token, user_id, permissions? } or { data: [{...}] }
    const shortToken: string | undefined =
      short.access_token ?? short.data?.[0]?.access_token;
    const scopedUserId: string | undefined = String(
      short.user_id ?? short.data?.[0]?.user_id ?? "",
    );
    if (!shortToken) throw new BadBodyError("instagram token exchange returned no access_token");

    // 2) short-lived (~1h) -> long-lived (~60d)
    const long = await this.http(
      `https://graph.instagram.com/access_token?` +
        new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_secret: i.clientSecret,
          access_token: shortToken,
        }).toString(),
    );
    const accessToken: string = long.access_token ?? shortToken;

    // 3) profile for display — user_id from /me is the IG id used for publish
    const me = await this.http(
      `${GRAPH}/me?` +
        new URLSearchParams({
          fields: "user_id,username,name,account_type,profile_picture_url",
          access_token: accessToken,
        }).toString(),
    );

    const igUserId = String(me.user_id ?? scopedUserId);
    if (!igUserId) {
      throw new BadBodyError(
        "no_ig_user: Instagram Login returned no user id — use a Business or Creator account",
      );
    }

    return [
      {
        externalId: igUserId,
        username: me.username ?? igUserId,
        displayName: me.name ?? me.username ?? igUserId,
        avatarUrl: me.profile_picture_url,
        token: {
          // Instagram User token publishes directly — no Page token needed.
          accessToken,
          expiresAt: long.expires_in ? Date.now() + long.expires_in * 1000 : undefined,
          igUserId,
          scopes: this.scopes,
        },
      },
    ];
  }

  async refresh(t: ProviderToken, _clientId: string, _clientSecret: string): Promise<ProviderToken> {
    // Long-lived IG tokens can be refreshed while still valid (and >24h old).
    const refreshed = await this.http(
      `https://graph.instagram.com/refresh_access_token?` +
        new URLSearchParams({
          grant_type: "ig_refresh_token",
          access_token: t.accessToken,
        }).toString(),
    );
    if (!refreshed.access_token) {
      throw new NotEnoughScopesError(
        "instagram token refresh failed; user must reconnect",
      );
    }
    return {
      ...t,
      accessToken: refreshed.access_token,
      expiresAt: refreshed.expires_in
        ? Date.now() + refreshed.expires_in * 1000
        : t.expiresAt,
    };
  }

  async publish(t: ProviderToken, input: PublishInput): Promise<PublishResult> {
    this.validate(this, input);

    const igUserId = t.igUserId;
    if (!igUserId) throw new BadBodyError("Instagram account missing igUserId");

    const media = input.media[0];
    if (!media) throw new BadBodyError("Instagram requires an image or video");

    // Meta crawls image_url / video_url from its servers — private or
    // bot-blocked hosts return container ERROR / "Media ID is not available".
    if (!/^https:\/\//i.test(media.url)) {
      throw new BadBodyError("Instagram media URL must be a public https link");
    }

    const caption = this.composeText(input);

    const containerParams = new URLSearchParams({ caption, access_token: t.accessToken });
    if (media.type === "video") {
      containerParams.set("media_type", "REELS");
      containerParams.set("video_url", media.url);
    } else {
      containerParams.set("image_url", media.url);
    }
    const created = await this.http(`${GRAPH}/${igUserId}/media`, {
      method: "POST",
      body: containerParams,
    });
    const creationId: string | undefined = created.id;
    if (!creationId) throw new BadBodyError("IG container returned no creation id");

    // Images AND videos must reach FINISHED before media_publish — publishing
    // early is the usual cause of OAuthException 9007 "Media ID is not available".
    await this.waitForContainer(creationId, t.accessToken);

    let published: { id?: string };
    try {
      published = await this.http(`${GRAPH}/${igUserId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: creationId, access_token: t.accessToken }),
        retries: 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Media ID is not available|9007|2207027/i.test(msg)) {
        throw new BadBodyError(
          "Instagram could not fetch the media URL (must be public https). Re-upload the image/video in Studio and try again.",
        );
      }
      throw e;
    }
    const mediaId: string | undefined = published.id;
    if (!mediaId) throw new BadBodyError("IG publish returned no media id");

    let permalink: string | undefined;
    try {
      const link = await this.http(
        `${GRAPH}/${mediaId}?` +
          new URLSearchParams({ fields: "permalink", access_token: t.accessToken }).toString(),
        { retries: 0 },
      );
      permalink = link.permalink;
    } catch {
      /* non-fatal */
    }

    return { externalId: mediaId, ...(permalink ? { permalink } : {}) };
  }

  private async waitForContainer(creationId: string, accessToken: string): Promise<void> {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const status = await this.http(
        `${GRAPH}/${creationId}?` +
          new URLSearchParams({
            fields: "status_code,status",
            access_token: accessToken,
          }).toString(),
      );
      if (status.status_code === "FINISHED") return;
      if (status.status_code === "ERROR") {
        const detail =
          typeof status.status === "string" && status.status
            ? `: ${status.status.slice(0, 180)}`
            : "";
        throw new BadBodyError(
          `Instagram media processing failed${detail}. Use a public https image/video URL (Studio upload), not a private or hotlink-blocked host.`,
        );
      }
    }
    throw new BadBodyError("Instagram media processing timed out — try again in a minute");
  }
}

export const instagram = new InstagramProvider();
