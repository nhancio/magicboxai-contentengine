# Channel connections — Instagram, Facebook, WhatsApp, LinkedIn & YouTube

MagicBox connects channels via OAuth and publishes through their official APIs.
The **live path is Convex** (`packages/backend/convex/`). Firebase Functions
remain as a legacy fallback only.

X / Twitter and Reddit are registered but deferred (paid commercial API tiers).
Facebook Pages and WhatsApp share `META_APP_ID` / `META_APP_SECRET` (Facebook Login).

## Architecture (Convex — current)

- `convex/social.ts` — `connectUrl` builds the consent URL; `disconnect` removes
  an account. Tokens live in `socialTokens` (server-only).
- `convex/http.ts` — `GET /oauth/callback` exchanges the code and redirects back
  into the app (`?social=connected` / `?social=error`).
- `convex/lib/providers/*` — one module per platform (YouTube, Instagram,
  Facebook, WhatsApp, LinkedIn live; Twitter/Reddit deferred).
- `convex/publish.ts` + `scheduler.ts` — publish engine + 1-minute drain cron.
- UI: Settings + Onboarding call `api.social.connectUrl` / `api.social.accounts`.

### OAuth redirect URI (register this exact URL)

```
https://beloved-lyrebird-288.convex.site/oauth/callback
```

(Prod: `https://<your-prod-deployment>.convex.site/oauth/callback`)

### Secrets to set on Convex

From `packages/backend/`:

```bash
npx convex env set GOOGLE_OAUTH_CLIENT_ID <id>        # YouTube
npx convex env set GOOGLE_OAUTH_CLIENT_SECRET <secret>
npx convex env set APP_BASE_URL https://app.magicboxai.in

# Optional — free YouTube trending enrichment for Maya
npx convex env set YOUTUBE_API_KEY <key>

# Later (Instagram / Facebook / LinkedIn)
npx convex env set META_APP_ID <id>
npx convex env set META_APP_SECRET <secret>
npx convex env set LINKEDIN_CLIENT_ID <id>
npx convex env set LINKEDIN_CLIENT_SECRET <secret>
```

---

## YouTube (Google) — do this first

