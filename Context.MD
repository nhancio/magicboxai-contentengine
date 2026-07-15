# MagicBox — Project Context

**Canonical context document**  
**Last verified:** 2026-07-15  
**Migration target:** Convex (not “Convicts”)  
**Company:** Nhancio Technologies Private Limited  
**Product:** MagicBox (`magicboxai.in`)

This document consolidates the verified product, architecture, operations, design, SEO, payments, video, and migration context that was previously spread across the repository. Open work belongs in `NEXTSTEPS.md`.

## Status vocabulary

- **Verified:** observed in source, a local build/test, or a cited live measurement.
- **Implemented:** present in the working tree but not necessarily deployed.
- **External/unknown:** requires a provider dashboard, production deployment, credentials, or human review.
- **Claim:** product language that must not be published until evidence exists.

## 1. What MagicBox is

MagicBox is a multi-tenant AI marketing automation platform. Its intended product loop is:

```text
Google sign-in
  → brand profile + connected social channels
  → recurring or one-time automation
  → Gemini channel-specific copy
  → Imagen image / Veo short-video generation
  → optional human approval
  → scheduled publishing
  → Instagram, LinkedIn, or YouTube
```

The repository also contains an older avatar/UGC/ad product. Those routes are behind `VITE_ENABLE_LEGACY_TOOLS` and are off by default, but the source and Cloud Functions still exist. They are not part of the launch-safe core until a product and data-retention decision is made.

The `marketing-agent/` directory is a standalone GitAgent knowledge pack. It contains 88 operational Markdown skill files and is not dynamically invoked by the current product. Marketing prompts in `functions/src/prompts/marketingPrompts.ts` were distilled from it.

## 2. Repository and runtime layout

```text
apps/
  landing/       Public marketing site, magicboxai.in, Vite/React, port 5173
  web/           Authenticated product, app.magicboxai.in, port 5174
  admin/         Admin console, admin.magicboxai.in, port 5175
functions/       Firebase Functions v2, Node 20, TypeScript
shared/          Shared UI, Firebase client, auth, types, and API wrappers
marketing-agent/ Vendored/reference marketing knowledge pack
legal/           Canonical legal-policy drafts used to publish static HTML
tests/e2e/       Playwright production-build smoke suite
```

Current package workspaces are `apps/*` and `functions`. `shared/` is reached through Vite aliases and is not yet a versioned workspace package. A safe future structure is recorded in `NEXTSTEPS.md`; mass-moving the current heavily modified worktree would add risk without fixing product behavior.

## 3. Stack and source of truth

| Layer | Current implementation |
|---|---|
| Frontend | React 18.3, TypeScript, Vite 8, React Router, Tailwind, Radix-style shared UI |
| Public rendering | Landing is statically prerendered at build time and hydrated in the browser |
| Authentication | Firebase Authentication with Google sign-in; admin uses Firebase auth plus server/admin authorization |
| Database | Firestore with security rules and composite indexes |
| Backend | Firebase Cloud Functions v2 in `us-central1`, Node 20 |
| Scheduling | Three Firebase scheduled functions: automation, generation, publishing |
| Media | Firebase Storage/GCS; some generated objects are currently made public |
| AI | Vertex AI through `@google/genai`: Gemini, Imagen, Veo 3.1 |
| Channels | Direct OAuth/API integrations for Instagram, LinkedIn, YouTube; X is deferred |
| Billing | Dodo Payments hosted checkout, signed webhook, customer portal |
| Email | Brevo transactional email |
| Analytics | Consent-gated PostHog loader; no-op when unconfigured |
| Hosting | Firebase Hosting is the repository-wide configuration; app-local Vercel configs also exist |

Canonical local commands:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Development commands:

```bash
npm run dev --workspace=apps/landing
npm run dev --workspace=apps/web
npm run dev --workspace=apps/admin
npm run serve --workspace=functions
```

The root CI workflow runs frozen install, typechecks, Functions contract tests, all frontend builds, and Playwright browser smoke tests.

## 4. Core backend flow

### Automation creation

Authenticated callables create and update automations. The trusted invariants are that the brand and every connected account belong to the caller, account status is active, account/platform mappings match, and only Instagram, LinkedIn, and YouTube are accepted.

### Scheduled pipeline

1. `automationTick` finds due active automations and creates an idempotent post.
2. `generationTick` claims scheduled posts and generates platform captions plus requested media.
3. `postingTick` claims ready posts, rechecks entitlement and tenant ownership, and publishes.

