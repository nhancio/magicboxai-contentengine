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
 * Instagram — Instagram API with Instagram Login (Business Login for Instagram).
 *
 * Meta's newer apps (and the "API setup with Instagram login" product) reject
 * the old Facebook-Login scopes (`instagram_basic`, `instagram_content_publish`,
 * `pages_*`). This provider uses:
 *   - Authorize: www.instagram.com/oauth/authorize  (Business Login — required)
 *   - Tokens:    api.instagram.com + graph.instagram.com (unversioned exchange)
 *   - Publish:   graph.instagram.com/v21.0
 *
 * No Facebook Page is required. Credentials are the Instagram App ID/Secret
 * from App Dashboard → Instagram → API setup with Instagram login
 * (not the Facebook App ID used by the Facebook Page provider).
 */
const GRAPH = "https://graph.instagram.com/v21.0";
/** Token exchange/refresh — Meta docs use the unversioned host. */
const GRAPH_TOKEN = "https://graph.instagram.com";

/** Container polling: 20 attempts x 6s == ~2 min ceiling. */
const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 6000;

class InstagramProvider extends BaseProvider implements SocialProvider {
  readonly id = "instagram" as const;
  readonly displayName = "Instagram";

  readonly scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    // Stats / insights (Instagram Login). Matches Meta Business login embed scopes
    // for analytics; messaging/comments stay optional and are not requested here.
    "instagram_business_manage_insights",
  ];

  readonly credentialEnv = {
    clientId: "META_IG_APP_ID",
    clientSecret: "META_IG_APP_SECRET",
  };

  readonly limits = {
    maxCaptionLength: 2200,
    // Instagram carousel containers accept 2–10 child images/videos.
    maxImages: 10,
    maxVideos: 1,
    requiresMedia: true,
    supportedFormats: ["image", "carousel", "reel", "post"] as PostFormat[],
  };

  buildAuthUrl(i: AuthUrlInput): string {
    const params = new URLSearchParams({
      client_id: i.clientId,
      redirect_uri: i.redirectUri,
      response_type: "code",
      scope: this.scopes.join(","),
      state: i.state,
    });
    // Meta Business Login requires www.instagram.com (not api.instagram.com).
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(i: ExchangeInput): Promise<ConnectedProfile[]> {
    // 1) code -> short-lived Instagram User token (+ Instagram-scoped user id)
    const shortBody = new URLSearchParams({
      client_id: i.clientId,
      client_secret: i.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: i.redirectUri,
      code: i.code.replace(/#_$/, ""),
    });

    let short: any;
    try {
      short = await this.http("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: shortBody.toString(),
      });
    } catch (e) {
      throw this.wrapStep("short-lived token", e);
    }

    // Response shape: { access_token, user_id, permissions? } or { data: [{...}] }
    const shortToken: string | undefined =
      short.access_token ?? short.data?.[0]?.access_token;
    const scopedUserId: string | undefined = String(
      short.user_id ?? short.data?.[0]?.user_id ?? "",
    );
    if (!shortToken) throw new BadBodyError("instagram token exchange returned no access_token");

    // 2) short-lived (~1h) -> long-lived (~60d)
    // Meta docs say GET; some apps need POST. Both can return the misleading
    // IGApiException "method type: get|post" when the IG user isn't a Tester /
    // Advanced Access isn't granted — in that case keep the short-lived token
    // so Connect still succeeds (token lasts ~1h until Meta access is fixed).
    let long: { access_token?: string; expires_in?: number } = {};
    try {
      long = await this.exchangeOrRefreshToken(`${GRAPH_TOKEN}/access_token`, {
        grant_type: "ig_exchange_token",
        client_secret: i.clientSecret,
        access_token: shortToken,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/method type:\s*(get|post)/i.test(msg) || /IGApiException/i.test(msg)) {
        console.warn(
          "[instagram] long-lived token blocked by Meta (tester/App Review?). Using 1h token.",
          msg.slice(0, 180),
        );
        long = {};
      } else {
        throw this.wrapStep("long-lived token", e);
      }
    }
    const accessToken: string = long.access_token ?? shortToken;
    const expiresAt = long.expires_in
      ? Date.now() + long.expires_in * 1000
      : Date.now() + 60 * 60 * 1000; // short-lived fallback ~1h


    // 3) profile for display — optional. Token exchange already returns user_id.
    // Meta often returns IGApiException "method type: get" on /me when the IG
    // account is not an App Tester / Business isn't verified — same wording as
    // a real HTTP-method bug. Never fail connect solely on profile fetch.
    const me = await this.fetchProfile(accessToken, scopedUserId);

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
          expiresAt,
          igUserId,
          scopes: this.scopes,
        },
      },
    ];
  }

  async refresh(t: ProviderToken, _clientId: string, _clientSecret: string): Promise<ProviderToken> {
    // Long-lived IG tokens can be refreshed while still valid (and >24h old).
    let refreshed: any;
    try {
      refreshed = await this.exchangeOrRefreshToken(
        `${GRAPH_TOKEN}/refresh_access_token`,
        {
          grant_type: "ig_refresh_token",
          access_token: t.accessToken,
        },
      );
    } catch (e) {
      throw this.wrapStep("refresh token", e);
    }
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

  private wrapStep(step: string, e: unknown): Error {
    const msg = e instanceof Error ? e.message : String(e);
    return new BadBodyError(`instagram ${step}: ${msg}`);
  }

  /**
   * Best-effort profile. Prefer /me, then /{id}. On Meta's misleading
   * "method type: get" access errors, return whatever id we already have.
   */
  private async fetchProfile(
    accessToken: string,
    scopedUserId: string,
  ): Promise<{
    user_id?: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
  }> {
    const fields = "id,user_id,username,name,profile_picture_url";
    const attempts: string[] = [
      `${GRAPH}/me?${new URLSearchParams({ fields, access_token: accessToken })}`,
      `${GRAPH_TOKEN}/me?${new URLSearchParams({ fields, access_token: accessToken })}`,
    ];
    if (scopedUserId) {
      attempts.push(
        `${GRAPH}/${scopedUserId}?${new URLSearchParams({
          fields: "id,username,name,profile_picture_url",
          access_token: accessToken,
        })}`,
        `${GRAPH_TOKEN}/${scopedUserId}?${new URLSearchParams({
          fields: "id,username,name,profile_picture_url",
          access_token: accessToken,
        })}`,
      );
    }

    for (const url of attempts) {
      try {
        const raw = await this.http(url, { method: "GET", retries: 0 });
        const me = raw.data?.[0] ?? raw;
        if (me && (me.user_id || me.id || me.username)) {
          return {
            user_id: me.user_id ? String(me.user_id) : me.id ? String(me.id) : scopedUserId || undefined,
            username: me.username,
            name: me.name,
            profile_picture_url: me.profile_picture_url,
          };
        }
      } catch {
        /* try next */
      }
    }

    return { user_id: scopedUserId || undefined };
  }

  /**
   * Long-lived token exchange + refresh.
   * Try POST (body), POST (query), then GET — Meta's required method varies by
   * app/account, and "method type: get|post" is also their catch-all for
   * missing Tester / Advanced Access.
   */
  private async exchangeOrRefreshToken(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    const attempts: Array<() => Promise<any>> = [
      () =>
        this.http(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: qs,
          retries: 0,
        }),
      () =>
        this.http(`${endpoint}?${qs}`, {
          method: "POST",
          retries: 0,
        }),
      () =>
        this.http(`${endpoint}?${qs}`, {
          method: "GET",
          retries: 0,
        }),
    ];

    let lastErr: unknown;
    for (const run of attempts) {
      try {
        return await run();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new BadBodyError(String(lastErr));
  }

  async publish(t: ProviderToken, input: PublishInput): Promise<PublishResult> {
    this.validate(this, input);

    const igUserId = t.igUserId;
    if (!igUserId) throw new BadBodyError("Instagram account missing igUserId");

    const images = input.media.filter((item) => item.type === "image");
    const videos = input.media.filter((item) => item.type === "video");
    if (images.length > 0 && videos.length > 0) {
      throw new BadBodyError("Mixed image/video Instagram carousels are not supported yet");
    }
    const media = input.media[0];
    if (!media) throw new BadBodyError("Instagram requires an image or video");

    // Meta crawls image_url / video_url from its servers — private or
    // bot-blocked hosts return container ERROR / "Media ID is not available".
    if (input.media.some((item) => !/^https:\/\//i.test(item.url))) {
      throw new BadBodyError("Instagram media URL must be a public https link");
    }

    const caption = this.composeText(input);
    let creationId: string | undefined = input.creationId;

    if (creationId) {
      try {
        const containerStatus = await this.checkContainerStatus(creationId, t.accessToken);
        if (containerStatus.status_code === "PUBLISHED") {
          let permalink: string | undefined;
          try {
            const link = await this.http(
              `${GRAPH}/${creationId}?` +
                new URLSearchParams({ fields: "permalink", access_token: t.accessToken }).toString(),
              { retries: 0 },
            );
            permalink = link.permalink;
          } catch {
            /* non-fatal */
          }
          return { externalId: creationId, permalink, creationId };
        } else if (
          containerStatus.status_code === "FINISHED" ||
          containerStatus.status_code === "IN_PROGRESS"
        ) {
          // Container exists and is valid
        } else {
          creationId = undefined;
        }
      } catch {
        creationId = undefined;
      }
    }

    if (!creationId) {
      if (images.length > 1) {
        const childIds: string[] = [];
        for (const image of images) {
          const child = await this.http(`${GRAPH}/${igUserId}/media`, {
            method: "POST",
            body: new URLSearchParams({
              image_url: image.url,
              is_carousel_item: "true",
              access_token: t.accessToken,
            }).toString(),
          });
          if (!child.id) {
            throw new BadBodyError("Instagram carousel child returned no creation id");
          }
          await this.waitForContainer(child.id, t.accessToken);
          childIds.push(child.id);
        }

        const parent = await this.http(`${GRAPH}/${igUserId}/media`, {
          method: "POST",
          body: new URLSearchParams({
            media_type: "CAROUSEL",
            children: childIds.join(","),
            caption,
            access_token: t.accessToken,
          }).toString(),
        });
        creationId = parent.id;
      } else {
        const containerParams = new URLSearchParams({ caption, access_token: t.accessToken });
        if (media.type === "video") {
          containerParams.set("media_type", "REELS");
          containerParams.set("video_url", media.url);
        } else {
          containerParams.set("image_url", media.url);
        }
        const created = await this.http(`${GRAPH}/${igUserId}/media`, {
          method: "POST",
          body: containerParams.toString(),
        });
        creationId = created.id;
      }
      if (!creationId) throw new BadBodyError("IG container returned no creation id");

      if (input.onCreationId) {
        try {
          await input.onCreationId(creationId);
        } catch {
          /* non-fatal persistence error */
        }
      }
    }

    // Images AND videos must reach FINISHED before media_publish — publishing
    // early is the usual cause of OAuthException 9007 "Media ID is not available".
    await this.waitForContainer(creationId, t.accessToken);

    let published: { id?: string };
    try {
      published = await this.http(`${GRAPH}/${igUserId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: creationId, access_token: t.accessToken }).toString(),
        retries: 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Media ID is not available|9007|2207027/i.test(msg)) {
        throw new BadBodyError(
          "Instagram could not fetch the media URL (must be public https). Re-upload the image/video in Studio and try again.",
        );
      }
      if (/already published|2207001|2207003/i.test(msg)) {
        let permalink: string | undefined;
        try {
          const link = await this.http(
            `${GRAPH}/${creationId}?` +
              new URLSearchParams({ fields: "permalink", access_token: t.accessToken }).toString(),
            { retries: 0 },
          );
          permalink = link.permalink;
        } catch {
          /* non-fatal */
        }
        return { externalId: creationId, permalink, creationId };
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

    return { externalId: mediaId, ...(permalink ? { permalink } : {}), creationId };
  }

  private async checkContainerStatus(
    creationId: string,
    accessToken: string,
  ): Promise<{ status_code?: string; status?: string }> {
    return await this.http(
      `${GRAPH}/${creationId}?` +
        new URLSearchParams({
          fields: "status_code,status",
          access_token: accessToken,
        }).toString(),
      { retries: 0 },
    );
  }

  private async waitForContainer(creationId: string, accessToken: string): Promise<void> {
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      const status = await this.http(
        `${GRAPH}/${creationId}?` +
          new URLSearchParams({
            fields: "status_code,status",
            access_token: accessToken,
          }).toString(),
      );
      if (status.status_code === "FINISHED" || status.status_code === "PUBLISHED") return;
      if (status.status_code === "ERROR") {
        const detail =
          typeof status.status === "string" && status.status
            ? `: ${status.status.slice(0, 180)}`
            : "";
        throw new BadBodyError(
          `Instagram media processing failed${detail}. Use a public https image/video URL (Studio upload), not a private or hotlink-blocked host.`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new BadBodyError("Instagram media processing timed out — try again in a minute");
  }

  async revoke(token: ProviderToken): Promise<void> {
    if (!token.accessToken) return;
    try {
      await this.http(
        `${GRAPH}/me/permissions?${new URLSearchParams({ access_token: token.accessToken }).toString()}`,
        {
          method: "DELETE",
          retries: 1,
        },
      );
    } catch (err) {
      console.warn("[instagram] revoke session error (ignored)", err);
    }
  }
}

export const instagram = new InstagramProvider();