/**
 * The social provider contract.
 *
 * WHY: the Firebase implementation branches on provider string literals in ~5
 * separate places (connect-URL building, callback dispatch, publish dispatch,
 * token refresh, platform whitelist). Adding a platform meant finding and
 * editing every one, and forgetting one failed silently at runtime.
 *
 * Here, a platform is ONE module implementing this interface, registered once.
 * The publish/OAuth engines never mention a platform by name.
 *
 * Pattern adapted from Postiz's `SocialProvider` + `SocialAbstract` design.
 */

export type PlatformId =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "reddit";

export type MediaItem = {
  type: "image" | "video";
  url: string;
};

export type PublishInput = {
  caption: string;
  hashtags?: string[];
  media: MediaItem[];
  /** Provider-specific extras (e.g. reddit subreddit, youtube title/privacy). */
  options?: Record<string, unknown>;
};

export type PublishResult = {
  externalId: string;
  permalink?: string;
};

/** Everything a provider needs to talk to a platform on the user's behalf. */
export type ProviderToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  /** instagram: the IG business account id */
  igUserId?: string;
  /** instagram/facebook: the Page whose token actually publishes */
  pageId?: string;
  /** youtube: the channel */
  channelId?: string;
  scopes?: string[];
};

export type ConnectedProfile = {
  externalId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  token: ProviderToken;
};

export type AuthUrlInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  /** PKCE challenge; only providers with `usesPkce` receive a real value. */
  codeChallenge?: string;
  /**
   * Google: skip the account picker when the user is already signed in with
   * the same Google email (Firebase Auth). Does NOT skip YouTube scope consent
   * the first time — Google still requires that for youtube.upload.
   */
  loginHint?: string;
};

export type ExchangeInput = {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier?: string;
};

// ---------------------------------------------------------------------------
// Typed errors — these drive the engine's control flow.
// ---------------------------------------------------------------------------

/**
 * Providers only THROW. The scheduler decides what recovery means. This is what
 * decouples token/error handling from platform code.
 */

/** Access token expired but refreshable — engine refreshes and retries once. */
export class RefreshTokenError extends Error {
  constructor(message = "access token expired") {
    super(message);
    this.name = "RefreshTokenError";
  }
}

/** The request is wrong and will never succeed — mark destination failed, no retry. */
export class BadBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadBodyError";
  }
}

/** The user never granted (or revoked) a needed scope — force reconnect. */
export class NotEnoughScopesError extends Error {
  constructor(message = "missing required scopes") {
    super(message);
    this.name = "NotEnoughScopesError";
  }
}

/** Transient (429/5xx/network) — engine retries with backoff. */
export class RetryableError extends Error {
  constructor(message: string, public retryAfterMs?: number) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Platform is registered but intentionally not enabled yet (X, Reddit — pending
 * a commercial-API decision). Distinct from "broken" so the UI can say
 * "coming soon" instead of showing an error.
 */
export class ProviderDeferredError extends Error {
  constructor(platform: string, reason: string) {
    super(`${platform} is not enabled: ${reason}`);
    this.name = "ProviderDeferredError";
  }
}

// ---------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------

export interface SocialProvider {
  readonly id: PlatformId;
  readonly displayName: string;

  /** OAuth scopes requested at connect time. */
  readonly scopes: string[];

  /** Names of the Convex env vars holding this provider's OAuth app creds. */
  readonly credentialEnv: { clientId: string; clientSecret: string };

  /** Hard caps enforced BEFORE we call the API, so we fail fast and free. */
  readonly limits: {
    maxCaptionLength: number;
    maxImages: number;
    maxVideos: number;
    /** Platform cannot post without media (Instagram, YouTube). */
    requiresMedia: boolean;
    /** Platform cannot post media at all. */
    textOnly?: boolean;
  };

  /** True if this provider is registered but deliberately disabled. */
  readonly deferred?: { reason: string };

  /** Uses PKCE (X requires it). */
  readonly usesPkce?: boolean;

  buildAuthUrl(input: AuthUrlInput): string;

  /** Exchange the callback code for token(s) + profile. May return >1 account
   *  (Meta returns one per Page). */
  exchangeCode(input: ExchangeInput): Promise<ConnectedProfile[]>;

  /** Refresh an expired access token. Throws NotEnoughScopesError if the
   *  provider issues no refresh token (Instagram/LinkedIn) — that's a reconnect. */
  refresh(token: ProviderToken, clientId: string, clientSecret: string): Promise<ProviderToken>;

  publish(token: ProviderToken, input: PublishInput): Promise<PublishResult>;
}
