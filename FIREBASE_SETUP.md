# Firebase setup for the current MagicBox product

This guide is for development and production configuration of the current
social-publishing workflow. The old instructions for broad authenticated
Firestore access, DALL-E, and manually pasted rules are retired.

## Browser applications

Register the landing, web, and admin browser applications in Firebase and set
the public Firebase configuration values listed in [`.env.example`](./.env.example).
The Firebase API key is a browser identifier, not a server secret; security
comes from Authentication, App Check, and the deployed rules.

For production web/admin traffic, also set:

```env
VITE_FIREBASE_APPCHECK_SITE_KEY=your_recaptcha_enterprise_site_key
```

Use separate App Check registrations for the web and admin origins. Confirm
valid App Check traffic before deploying Functions with enforcement enabled.

## Authentication and channel OAuth

Enable Google sign-in and allow only the intended production plus deliberate
development domains.

### Self-hosted sign-in handler (required for mobile)

By default `authDomain` is `magicboxai-50927.firebaseapp.com`, so every piece of
Firebase's auth machinery — the popup handler and the `/__/auth/iframe` used to
carry sign-in state — is **third-party** to `app.magicboxai.in`. Safari's ITP
partitions and evicts that storage, which produces two symptoms:

- `signInWithRedirect` never completes, so any gesture-free sign-in hangs.
- Refresh tokens go stale early. The app still shows a signed-in user (the
  cached `onAuthStateChanged` object survives), but callables arrive at Cloud
  Functions with no valid ID token and `requireAuth` rejects them as
  `unauthenticated`.

`apps/web/vercel.json` already proxies `/__/*` to the Firebase Hosting site, so
the handler is served first-party. Two manual steps activate it:

1. **Google Cloud console → APIs & Services → Credentials →** the OAuth 2.0
   Web client used by Firebase Auth. Add to *Authorized redirect URIs*:

   ```
   https://app.magicboxai.in/__/auth/handler
   ```

   Keep the existing `https://magicboxai-50927.firebaseapp.com/__/auth/handler`
   entry so the change is reversible.

2. **Vercel → `magicboxai-web` → Settings → Environment Variables (Production).**
   Set:

   ```
   VITE_FIREBASE_AUTH_DOMAIN=app.magicboxai.in
   ```

   Redeploy. To roll back, put the `firebaseapp.com` value back and redeploy —
   no code change needed.

Leave `VITE_FIREBASE_AUTH_DOMAIN` on the `firebaseapp.com` value for local
development: `localhost` has no `/__/auth` proxy, so sign-in there uses the
popup path, which works cross-origin.

`shared/lib/firebase.ts` exposes `isAuthDomainFirstParty()`, and
`shared/lib/auth.tsx` keys its popup-vs-redirect choice off it, so both
configurations behave correctly — only the mobile/redirect experience improves
once the flip is done.

The current channel-connection path is **Convex**, not Firebase Functions.
Configure Google/YouTube, Meta/Instagram, and LinkedIn with this exact
production redirect URI, and do not use wildcard redirect URIs:

```
https://beloved-lyrebird-288.convex.site/oauth/callback
```

Store the current channel OAuth credentials in Convex from `packages/backend/`:

```bash
npx convex env set GOOGLE_OAUTH_CLIENT_ID
npx convex env set GOOGLE_OAUTH_CLIENT_SECRET
npx convex env set META_APP_ID
npx convex env set META_APP_SECRET
npx convex env set LINKEDIN_CLIENT_ID
npx convex env set LINKEDIN_CLIENT_SECRET
npx convex env set APP_BASE_URL https://app.magicboxai.in
```

Enter each value only at the prompt; never put a secret in a command line,
commit, browser variable, or chat. See [`CHANNELS_SETUP.md`](./CHANNELS_SETUP.md)
for provider-specific scopes and approval requirements. The Firebase social
OAuth implementation is a legacy fallback and must not be configured for the
current public launch.

## Rules and Functions

The repository owns the production rules. Deploy them from the project root:

```bash
firebase deploy --only firestore:rules,storage,functions
```

Do not paste alternate rules from a console guide. The checked-in rules enforce
tenant ownership, keep OAuth tokens server-only, and restrict uploads by path,
type, and size.

Configure server credentials with Firebase Secret Manager, never a browser
`VITE_*` variable:

```bash
firebase functions:secrets:set DODO_API_KEY
firebase functions:secrets:set DODO_WEBHOOK_SECRET
firebase functions:secrets:set BREVO_API_KEY
firebase functions:secrets:set POST_BRIDGE_API_KEY
```

Set the corresponding public client IDs and non-secret runtime values through
the approved deployment environment. Consult [`.env.example`](./.env.example)
and [`functions/.env.example`](./functions/.env.example) for the full list.

## Production verification

Before public traffic, use the acceptance tests in [`PRODUCTION.md`](./PRODUCTION.md):
verify a real authenticated user can only access their data, a request without
App Check fails, a signed Dodo event activates the correct entitlement, and an
OAuth publishing flow works with a disposable provider account.
