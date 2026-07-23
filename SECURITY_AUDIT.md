# MagicBox AI public-launch security audit

Date: 2026-07-24

## Scope and result

This review covered the browser applications, Firebase Authentication, Firestore
and Storage rules, callable and HTTP Cloud Functions, Convex actions and
queries, OAuth, outbound media publishing, deployment headers, committed
secrets, and production dependency advisories. It is a production-hardening
pass, not a claim that any internet-facing system is impossible to attack.

The codebase now builds, type-checks, and passes its Functions test suite. The
production dependency audit has no high or critical findings.

## Remediated in this change

| Area | Risk | Protection now in place |
| --- | --- | --- |
| Brand website import | Server-side request forgery and response-memory exhaustion | HTTP(S)-only URLs; private, loopback, link-local, CGNAT, multicast and DNS-resolved internal addresses are rejected; redirects are checked one by one; response sizes and redirects are bounded. |
| OAuth account connection | Timing leakage and callback replay | HMAC comparison is timing-safe; a signed nonce is persisted and atomically consumed on callback; callbacks use a 303 redirect rather than interpolated HTML. |
| Firebase callables | Cross-origin abuse and automated calls | All browser callables use an exact origin allowlist and enforce Firebase App Check. |
| AI and media calls | Tenant data access, oversized payloads, unbounded provider spend | Storage paths are checked against the authenticated uid and object metadata; inline images, prompts, scripts, frame lists, names and durations are bounded; video quota is reserved atomically before Veo starts and refunded on failure. |
| Generated user media | Anonymous bucket-object access | New generated assets receive Firebase download tokens instead of GCS `makePublic()` ACLs. |
| Convex publishing | SSRF, account takeover and credit bypass | Post media must be a Convex storage URL; caller-supplied social accounts are verified as owned and active; only an owned, completed Veo job can skip a second video charge. |
| Upload surface | Arbitrary file hosting | User Firebase Storage writes are limited to image, video or PDF content types and bounded by path-specific size limits. |
| Browser delivery | Script injection and framing | Vercel now sends a restrictive CSP, HSTS, anti-framing, no-sniff, referrer and permissions headers. |
| Supply chain | Known vulnerable transitive packages | Jimp was upgraded to 1.6.1; overrides lift the high/critical transitive findings; CI blocks new high/critical production advisories and Dependabot checks weekly. |

## Required deployment steps before public traffic

1. In Firebase App Check, register the web apps with reCAPTCHA Enterprise. Set
   `VITE_FIREBASE_APPCHECK_SITE_KEY` for the web and admin Vercel production
   projects, deploy the clients, confirm verified traffic in Firebase metrics,
   then deploy Functions. The code deliberately rejects callable requests that
   do not carry a valid token.
2. Grant the Cloud Functions v2 runtime service account the Firebase App Check
   Token Verifier role. This is required for enforced function verification.
3. Deploy the server and rules together:

   ```bash
   firebase deploy --only firestore:rules,storage,functions
   ```

4. In Firebase Authentication, allow only the real production domains plus
   deliberate development domains. In Google, Meta and LinkedIn, retain only
   the exact registered OAuth callback URL.
5. Turn on uniform bucket-level access after checking existing object ACLs.
   Earlier releases created public GCS objects; migrate or revoke those public
   objects before storing private customer media in the public project.
6. Rotate every provider secret before launch: Gemini, Dodo, Meta, LinkedIn,
   Google OAuth, Post Bridge, Brevo and the OAuth state secret. A current-tree
   scan found no committed credential, but public Git history and local shells
   should never be treated as secret storage.
7. Require pull requests, successful CI and at least one human review on the
   `main` branch in GitHub. Disable force pushes and branch deletion for it.

## Follow-up monitoring

- The current production audit has nine moderate advisories in the Firebase
  Admin transitive dependency chain. `npm audit` proposes downgrading to
  Firebase Admin 10.3.0, which is not an appropriate security fix. Monitor
  Firebase Admin releases and upgrade when a supported release resolves the
  advisory.
- Run `npm audit --omit=dev --audit-level=high` in CI (now configured) and
  review Dependabot pull requests weekly.
- Review App Check metrics, Function error rates and Vercel CSP violations for
  the first week after launch. Keep development App Check debug tokens out of
  production environments.
- Convex storage download URLs are bearer URLs by design. Do not expose them in
  public pages or logs; delete and re-upload an asset to revoke an accidentally
  shared URL.
