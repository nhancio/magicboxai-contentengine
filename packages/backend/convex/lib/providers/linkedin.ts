import { BaseProvider } from "./base";
import {
  BadBodyError,
  NotEnoughScopesError,
  RefreshTokenError,
  RetryableError,
  type AuthUrlInput,
  type ConnectedProfile,
  type ExchangeInput,
  type ProviderToken,
  type PublishInput,
  type PublishResult,
  type SocialProvider,
} from "./types";

/**
 * LinkedIn pins every /rest/* call to a dated API version (YYYYMM). Omitting
 * the header is a 426; using a sunset version (e.g. 202401) is also a 426
 * NONEXISTENT_VERSION. Bump carefully and re-test Images + Posts payloads.
 * Active as of mid-2026: 202601+.
 */
const LINKEDIN_VERSION = "202601";

/** Sent on every /rest/* call alongside the version. */
const REST_HEADERS = {
  "LinkedIn-Version": LINKEDIN_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
};

type UserInfo = { sub: string; name?: string; picture?: string; email?: string };

class LinkedInProvider extends BaseProvider implements SocialProvider {
  readonly id = "linkedin" as const;
  readonly displayName = "LinkedIn";
  readonly scopes = ["openid", "profile", "w_member_social"];
  readonly credentialEnv = {
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
  };
  readonly limits = {
    maxCaptionLength: 3000,
    // LinkedIn's organic MultiImage API accepts 2–20 uploaded image URNs.
    maxImages: 20,
    maxVideos: 1,
    requiresMedia: false,
  };