Retries are bounded and persisted. Remaining production limitations include stuck-claim recovery after process crashes, per-destination partial-success reconciliation, and provider-side idempotency.

### Current collections

The active and legacy code references approximately these Firestore collections:

- `users`
- `admins`
- `subscriptions`
- `paymentWebhookEvents`
- `socialAccounts`
- `socialTokens`
- `brandProfiles`
- `automations`
- `posts`
- `pendingEntitlements` (legacy guest-payment path; no new anonymous checkout)
- `studioGenerations`
- `influencers`, `photoAvatars`, `avatars`
- `videos`, `ads`, `templates`
- `apiLogs`

All client/server models and collection access must be treated as tenant-scoped. Admin SDK reads bypass Firestore rules, so Functions must enforce ownership themselves.

## 5. Product plans and claims

The UI and backend are aligned on the launch catalogue:

| Plan | Price | Publishing allowance | Notes |
|---|---:|---:|---|
| Free | $0 | No direct publishing | Draft/exploration only |
| Pro | $29 monthly / $23 per month billed annually | 60 posts per calendar month | Captions, images, approval, supported channels |
| Max | $149 monthly / $118 per month billed annually | 300 posts per calendar month | Higher-volume version of Pro |
| Custom | Contact | Contracted | Must not imply unimplemented SLAs/features |

Do not advertise TikTok direct publishing, unlimited Max content, fixed storage/workspace/connection limits, analytics results, customer outcomes, or credit allowances until they are implemented and enforced server-side.

Video economics are not represented by the post allowance. A separate atomic cost/credit ledger and conservative video quotas are required before general availability.

## 6. Authentication, authorization, and security posture

Implemented controls include:

- Google auth for the user app; no hardcoded admin credential is used by current source.
- Server-only social tokens under `socialTokens`.
- Tenant validation on marketing automation and publishing boundaries.
- Server-owned post lifecycle and quota fields.
- Basic hosting security headers and `noindex` on app/admin.
- Dodo secrets and OAuth/provider secrets intended for Google Secret Manager.
- Login redirects restricted to same-app relative paths.

Known security work remains:

- Firebase App Check and rate/cost limits on expensive AI callables.
- Complete DNS/redirect/private-network SSRF prevention for website extraction and any provider media fetch.
- One-time OAuth state nonce storage and timing-safe signature comparison.
- Removal of permanent public ACLs for private generated media.
- Full account export/deletion with recent auth, provider revocation, billing handling, retention rules, and audit status.
- Storage MIME/aggregate quota enforcement and App-level generated-media authorization.
- Dependency remediation and a repeatable security scan gate.
- Admin MFA/recent-auth policy and one authoritative role source.

The Settings screen currently offers an honest account-summary download and a support-mediated deletion request. It no longer pretends that signing out deletes an account.

## 7. Dodo Payments

Implemented payment design:

- Checkout is created only for an authenticated Firebase uid.
- The old anonymous checkout endpoint redirects to sign-in before money is accepted.
- `DODO_API_KEY` and `DODO_WEBHOOK_SECRET` are bound with Firebase `defineSecret`.
- Webhooks verify the Standard Webhooks HMAC, require a fresh timestamp, and store `webhook-id` transactionally for idempotency.
- Subscription events validate configured Dodo product IDs before mapping to Pro/Max.
- Provider event time prevents older events from replacing newer state.
- Customer, subscription, payment, product, period, and status identifiers are persisted when present.
- `on_hold`, active, renewal, plan-change, cancelled, failed, and expired states fail closed or update entitlement without duplicate quota resets.
- Paid users can create an authenticated Dodo customer-portal session.
- A checkout return URL displays “verification pending”; it is not treated as proof of payment.

The local ignored Functions environment was detected as `DODO_MODE=live`. No provider request or transaction was sent during this audit. Product prices, business/KYC activation, live webhook registration, test/live secret separation, provider reconciliation, upgrades/downgrades, refunds/disputes, and the full sandbox matrix are external release gates.

Official implementation references:

- https://docs.dodopayments.com/developer-resources/webhooks
- https://docs.dodopayments.com/developer-resources/webhooks/intents/subscription
- https://docs.dodopayments.com/features/customer-portal
- https://docs.dodopayments.com/api-reference/customers/create-customer-portal-session

## 8. Video-generation assessment

The current video paths are wrappers around Veo, not autonomous production-grade agents.

Implemented SDK repair:

