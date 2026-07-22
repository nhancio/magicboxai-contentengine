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
 * Pinned Graph version: Meta ships breaking changes per version and auto-upgrades
 * unversioned calls. v21.0 is what the production Firebase publisher runs on.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Facebook Pages as a publish destination.
 *
 * WHY this is separate from the Instagram provider despite sharing Meta's OAuth:
 * Instagram treats the Page as a *carrier* for a linked IG business account and
 * discards Pages that lack one. Here the Page IS the destination, so we keep every
 * Page the user manages. Same authorization dance, different notion of "account".
 */
class FacebookProvider extends BaseProvider implements SocialProvider {
  readonly id = "facebook" as const;
  readonly displayName = "Facebook";
  readonly scopes = [
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_show_list",
    "business_management",
  ];
  readonly credentialEnv = {
    clientId: "META_APP_ID",
    clientSecret: "META_APP_SECRET",
  };
  readonly limits = {
    maxCaptionLength: 63206,
    maxImages: 1,
    maxVideos: 1,
    // Unlike Instagram, a Page post can be pure text.
    requiresMedia: false,
  };

  buildAuthUrl(input: AuthUrlInput): string {
    const params = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      state: input.state,
      response_type: "code",
      // Meta wants scopes comma-separated, not the OAuth2-usual space.
      scope: this.scopes.join(","),
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  async exchangeCode(input: ExchangeInput): Promise<ConnectedProfile[]> {
    // 1) code -> short-lived user token (~1h)
    const short = await this.http(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          redirect_uri: input.redirectUri,
          code: input.code,
        }).toString(),
    );

    // 2) short-lived -> long-lived user token (~60d). Required: Page tokens
    // inherit the lifetime of the user token they were minted from, so deriving
    // them from the short-lived one would give us Page tokens dead within the hour.
    const long = await this.http(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: input.clientId,
          client_secret: input.clientSecret,
          fb_exchange_token: short.access_token,
        }).toString(),
    );

    // 3) every Page this user administers. No instagram_business_account filter —
    // a Page without a linked IG account is still a perfectly valid FB destination.
    const pages = await this.http(
      `${GRAPH}/me/accounts?` +
        new URLSearchParams({
          fields: "id,name,access_token,picture{url}",
          access_token: long.access_token,
        }).toString(),
    );

    const data: Array<{
      id: string;
      name: string;
      access_token: string;
      picture?: { data?: { url?: string } };
    }> = pages.data ?? [];

    const usable = data.filter((p) => p.id && p.access_token);
    if (usable.length === 0) {
      throw new BadBodyError(
        "no_facebook_pages: you must be an admin of at least one Facebook Page to connect Facebook",
      );
    }

    return usable.map((page) => ({
      externalId: page.id,
      username: page.name,
      displayName: page.name,
      avatarUrl: page.picture?.data?.url,
      token: {
        // The PAGE token publishes, not the user token — a user token gets
        // (#200) permission errors against /{page-id}/feed.
        accessToken: page.access_token,
        // Page tokens derived from a long-lived user token generally don't expire,
        // but we record the user token's horizon as an honest upper bound.
        ...(long.expires_in
          ? { expiresAt: Date.now() + Number(long.expires_in) * 1000 }
          : {}),
        pageId: page.id,
        scopes: this.scopes,
      },
    }));
  }

  async refresh(_token: ProviderToken, _clientId: string, _clientSecret: string): Promise<ProviderToken> {
    // Meta issues no refresh token for Page tokens; the only way back is a fresh
    // authorization. Surfacing this as a scope error makes the engine force a
    // reconnect instead of burning retries on an unrefreshable credential.
    throw new NotEnoughScopesError(
      "Facebook Page tokens cannot be refreshed — reconnect the account",
    );
  }

  async publish(token: ProviderToken, input: PublishInput): Promise<PublishResult> {
    this.validate(this, input);

    const pageId = token.pageId;
    if (!pageId) throw new BadBodyError("Facebook account missing pageId");

    const message = this.composeText(input);
    const image = input.media.find((m) => m.type === "image");
    const video = input.media.find((m) => m.type === "video");

    // A photo and a video can't ride in one Page post: /photos and /videos are
    // distinct endpoints. Fail loudly rather than silently dropping the user's media.
    if (image && video) {
      throw new BadBodyError(
        "Facebook cannot post an image and a video in the same post; send them separately",
      );
    }

    let endpoint: string;
    const body = new URLSearchParams({ access_token: token.accessToken });

    if (video) {
      endpoint = `${GRAPH}/${pageId}/videos`;
      // file_url makes Meta pull the asset itself — no multipart upload, and it
      // returns once ingested, so there's no container to poll like Instagram's.
      body.set("file_url", video.url);
      body.set("description", message);
    } else if (image) {
      endpoint = `${GRAPH}/${pageId}/photos`;
      body.set("url", image.url);
      body.set("caption", message);
    } else {
      endpoint = `${GRAPH}/${pageId}/feed`;
      body.set("message", message);
    }

    const res: { id?: string; post_id?: string } = await this.http(endpoint, {
      method: "POST",
      body,
    });

    // /photos returns the photo id in `id` and the feed story in `post_id`;
    // /feed and /videos return only `id`. Prefer post_id: it's the story users
    // actually see and what engagement lookups key on.
    const externalId = res.post_id ?? res.id;
    if (!externalId) {
      throw new BadBodyError(`Facebook publish returned no id: ${JSON.stringify(res)}`);
    }

    return {
      externalId,
      permalink: `https://facebook.com/${externalId}`,
    };
  }
}

export const facebook = new FacebookProvider();
