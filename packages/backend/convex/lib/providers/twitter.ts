import { BaseProvider } from "./base";
import {
  ProviderDeferredError,
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
 * X (Twitter) — REGISTERED BUT DEFERRED.
 *
 * WHY DEFERRED: as of Feb 2026 X has no free posting tier. The API is metered
 * pay-per-use at roughly $0.015/post, plus a ~$0.20 surcharge on any post that
 * contains a link — which is most of what a scheduling product posts. Until that
 * cost is a deliberate product decision, the slot stays registered (so the
 * catalogue can say "coming soon" with an honest reason) but every entry point
 * throws instead of half-working.
 *
 * The metadata below is real, not placeholder: limits, scopes, and PKCE are what
 * X actually requires, so `providerCatalogue()` and `validate()` are already
 * correct and enabling this is a fill-in-the-blanks job.
 *
 * ---------------------------------------------------------------------------
 * TO ENABLE — what a future implementer must build
 * ---------------------------------------------------------------------------
 * 0. Set TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET in Convex env, then delete
 *    the `deferred` field below. `connectableProviders()` picks it up with no
 *    other edit — nothing downstream branches on platform name.
 *
 * 1. buildAuthUrl — OAuth2 Authorization Code + PKCE (X REQUIRES PKCE; there is
 *    no non-PKCE flow for user-context tokens). `usesPkce = true` already makes
 *    the OAuth engine hand you a real `codeChallenge`.
 *      GET https://x.com/i/oauth2/authorize
 *      ?response_type=code
 *      &client_id=<clientId>
 *      &redirect_uri=<redirectUri>          (must match the app config exactly)
 *      &scope=<this.scopes.join(" ")>       (space-delimited, NOT comma)
 *      &state=<state>
 *      &code_challenge=<codeChallenge>
 *      &code_challenge_method=S256          (never "plain")
 *
 * 2. exchangeCode — POST https://api.x.com/2/oauth2/token
 *      Content-Type: application/x-www-form-urlencoded
 *      Authorization: Basic btoa(`${clientId}:${clientSecret}`)
 *        WHY Basic: confidential clients MUST authenticate on the header. Sending
 *        client_secret in the body is rejected. Use btoa() — no Buffer in Convex.
 *      body: grant_type=authorization_code, code, redirect_uri, code_verifier
 *    Returns access_token (expires_in ~7200 = 2h) + refresh_token (only if
 *    `offline.access` was granted — without it there is no refresh at all).
 *    Then GET https://api.x.com/2/users/me?user.fields=profile_image_url with
 *    the user token to fill ConnectedProfile{ externalId: data.id,
 *    username: data.username, displayName: data.name, avatarUrl }.
 *    X connects exactly one account per authorization -> return a 1-element array.
 *
 * 3. refresh — same token endpoint + Basic auth,
 *      body: grant_type=refresh_token, refresh_token=<t.refreshToken>
 *    X ROTATES the refresh token: the response carries a NEW refresh_token and
 *    the old one dies immediately. Persist both or the next refresh 400s.
 *    If `t.refreshToken` is absent, throw NotEnoughScopesError — offline.access
 *    was never granted, so this is a reconnect, not a retry.
 *
 * 4. publish — POST https://api.x.com/2/tweets
 *      Authorization: Bearer <t.accessToken>   (USER context)
 *      body: { text, media: { media_ids: [...] } }   // omit `media` when empty
 *    Returns { data: { id, text } }. Build the permalink as
 *    `https://x.com/i/web/status/${id}` — the v2 response carries no URL, and the
 *    handle may have changed since connect, so don't reconstruct /<username>/.
 *    NOTE: an app-only (client_credentials) bearer token CANNOT post. Posting is
 *    user-context only. If you see 403 on /2/tweets, that's usually the cause.
 *
 * 5. media — NOT part of /2/tweets. Separate chunked upload against
 *    https://api.x.com/2/media/upload (multipart/form-data, user-context bearer):
 *      INIT     command=init, total_bytes, media_type, media_category
 *               (tweet_image | tweet_video | tweet_gif) -> media_id_string
 *      APPEND   command=append, media_id, segment_index (0-based), media chunk
 *               <= 5 MB per segment; segments may be sent in order, index gaps fail
 *      FINALIZE command=finalize, media_id
 *      STATUS   command=status, media_id — REQUIRED FOR VIDEO ONLY. FINALIZE
 *               returns processing_info{state:pending|in_progress}; poll every
 *               check_after_secs until state=succeeded before calling /2/tweets,
 *               else the post fails with an unusable-media error. Images are
 *               ready at FINALIZE and need no poll.
 *    Use this.http() for every one of these calls — it already maps 401/403/4xx
 *    and retries 429/5xx, and X rate-limits media upload aggressively.
 *
 * 6. Cost guard before shipping: check `input.caption` for a URL and surface the
 *    ~$0.20 link surcharge, or the per-post cost silently multiplies ~14x.
 */
class TwitterProvider extends BaseProvider implements SocialProvider {
  readonly id = "twitter" as const;
  readonly displayName = "X (Twitter)";

  /** Space-delimited at request time. `offline.access` is what yields a refresh token. */
  readonly scopes = ["tweet.read", "tweet.write", "users.read", "offline.access"];

  readonly credentialEnv = {
    clientId: "TWITTER_CLIENT_ID",
    clientSecret: "TWITTER_CLIENT_SECRET",
  };

  /** 280 is the free/basic ceiling; Premium raises it, but we bill against the floor. */
  readonly limits = {
    maxCaptionLength: 280,
    maxImages: 4,
    maxVideos: 1,
    requiresMedia: false,
    supportedFormats: ["image", "video", "post"] as PostFormat[],
  };

  /** X mandates PKCE — the OAuth engine reads this to generate a verifier/challenge. */
  readonly usesPkce = true;

  readonly deferred = {
    reason:
      "X requires a paid metered API plan (~$0.015/post, +$0.20 if the post contains a link). " +
      "Enable by setting TWITTER_CLIENT_ID/SECRET and removing the deferred flag.",
  };

  buildAuthUrl(_input: AuthUrlInput): string {
    throw new ProviderDeferredError(this.displayName, this.deferred.reason);
  }

  async exchangeCode(_input: ExchangeInput): Promise<ConnectedProfile[]> {
    throw new ProviderDeferredError(this.displayName, this.deferred.reason);
  }

  async refresh(
    _token: ProviderToken,
    _clientId: string,
    _clientSecret: string,
  ): Promise<ProviderToken> {
    throw new ProviderDeferredError(this.displayName, this.deferred.reason);
  }

  async publish(_token: ProviderToken, _input: PublishInput): Promise<PublishResult> {
    // Deliberately throws BEFORE this.validate(): a deferred platform must report
    // "not enabled", not "caption too long". Restore the validate() call as the
    // first line when the real implementation lands.
    throw new ProviderDeferredError(this.displayName, this.deferred.reason);
  }
}

export const twitter = new TwitterProvider();