- A typed shared helper lives under `functions/src/video/`.
- It sends `outputGcsUri`, polls with `getVideosOperation({ operation })`, and consumes the returned generated-video URI.
- It validates the returned GCS bucket/prefix, source/output MIME, poll bounds, and safety-filter reasons.
- Avatar preview duration is a supported eight seconds.
- Network-free contract tests cover the request shape, polling, returned URI, path escape, timeout, and safety filtering.

Remaining launch blockers:

- Provider operation IDs and leases are not persisted in a recoverable job state machine.
- A crash/timeout can lose a paid operation or resubmit it.
- Atomic cost reservation/refund/idempotency is incomplete across automation, preview, and legacy UGC paths.
- The 45–60 second script/templates do not fit an eight-second Veo scene.
- Product and multi-photo avatar fidelity claims exceed the actual reference inputs.
- Legacy “Remotion rendering” stores project JSON rather than rendering MP4 video.
- Likeness rights, minors/public-figure policy, moderation, disclosure, and media QA need formal gates.

Recommended model roles: Veo for short b-roll/scenes; a dedicated avatar/lip-sync plus TTS pipeline for talking heads; real Remotion/FFmpeg assembly for multi-shot 30–60 second exports.

## 9. SEO and authority context

### Keyword research snapshot (2026-07-15)

No paid keyword-volume/keyword-difficulty provider is configured, so no numerical search volume or difficulty is claimed.

| Keyword | Intent | Competition / recommended role |
|---|---|---|
| `AI agent for marketing` | Commercial/category | Strong homepage/product-page fit; specialized SaaS competitors dominate |
| `marketing with AI` | Broad informational | High competition; build an evidence-led pillar guide and supporting tutorials |
| `marketing agents` | Category/comparison | Commercial and ambiguous; create a product/category comparison page |
| `AI agency near me` | Local service | Poor homepage fit for a global SaaS product; never fake a LocalBusiness/location. Use an honest software-vs-local-agency comparison, or a real Hyderabad service page only if that service exists |

The public landing now includes:

- Targeted title, description, canonical, robots controls, OG/Twitter metadata.
- Organization, WebSite, SoftwareApplication, and matching visible FAQ structured data.
- Natural keyword use in the hero and FAQ without doorway/location stuffing.
- Static prerendering so crawlers receive the product copy in initial HTML.
- Correct sitemap URLs (no hash fragments), crawler-friendly `robots.txt`, and `llms.txt`.
- `noindex, nofollow, noarchive` on app/admin HTML and hosting headers.
- Truthful product/pricing copy; fake testimonials, fake outcome metrics, placeholder links, and fake analytics were removed from rendered experiences.

Google may understand FAQ markup, but FAQ rich-result visibility is not expected for a normal SaaS site. Structured data must always match visible content.

### Live baseline before these working-tree changes

Measured against `https://magicboxai.in` on 2026-07-15:

- Lighthouse mobile: Performance 67, Accessibility 84, Best Practices 100, SEO 100.
- FCP 2.6s, LCP 3.9s, TBT 610ms, CLS 0, Speed Index 4.2s.
- Accessibility failures included button names, color contrast, and target size.
- Vercel response was HTTP 200 with roughly 0.30s observed total response time.
- The deployed HTML was client-only/stale relative to this repo and did not include the new structured/crawlable body.
- A PageSpeed API call hit quota and did not produce a second dataset.

Local landing production JS was reduced from the previous main/Lottie combination (roughly 673 KB uncompressed across those chunks) to one roughly 232 KB / 72 KB gzip entry, and the HTML is now prerendered.

### Index/backlink/domain baseline

Public web searches for `site:magicboxai.in` and exact-domain mentions did not surface a defensible owned index/backlink footprint. “MagicBox” is also ambiguous with unrelated brands. No numeric backlink count or domain rating is claimed without Search Console and a backlink provider such as Ahrefs/Moz/Semrush.

Top placement cannot be guaranteed by metadata. The durable strategy is crawlability, clear intent-specific pages, original evidence/case studies, trusted relevant links, and measured iteration through Search Console.

Useful primary references:

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

## 10. Firebase → Convex migration plan

The target is **Convex**. Use a strangler migration; do not rewrite all data, jobs, auth, media, and payments at once.

### Principles

