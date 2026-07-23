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

## Authentication and OAuth

Enable Google sign-in and allow only the intended production plus deliberate
development domains. Configure Google/YouTube, Meta/Instagram, and LinkedIn
OAuth clients with exact callback URLs from `CHANNELS_SETUP.md`; do not use
wildcard redirect URIs.

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
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set LINKEDIN_CLIENT_SECRET
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
firebase functions:secrets:set OAUTH_STATE_SECRET
```

Set the corresponding public client IDs and non-secret runtime values through
the approved deployment environment. Consult [`.env.example`](./.env.example)
and [`functions/.env.example`](./functions/.env.example) for the full list.

## Production verification

Before public traffic, use the acceptance tests in [`PRODUCTION.md`](./PRODUCTION.md):
verify a real authenticated user can only access their data, a request without
App Check fails, a signed Dodo event activates the correct entitlement, and an
OAuth publishing flow works with a disposable provider account.
