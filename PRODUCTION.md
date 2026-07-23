# MagicBox production runbook

This is the only production deployment guide for the current social-publishing
product. It supersedes the legacy avatar/UGC instructions that previously lived
in this file. Do not copy ad-hoc Firestore or Storage rules into Firebase: the
versioned [`firestore.rules`](./firestore.rules) and [`storage.rules`](./storage.rules)
files are the source of truth.

## Release gate

Before a public release, the exact `main` commit must have all of the following:

```bash
npm run typecheck
npm test
npm run build:hosting
```

GitHub Actions additionally runs the production-preview browser suite and
blocks high/critical production dependency advisories. Do not release if any
required workflow is red.

## Required configuration

Configure production values in the hosting and cloud platforms; never commit
them in `.env` files.

| Surface | Required configuration |
| --- | --- |
| Web + admin | Firebase public config, `VITE_FIREBASE_APPCHECK_SITE_KEY`, `VITE_CONVEX_URL` when Convex features are enabled |
| Landing | `VITE_APP_URL=https://app.magicboxai.in`; PostHog values when analytics is approved |
| Firebase Functions | Firebase secrets for Dodo, Brevo, and Post Bridge; project/runtime settings required by Vertex AI |
| Firebase App Check | reCAPTCHA Enterprise registrations, site keys in both browser apps, and the Functions v2 runtime Token Verifier role |
| Convex channel OAuth | Channel client IDs/secrets, `APP_BASE_URL`, and the production Convex deployment configuration |
| OAuth providers | Exact Convex production callback URL, authorized JavaScript domains, client credentials, and approved scopes for Google/YouTube, Meta/Instagram, and LinkedIn |

Follow [`.env.example`](./.env.example) and
[`functions/.env.example`](./functions/.env.example) for variable names only;
they intentionally contain no values.

## Activate App Check, then deploy backend protection

1. Confirm Firebase Authentication only allows intended production and
   development domains.
2. Register App Check, set the browser site keys in both production browser
   deployments, and grant the runtime verifier role.
3. Deploy the browser applications so they can attach App Check tokens:

   ```bash
   ./deploy.sh
   ```

4. Confirm valid App Check requests in Firebase metrics before enforcing it on
   browser callables.
5. Deploy the versioned rules and Functions together:

   ```bash
   firebase deploy --only firestore:rules,storage,functions
   ```

6. Confirm anonymous Firestore/Storage access is denied, private user media is
   not publicly listed, and a signed-in user cannot read another user's data.
7. Audit existing bucket objects before enabling uniform bucket-level access.
   Revoke or migrate any historical public object before accepting customer
   media.

## Deploy browser applications

The supported browser deployment path is the repository script:

```bash
./deploy.sh
```

It builds locally and deploys the linked Vercel projects with prebuilt output:

- `https://magicboxai.in`
- `https://app.magicboxai.in`
- `https://admin.magicboxai.in`

After deploy, check each live response for HTTPS, the expected CSP/HSTS/noindex
headers, the correct canonical URL on the landing site, and no browser console
errors.

## Payment and publishing acceptance tests

Complete these in production or a provider-supported live test mode before
opening checkout:

1. Dodo: create checkout as an authenticated user, complete payment, verify a
   signed webhook activates the correct Firebase subscription, visit the
   customer portal, then cancel/refund and verify access changes safely.
2. OAuth: configure the current Convex callback from
   [`CHANNELS_SETUP.md`](./CHANNELS_SETUP.md), connect one test account for
   each marketed channel, publish only disposable test content, verify token
   refresh/reconnect behavior, then disconnect the account and confirm
   publishing is blocked.
3. Workflow: sign up, create a brand kit, generate a draft, approve it,
   schedule it, and verify only the selected account receives it.
4. Security: confirm requests without App Check and unauthenticated callable
   requests fail; confirm provider-backed calls return a rate-limit error once
   the per-account ceiling is reached.

## Operational controls

- Rotate provider and OAuth secrets before launch; treat prior shell history and
  chat transcripts as untrusted secret stores.
- Set a support owner and incident contact before enabling paid traffic.
- Monitor App Check validity, Cloud Functions errors/costs, Dodo webhook
  failures, OAuth callback failures, and provider publishing errors daily for
  the first week.
- Protect `main`: pull requests, required CI, one human review, and no force
  pushes.

The remaining account-level requirements are tracked in
[`LAUNCH.md`](./LAUNCH.md) and the security-specific deployment sequence is in
[`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).