1. Fix and test authorization, entitlements, and job invariants in Firebase first. A migration must not copy current security bugs.
2. Keep Firebase Auth initially. Integrate it through `ConvexProviderWithAuth`/custom OIDC only after verifying exact `iss` and `aud`; Convex requires its configured domain/application ID to match those token claims.
3. Use stable Firebase uid/subject as the cross-system user key, never email.
4. Keep GCS for generated media in the first migration phase. Convex File Storage URLs are bearer URLs and do not automatically expire; authorization-sensitive delivery needs an HTTP action or a dedicated object store/CDN strategy.
5. Define explicit auth/ownership checks in every public Convex query/mutation/action. Firestore rules do not carry over.
6. Use one authoritative Dodo webhook consumer. Store/replay an event ledger and outbox; never let Firebase and Convex independently grant entitlement.
7. Measure row counts, key checksums, state-machine counts, and provider IDs before every cutover; retain a rollback window.

### Target Convex model

- Typed schema and indexes for users, brands, social accounts/token references, automations, posts, post destinations, subscriptions, payment events, usage ledger, video jobs, and audit events.
- Queries for reactive app reads.
- Authenticated mutations for tenant-scoped writes.
- Internal mutations/actions for provider calls, AI, and payment transitions.
- Scheduled functions/cron for reconciliation and stuck-job recovery.
- Durable video jobs with leases and `queued → reserved → submitting → running → validating → completed|failed|cancelled`.

### Six-month sequence

- **Month 1 — Stabilize:** finish Firebase P0 tests, schema contracts, provider fakes, entitlement ledger, job state machine, and production observability.
- **Month 2 — Foundation:** add Convex dev/preview/prod, auth adapter, schema/indexes, typed domain package, read-only backfill tooling, and comparison dashboards.
- **Month 3 — Read migration:** backfill users/brands/accounts/automations/posts, mirror new changes, compare counts/checksums, and switch low-risk reads behind flags.
- **Month 4 — Mutation/job migration:** port server-authorized writes, reactive post state, scheduled actions, retries/leases/DLQ, and video orchestration. Keep provider tokens and GCS tightly scoped.
- **Month 5 — Billing/media:** make the durable Dodo ledger authoritative in one system, evaluate Dodo’s official Convex component, migrate images where appropriate, and keep/stream video through the chosen GCS/CDN strategy.
- **Month 6 — Cutover:** shadow traffic, canary users, staged write/read switch, reconciliation, rollback drill, backup/restore drill, then decommission only proven-unused Firestore/Functions paths. Firebase Auth may remain longer.

Official references:

- https://docs.convex.dev/auth/advanced/custom-auth
- https://docs.convex.dev/scheduling/cron-jobs
- https://docs.convex.dev/file-storage/overview
- https://docs.convex.dev/database/import-export/import
- https://docs.dodopayments.com/developer-resources/convex-component

## 11. Design language

The user app uses an editorial light system:

- Instrument Serif for display headings.
- Instrument Sans for body.
- JetBrains Mono for eyebrows/metrics.
- Warm off-white background, near-black ink, hairline borders, restrained radius.
- Purple is the single primary accent; green/amber/red are semantic statuses.
- Prefer `bg-background`, `bg-card`, `bg-secondary`, `text-foreground`, `text-muted-foreground`, `border-border`, and `brand` tokens over raw dark/glow classes.
- Motion should be subtle and respect usability/performance.

## 12. Environment and deployment inventory

Never commit or print secret values.

Public frontend variables include Firebase web config and optional PostHog config. Old client-side Gemini/Razorpay variables were detected locally but are no longer referenced by source; remove and rotate them after confirming deployment history.

Server secrets:

- `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`
- `BREVO_API_KEY`
- `META_APP_ID`, `META_APP_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- `OAUTH_STATE_SECRET`

Non-secret Functions config includes app/landing/callback URLs, Dodo mode/business ID, and four Dodo product IDs. Test and live payment environments must use separate keys, products, webhook secrets, and Firebase projects.

## 13. Documentation policy

`Context.MD` is the source of truth for verified context. `NEXTSTEPS.md` is the source of truth for work and release gates.

The following are retained as exceptions rather than merged away:

- `marketing-agent/**/*.md`: operational/vendor skill structure; flattening breaks the package.
- `legal/*.md`: canonical, publishable legal source that needs counsel review.
- `README.md`: a small repository entry point should point to these canonical documents.

All other historical project Markdown files are superseded and listed as redundant candidates in `NEXTSTEPS.md`. They are intentionally not deleted.

The repository instruction references `@RTK.md`, but no `RTK.md` was found in this project or inspected parent path. Restore it or remove the pointer if additional instructions are expected.
