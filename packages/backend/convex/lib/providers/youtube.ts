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
import { BaseProvider } from "./base";

/**
 * YouTube (Data API v3) — ported from the working Firebase implementation
 * (functions/src/social.ts connectYouTube, functions/src/publishing.ts publishYouTube).
 *
 * OPERATIONAL LIMIT WORTH SURFACING: every videos.insert costs ~1600 quota units
 * against a project-wide default of 10,000 units/day — roughly SIX uploads per
 * DAY across ALL connected users, not per user. This is the binding constraint on
 * YouTube publishing, and it is not a rate limit that clears in a minute: it
 * resets at midnight Pacific. Overage surfaces as 403 quotaExceeded, which
 * `this.http` maps to NotEnoughScopesError (403) and the engine reads as "force
 * reconnect" — a misdiagnosis a reconnect will never fix. Raising the cap needs a
 * YouTube API Services audit. See the note in publish() below.
 */
class YouTubeProvider extends BaseProvider implements SocialProvider {
  readonly id = "youtube" as const;
  readonly displayName = "YouTube";
  readonly scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
  ];
  readonly credentialEnv = {
    clientId: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecret: "GOOGLE_OAUTH_CLIENT_SECRET",
  };
  /** Description caps at 5000 chars. videos.insert takes exactly one video, never an image. */
  readonly limits = {
    maxCaptionLength: 5000,
    maxImages: 0,
    maxVideos: 1,
    requiresMedia: true,
  };

  buildAuthUrl(input: AuthUrlInput): string {
    const params = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      state: input.state,
      response_type: "code",
      scope: this.scopes.join(" "),
      // Offline refresh tokens for scheduled YouTube uploads.
      access_type: "offline",
      // Keep previously granted scopes if the user already connected once.
      include_granted_scopes: "true",
      // Force the consent screen so Google issues a refresh_token on first
      // YouTube connect. Account picker is skipped via login_hint when the
      // user is already signed into MagicBox with the same Google email.
      prompt: "consent",
    });
    if (input.loginHint?.trim()) {
      params.set("login_hint", input.loginHint.trim());
    }
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(input: ExchangeInput): Promise<ConnectedProfile[]> {
    const token = await this.http("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: input.clientId,
        client_secret: input.clientSecret,
      }).toString(),
    });

    const accessToken: string | undefined = token.access_token;
    if (!accessToken) throw new BadBodyError("Google returned no access_token");

    const channels = await this.http(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    // A Google account is not a YouTube account: signing in with a bare Gmail that
    // has never created a channel returns 200 with an EMPTY items array. Terminal —
    // the user must create a channel, so retrying or reconnecting cannot help.
    const channel = channels.items?.[0];
    if (!channel) {
      throw new BadBodyError("no_youtube_channel: this Google account has no YouTube channel");
    }

    const snippet = channel.snippet ?? {};
    return [
      {
        externalId: channel.id,
        username: snippet.customUrl ?? snippet.title,
        displayName: snippet.title,
        avatarUrl: snippet.thumbnails?.default?.url,
        token: {
          accessToken,
          refreshToken: token.refresh_token,
          expiresAt: token.expires_in ? Date.now() + token.expires_in * 1000 : undefined,
          channelId: channel.id,
          scopes: token.scope ? String(token.scope).split(" ") : this.scopes,
        },
      },
    ];
  }

  async refresh(
    token: ProviderToken,
    clientId: string,
    clientSecret: string,
  ): Promise<ProviderToken> {
    // YouTube is the one provider that genuinely refreshes. If the refresh token is
    // absent the account was connected without offline consent (or Google revoked
    // it) — no amount of retrying produces one, so this is a reconnect.
    if (!token.refreshToken) {
      throw new NotEnoughScopesError("no refresh token stored for YouTube; reconnect required");
    }

    const refreshed = await this.http("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!refreshed.access_token) {
      throw new BadBodyError("Google refresh returned no access_token");
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      // WHY spread + explicit carry: a refresh_token grant does NOT re-issue the
      // refresh token. Taking `refreshed.refresh_token` here would write undefined
      // and permanently break every future refresh for this account.
      refreshToken: token.refreshToken,
      expiresAt: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : undefined,
    };
  }

  async publish(token: ProviderToken, input: PublishInput): Promise<PublishResult> {
    this.validate(this, input);

    // validate() only enforces that SOME media exists (requiresMedia). YouTube
    // needs specifically a video; an image-only post must fail before we spend
    // ~1600 quota units discovering it.
    const video = input.media.find((m) => m.type === "video");
    if (!video) {
      throw new BadBodyError("YouTube requires a video — this post has no video attached");
    }

    const description = this.composeText(input);
    const options = input.options ?? {};
    const rawTitle =
      typeof options.title === "string" && options.title.trim()
        ? options.title
        : (input.caption.split("\n")[0] || "New video");
    // Hard cap is 100; we cut at 90 to leave the title intact rather than clipped
    // mid-word at the API boundary.
    const title = rawTitle.slice(0, 90);
    const privacyStatus = typeof options.privacy === "string" ? options.privacy : "public";

    const bytes = await this.fetchMediaBytes(video.url);

    const metadata = {
      snippet: { title, description: description.slice(0, 5000) },
      // selfDeclaredMadeForKids is REQUIRED by YouTube policy; omitting it leaves
      // the video in a limited state until the owner answers the audience prompt.
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    };

    // multipart/related, NOT multipart/form-data: metadata JSON part first, then
    // the raw video bytes. FormData would emit form-data and Google rejects it.
    const boundary = "magicbox-yt-upload";
    const encoder = new TextEncoder();
    const head = encoder.encode(
      `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: video/*\r\n\r\n`,
    );
    const tail = encoder.encode(`\r\n--${boundary}--`);

    const body = new Uint8Array(head.length + bytes.length + tail.length);
    body.set(head, 0);
    body.set(bytes, head.length);
    body.set(tail, head.length + bytes.length);

    // QUOTA: this single call costs ~1600 units of a default 10k/day project quota
    // (~6 uploads/day for the whole app). Retries are disabled — each retry would
    // re-spend the full 1600 units. We also bypass base.http's blanket 403→
    // NotEnoughScopes mapping: YouTube returns 403 for both "missing scope" and
    // "quotaExceeded", and reconnecting never fixes a quota burn.
    let res: Response;
    try {
      res = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
    } catch (e) {
      throw new RetryableError(`network error uploading to YouTube: ${String(e)}`);
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      if (res.status === 401) throw new RefreshTokenError(`401: ${detail}`);
      if (res.status === 403) {
        if (/quotaExceeded|dailyLimitExceeded/i.test(detail)) {
          // Project-wide daily quota — retry tomorrow, not "reconnect".
          throw new RetryableError(`YouTube daily upload quota exceeded: ${detail}`);
        }
        throw new NotEnoughScopesError(`403: ${detail}`);
      }
      if (res.status === 429 || res.status >= 500) {
        throw new RetryableError(`${res.status}: ${detail}`);
      }
      throw new BadBodyError(`${res.status}: ${detail}`);
    }

    const result = await res.json();
    if (!result.id) throw new BadBodyError("YouTube upload returned no video id");

    return {
      externalId: result.id,
      permalink: `https://youtube.com/watch?v=${result.id}`,
    };
  }

  /**
   * Download the source video as raw bytes.
   *
   * WHY this bypasses `this.http`: base.http reads every response via `res.text()`,
   * which UTF-8-decodes the body. That is lossless for JSON and irreversibly
   * corrupting for an MP4 — the bytes cannot be recovered from the decoded string.
   * There is no binary-capable path on BaseProvider, and this call is not a
   * platform API call (our own storage URL, no OAuth token, none of the
   * 401/403 semantics base.http exists to map), so the status mapping below is
   * deliberately minimal rather than a re-implementation of it.
   */
  private async fetchMediaBytes(url: string): Promise<Uint8Array> {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new RetryableError(`network error fetching video: ${String(e)}`);
    }

    if (!res.ok) {
      const detail = `${res.status} fetching video for YouTube`;
      // Storage hiccups clear; a 404 means the asset is gone and never returns.
      if (res.status === 429 || res.status >= 500) throw new RetryableError(detail);
      throw new BadBodyError(detail);
    }

    return new Uint8Array(await res.arrayBuffer());
  }
}

export const youtube = new YouTubeProvider();
