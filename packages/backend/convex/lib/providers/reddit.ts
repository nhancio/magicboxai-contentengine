import {
  ProviderDeferredError,
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
 * Reddit — registered but DEFERRED.
 *
 * WHY: Reddit's free API tier prohibits commercial use, and the commercial tier
 * (~$12k/yr) is gated behind manual "Responsible Builder" approval. We keep the
 * slot registered so the UI can render Reddit as "coming soon" with real
 * metadata, and so `PlatformId` / the registry stay honest — rather than
 * shipping a connect button that 403s at OAuth time.
 *
 * ---------------------------------------------------------------------------
 * FOR THE FUTURE IMPLEMENTER (once commercial API access is granted):
 *
 * OAuth2 (authorization_code):
 *   - Authorize:  https://www.reddit.com/api/v1/authorize
 *       ?client_id&response_type=code&state&redirect_uri&duration=permanent&scope=
 *     `duration=permanent` is MANDATORY — without it Reddit issues NO refresh
 *     token and the access token dies in 1 hour, which means reconnect-per-post.
 *   - Token:      POST https://www.reddit.com/api/v1/access_token
 *       Basic auth: `Authorization: Basic ${btoa(clientId + ":" + clientSecret)}`
 *       Body (form-encoded): grant_type=authorization_code, code, redirect_uri
 *       Refresh uses the same endpoint with grant_type=refresh_token.
 *
 * API base: https://oauth.reddit.com  (NOT www.reddit.com — www is auth only).
 *
 * User-Agent is REQUIRED and enforced: a generic or missing UA gets hard-blocked
 * (429/403) regardless of token validity. Reddit wants the documented format,
 * e.g. `web:com.magicbox.suite:v1.0 (by /u/<owner>)`. Pass it on EVERY oauth call.
 *
 * Publishing: POST https://oauth.reddit.com/api/submit
 *   - kind=self  -> `text` is the body        (text post)
 *   - kind=link  -> `url` is the destination  (link post)
 *   - kind=image -> `url` is an uploaded asset URL (see lease flow below)
 *   - always: sr=<subreddit>, title=<title>, api_type=json
 *   Reddit returns 200 with errors nested in `json.errors` — a successful HTTP
 *   status does NOT mean the post landed, so `this.http` alone is insufficient
 *   here; the body must be inspected and mapped to BadBodyError explicitly.
 *
 * Native media: 3-step S3 lease flow —
 *   1. POST /api/media/asset.json (filepath + mimetype) -> presigned S3 fields
 *   2. POST the file as multipart/form-data to the returned S3 action URL
 *   3. submit with the resulting asset URL / websocket-confirmed permalink
 *
 * Subreddit rules: many subreddits MANDATE post flair. Fetch valid flairs via
 * GET /r/<sr>/api/link_flair_v2 and pass flair_id; otherwise submit fails with
 * SUBMIT_VALIDATION_FLAIR_REQUIRED. `options.subreddit` and `options.flairId`
 * are the natural PublishInput extras. `title` is separate from the body and is
 * capped at 300 chars — Reddit has no single "caption" field like other
 * platforms, so composeText() maps to the BODY, not the title.
 * ---------------------------------------------------------------------------
 */
class RedditProvider extends BaseProvider implements SocialProvider {
  readonly id = "reddit" as const;
  readonly displayName = "Reddit";
  readonly scopes = ["identity", "submit", "flair"];
  readonly credentialEnv = {
    clientId: "REDDIT_CLIENT_ID",
    clientSecret: "REDDIT_CLIENT_SECRET",
  };
  /** Self-post body cap is 40k chars; submit takes at most one media asset. */
  readonly limits = {
    maxCaptionLength: 40000,
    maxImages: 1,
    maxVideos: 1,
    requiresMedia: false,
  };
  readonly deferred = {
    reason:
      "Reddit's free API prohibits commercial use; the commercial tier (~$12k/yr) requires manual approval. Enable after obtaining commercial API access.",
  };

  buildAuthUrl(_input: AuthUrlInput): string {
    throw new ProviderDeferredError("Reddit", this.deferred.reason);
  }

  async exchangeCode(_input: ExchangeInput): Promise<ConnectedProfile[]> {
    throw new ProviderDeferredError("Reddit", this.deferred.reason);
  }

  async refresh(
    _token: ProviderToken,
    _clientId: string,
    _clientSecret: string,
  ): Promise<ProviderToken> {
    throw new ProviderDeferredError("Reddit", this.deferred.reason);
  }

  async publish(_token: ProviderToken, _input: PublishInput): Promise<PublishResult> {
    throw new ProviderDeferredError("Reddit", this.deferred.reason);
  }
}

export const reddit = new RedditProvider();