1. [Google Cloud Console](https://console.cloud.google.com) → project
   `magicboxai-50927` (or your Firebase project).
2. **APIs & Services → Enable APIs** → enable **YouTube Data API v3**.
3. **OAuth consent screen** branding (must match the public homepage):
   - **App name:** `MagicBox` (exact match to https://magicboxai.in/ — do not use
     “MagicBox AI”, “MagicBox App”, or the company legal name alone)
   - **User support email:** `support@magicboxai.in`
   - **App logo:** same logo as the homepage (`logo-512.png` / brand mark)
   - **Application home page:** `https://magicboxai.in/`
   - **Privacy policy:** `https://magicboxai.in/privacy.html`
   - **Terms of service:** `https://magicboxai.in/terms.html`
   - **Authorized domains:** `magicboxai.in`
4. **Scopes** (minimum for YouTube publish):
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`
   Add yourself as a test user while the app is unverified.
5. **Credentials → Create OAuth client ID** (type: **Web application**) →
   Authorized redirect URIs =
   `https://beloved-lyrebird-288.convex.site/oauth/callback`
6. Copy **Client ID** / **Client secret** → set via `npx convex env set` above.
7. (Optional) Create an API key → `YOUTUBE_API_KEY` for Maya trend enrichment.

### Google brand / homepage verification (why YouTube shows “unverified”)

Google rejects verification when the homepage does not clearly explain the app
or when the OAuth app name does not match the homepage brand. Requirements:
[App Homepage](https://support.google.com/cloud/answer/13807376) ·
[App Identity & Branding](https://support.google.com/cloud/answer/13804963).

After deploying the landing page:

1. Confirm https://magicboxai.in/ shows **MagicBox** as the product name and
   explains purpose + Google/YouTube data use (no login required).
2. Confirm Privacy Policy is linked from the homepage and matches the consent
   screen URL exactly.
3. In Cloud Console → OAuth consent → **Prepare for verification** → resubmit.
4. Reply to Google’s verification email confirming the homepage was updated.

### Scopes to keep on the OAuth consent screen (Data Access)

MagicBox only needs these YouTube scopes. **Remove everything else** from
Google Cloud → Auth Platform → Data Access — extra scopes (Cloud Platform,
BigQuery, Storage, App Engine, `youtube.force-ssl`, full `youtube`) block or
delay verification and are not used by the app.

**Keep (sensitive — required for publish):**
- `https://www.googleapis.com/auth/youtube.upload` — upload videos the user
  chooses to publish
- `https://www.googleapis.com/auth/youtube.readonly` — read channel identity

**Optional non-sensitive (only if this same client is used for Google sign-in):**
- `openid`, `userinfo.email`, `userinfo.profile`

**Remove (do not request):**
- `cloud-platform`, `cloud-platform.read-only`
- BigQuery / Cloud Storage / App Engine scopes
- `youtube` (full manage), `youtube.force-ssl`, `youtube.download`
- `yt-analytics.readonly` (unless you add analytics features later)

**Justification text** (paste into “How will the scopes be used?”):

> MagicBox is AI marketing automation software. youtube.upload and
> youtube.readonly let a signed-in user connect their YouTube channel and
> upload videos they create or approve in MagicBox. We do not use these
> scopes for ads, scraping others’ content, or unrelated Google Cloud access.

Note: Firebase “Sign in with Google” and “Connect YouTube” are separate OAuth
steps. Google **requires** YouTube scope consent the first time — we cannot
skip it. MagicBox passes `login_hint` with the signed-in email so users skip
the account picker and go straight to the YouTube permission screen.

### Quota note
Each `videos.insert` costs ~1,600 units against a default **10,000/day** project
quota (~6 uploads/day for the whole app). Request a quota increase for scale.

### Test
Settings → **Connect YouTube** → Google consent → back to Settings with
`?social=connected`. Then Studio → video preset → Post now / Schedule.

---

## Instagram (Meta) — Instagram Login

MagicBox uses **Instagram API with Instagram Login** (not Facebook Login Page
scopes). Old scopes like `instagram_basic` / `instagram_content_publish` are
rejected on new Meta apps.

1. developers.facebook.com → your app → **Instagram** use case.
2. Open **API setup with Instagram login** (not Facebook login).
3. Permissions needed for publish:
   - `instagram_business_basic`
   - `instagram_business_content_publish`
   (Messaging permissions are optional; not required for Connect/publish.)
4. **Set up Instagram business login** → add OAuth redirect URI:
   `https://beloved-lyrebird-288.convex.site/oauth/callback`
5. Copy **Instagram app ID** + **Instagram app secret** from that page →
   ```bash
   npx convex env set META_IG_APP_ID <instagram-app-id>
   npx convex env set META_IG_APP_SECRET <instagram-app-secret>
   ```
   Do **not** reuse `META_APP_ID` here — that is the Facebook App ID (Pages + WhatsApp).
6. End users need an Instagram **Business or Creator** account (Page link
   not required for this login type).
7. App Review / Advanced Access before live customer publish.

## WhatsApp (Meta) — same app as Facebook Pages

WhatsApp uses **Facebook Login** on the same Meta app / credentials as Pages
(`META_APP_ID` / `META_APP_SECRET`). It is a separate connect button in Settings
because a WABA phone number is a different publish destination than a Page.

1. developers.facebook.com → your app → add the **WhatsApp** product (Cloud API).
2. Permissions (Advanced Access for production):
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`
3. Valid OAuth Redirect URI (same Convex callback as other channels):
   `https://beloved-lyrebird-288.convex.site/oauth/callback`
4. In Meta Business Suite → WhatsApp Manager: create a **WhatsApp Business Account**,
   add/verify a business phone number, and ensure your Meta user can manage it.
5. Env (already used for Facebook Pages — no new secrets):
   ```bash
   npx convex env set META_APP_ID <facebook-app-id>
   npx convex env set META_APP_SECRET <facebook-app-secret>
   ```
6. Settings → **Connect WhatsApp** → Facebook Login with WhatsApp scopes → MagicBox
   stores each discovered phone number as a channel (`phoneNumberId` + `wabaId`).
7. Publishing is A2P (not a public feed). Each post needs opted-in recipients:
   ```json
   {
     "content": {
       "caption": "…",
       "perPlatform": {
         "whatsapp": {
           "recipients": ["9198xxxxxxxx"],
           "templateName": "optional_approved_template",
           "templateLanguage": "en"
         }
       }
     }
   }
   ```
   - Session messages (image/video/text) only work inside an open 24h customer window.
   - Outside that window, set an approved **Marketing** (or other) `templateName`.
8. App Review for WhatsApp permissions before live customer send.

## LinkedIn

1. linkedin.com/developers → create an app, link a Company Page.
2. Request **Share on LinkedIn** + **Sign In with LinkedIn using OpenID Connect**.
3. Auth → Redirect URLs = the Convex callback above.
4. `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.
5. Scopes: `openid profile w_member_social`.

---

## Known limits

- Instagram requires media (image or Reels); text-only isn't allowed.
- LinkedIn video upload isn't implemented yet (text + image).
- YouTube requires a video.
- YouTube access tokens refresh via the stored Google refresh token.
  Instagram/LinkedIn long-lived tokens (~60 days) cannot be refreshed
  server-side — when expired the account is marked `expired` and the user
  reconnects in Settings.
- WhatsApp is not a public feed: every send needs opted-in E.164 recipients
  (`perPlatform.whatsapp.recipients`). Session media/text only works inside
  Meta's 24h customer-service window; otherwise use an approved template name.