  buildAuthUrl(i: AuthUrlInput): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: i.clientId,
      redirect_uri: i.redirectUri,
      state: i.state,
      scope: this.scopes.join(" "),
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async exchangeCode(i: ExchangeInput): Promise<ConnectedProfile[]> {
    const token = await this.http("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: i.code,
        redirect_uri: i.redirectUri,
        client_id: i.clientId,
        client_secret: i.clientSecret,
      }).toString(),
    });

    const info: UserInfo = await this.fetchUserInfo(token.access_token);

    return [
      {
        // The `urn:li:person:` URN is used verbatim as the post author, so the
        // prefix is part of the identity — not a display detail.
        externalId: `urn:li:person:${info.sub}`,
        username: info.name ?? info.email ?? "LinkedIn member",
        displayName: info.name ?? "LinkedIn member",
        avatarUrl: info.picture,
        token: {
          accessToken: token.access_token,
          expiresAt: token.expires_in
            ? Date.now() + token.expires_in * 1000
            : undefined,
          scopes: this.scopes,
        },
      },
    ];
  }

  /**
   * LinkedIn only issues refresh tokens under its paid "Marketing Developer
   * Platform" product. On the standard tier the 60-day access token simply dies
   * and the member must re-authorize, so a refresh is unrecoverable by design —
   * NotEnoughScopesError is what tells the engine to force a reconnect rather
   * than retry a refresh that can never work.
   */
  async refresh(
    _t: ProviderToken,
    _clientId: string,
    _clientSecret: string,
  ): Promise<ProviderToken> {
    throw new NotEnoughScopesError(
      "LinkedIn does not issue refresh tokens on the standard tier; reconnect the account",
    );
  }

  async publish(t: ProviderToken, input: PublishInput): Promise<PublishResult> {
    this.validate(this, input);

    const video = input.media.find((m) => m.type === "video");
    const images = input.media.filter((m) => m.type === "image");
    if (video && images.length > 0) {
      throw new BadBodyError("LinkedIn posts cannot mix a video with carousel images");
    }
    if (video) {
      // The Firebase implementation silently dropped video and published the
      // post as text-only — the user saw "published" and got the wrong post.
      // Failing loudly is correct until the Videos API is wired up.
      throw new BadBodyError(
        "LinkedIn video publishing is not supported yet — remove the video or post it manually",
      );
    }

    const authorUrn = await this.resolveAuthorUrn(t, input);

    const body: Record<string, unknown> = {
      author: authorUrn,
      commentary: this.composeText(input),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    if (images.length === 1) {
      body.content = {
        media: { id: await this.uploadImage(t.accessToken, authorUrn, images[0].url) },
      };
    } else if (images.length > 1) {
      const uploaded: string[] = [];
      // Keep uploads sequential. LinkedIn upload URLs are single-use and a
      // bounded carousel is fast enough without creating a burst of 20 calls.
      for (const image of images) {
        uploaded.push(await this.uploadImage(t.accessToken, authorUrn, image.url));
      }
      body.content = {
        multiImage: {
          images: uploaded.map((id, index) => ({
            id,
            altText: `Carousel slide ${index + 1} of ${uploaded.length}`,
          })),
        },
      };
    }

    const postUrn = await this.createPost(t.accessToken, body);

    return {
      externalId: postUrn,
      permalink: `https://www.linkedin.com/feed/update/${postUrn}`,
    };
  }

  // -------------------------------------------------------------------------

  private async fetchUserInfo(accessToken: string): Promise<UserInfo> {
    // OIDC userinfo — the `profile`/`openid` scopes make this the only way to
    // learn the member id; LinkedIn has no /me on the REST tier we use.
    return this.http("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  /**
   * ProviderToken has no field for the person URN, but the author is required
   * on every post. Prefer an engine-supplied URN (the connected account's
   * externalId) and otherwise re-derive it from the token itself, which is
   * always correct because the token *is* the member.
   */
  private async resolveAuthorUrn(t: ProviderToken, input: PublishInput): Promise<string> {
    const supplied = input.options?.authorUrn ?? input.options?.externalId;
    if (typeof supplied === "string" && supplied.startsWith("urn:li:person:")) {
      return supplied;
    }
    const info = await this.fetchUserInfo(t.accessToken);
    if (!info?.sub) {
      throw new BadBodyError("could not resolve the LinkedIn author URN for this account");
    }
    return `urn:li:person:${info.sub}`;
  }

  /** Images API: initializeUpload -> PUT the raw bytes -> post references the urn. */
  private async uploadImage(
    accessToken: string,
    authorUrn: string,
    imageUrl: string,
  ): Promise<string> {
    const init = await this.http("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...REST_HEADERS,
      },
      body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
    });

    const uploadUrl = init?.value?.uploadUrl;
    const imageUrn = init?.value?.image;
    if (!uploadUrl || !imageUrn) {
      throw new BadBodyError("LinkedIn image init returned no uploadUrl/image urn");
    }

    // NOT this.http(): it text-decodes every response body, which would corrupt
    // the binary asset. This is our own CDN, not a platform API, so none of
    // base's status->typed-error mapping applies to it either.
    let bytes: ArrayBuffer;
    try {
      const assetRes = await fetch(imageUrl);
      if (!assetRes.ok) {
        throw new BadBodyError(`could not fetch media for LinkedIn (${assetRes.status})`);
      }
      bytes = await assetRes.arrayBuffer();
    } catch (e) {
      if (e instanceof BadBodyError) throw e;
      throw new RetryableError(`network error fetching media for LinkedIn: ${String(e)}`);
    }

    // The upload URL is pre-signed and single-use; LinkedIn returns 201 with an
    // empty body, so there is nothing to read back here.
    await this.http(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: bytes,
    });

    return imageUrn;
  }

  /**
   * Creates the post and returns its URN.
   *
   * NOT this.http(): LinkedIn answers 201 with an EMPTY body and returns the new
   * post's urn only in the `x-restli-id` response header, which base.http drops
   * (it resolves to the parsed body). We need that urn for PublishResult.
   * externalId, so this one call reads the Response directly.
   *
   * Retry is also deliberately absent rather than merely lost: POST /rest/posts
   * is not idempotent and carries no dedupe key, so retrying a 5xx that actually
   * committed would double-post to the member's feed. A RetryableError hands the
   * decision to the engine instead of duplicating silently.
   */
  private async createPost(accessToken: string, body: Record<string, unknown>): Promise<string> {
    let res: Response;
    try {
      res = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...REST_HEADERS,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new RetryableError(`network error posting to LinkedIn: ${String(e)}`);
    }

    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      // Mirrors base.http's mapping so the engine reacts identically to a
      // LinkedIn failure whether or not the call went through this.http.
      if (res.status === 401) throw new RefreshTokenError(`401: ${text}`);
      if (res.status === 403) throw new NotEnoughScopesError(`403: ${text}`);
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000 || undefined;
        throw new RetryableError(`${res.status}: ${text}`, retryAfter);
      }
      throw new BadBodyError(`${res.status}: ${text}`);
    }

    const postUrn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
    if (!postUrn) {
      // The post very likely went live; we just cannot identify it. Surfacing a
      // terminal error beats a retry that would post a duplicate.
      throw new BadBodyError(
        "LinkedIn accepted the post but returned no x-restli-id; cannot record the post id",
      );
    }
    return postUrn;
  }
}

export const linkedin = new LinkedInProvider();
