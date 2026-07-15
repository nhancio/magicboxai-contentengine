# Channel connections — Instagram, LinkedIn & YouTube (direct OAuth)

Post Bridge has been removed. MagicBox now connects Instagram, LinkedIn, and
YouTube directly via OAuth and publishes through their official APIs.
X / Twitter is deferred (paid API tier).

## Architecture

- `functions/src/social.ts` — `getSocialConnectUrl` (callable) builds the consent
  URL; `socialOAuthCallback` (HTTP) handles the redirect, exchanges the code, and
  stores the account. `disconnectSocialAccount` (callable) removes it.
- `functions/src/publishing.ts` — `publishPost()` publishes to each connected
  account: Instagram via the Graph API (image + Reels), LinkedIn via `/rest/posts`,
  YouTube via the Data API v3 multipart video upload (with automatic access-token
  refresh from the stored Google refresh token).
- Tokens live in `socialTokens/{accountId}` — **server-only**, never client-readable
  (see `firestore.rules`). Public account info lives in `socialAccounts/{accountId}`.
- UI: connect in Onboarding step 1 and Settings; the Dashboard lists connected channels.

## Secrets to set (production)

```bash
firebase functions:secrets:set META_APP_ID
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set LINKEDIN_CLIENT_ID
firebase functions:secrets:set LINKEDIN_CLIENT_SECRET
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID       # YouTube
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET   # YouTube
firebase functions:secrets:set OAUTH_STATE_SECRET   # any long random string
```

Non-secret config goes in `functions/.env` (see `.env.example`):
`APP_BASE_URL`, `OAUTH_CALLBACK_URL`.

## What you need to do next (developer portals)

The long pole is app review — start these now, in parallel.

### Instagram (Meta)
1. developers.facebook.com → create an app (type: **Business**).
2. Add the **Instagram Graph API** and **Facebook Login** products.
3. Facebook Login → Valid OAuth Redirect URIs = your `OAUTH_CALLBACK_URL`.
4. Copy the **App ID** → `META_APP_ID`, **App Secret** → `META_APP_SECRET`.
5. Request **App Review** for: `instagram_basic`, `instagram_content_publish`,
   `pages_show_list`, `pages_read_engagement`, `business_management`.
   Record a screencast of the connect + publish flow — reviewers require it.
6. Requirement for every end user: an Instagram **Business/Creator** account
   linked to a **Facebook Page**. Personal IG accounts cannot publish via API.
7. Complete Business Verification for your Meta business.

### LinkedIn
1. linkedin.com/developers → create an app, link it to a Company Page.
2. Products → request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
3. Auth tab → Redirect URLs = your `OAUTH_CALLBACK_URL`.
4. Copy **Client ID** → `LINKEDIN_CLIENT_ID`, **Client Secret** → `LINKEDIN_CLIENT_SECRET`.
5. Scopes used: `openid profile w_member_social`.

### YouTube (Google)
1. console.cloud.google.com → the same project as Firebase (or any) →
   **APIs & Services → Enable APIs** → enable **YouTube Data API v3**.
2. **OAuth consent screen** → External → add scopes
   `youtube.upload` and `youtube.readonly` → submit for verification
   (unverified apps are capped at 100 test users and show a warning screen).
3. **Credentials → Create OAuth client ID** (type: Web application) →
   Authorized redirect URIs = your `OAUTH_CALLBACK_URL`.
4. Copy **Client ID** → `GOOGLE_OAUTH_CLIENT_ID`, **Client secret** →
   `GOOGLE_OAUTH_CLIENT_SECRET`.
5. Note: each YouTube upload costs ~1,600 quota units; the default daily quota
   (10,000) allows ~6 uploads/day per project. Request a quota increase for scale.

### After approval
- Deploy functions, then set `OAUTH_CALLBACK_URL` to the real function URL and redeploy.
- Deploy `firestore.rules` (adds the locked-down `socialTokens` collection).
- Test: Settings → Connect Instagram / Connect LinkedIn → run an automation.

## Known limits (v1)
- Instagram requires media (image or video/Reels); text-only IG posts aren't allowed by the API.
- LinkedIn video isn't uploaded yet (text + image supported); video posts fall back to text.
- YouTube requires a video — enable video content on the automation, or attach one manually.
- YouTube access tokens auto-refresh via the stored refresh token. Instagram/LinkedIn
  tokens are long-lived (~60 days) but cannot be refreshed server-side; when one
  expires the account is marked `expired` and the user must reconnect in Settings.
