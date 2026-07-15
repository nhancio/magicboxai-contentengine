# MagicBox — Next Steps

**Canonical work and release plan**  
**Last verified:** 2026-07-15  
**Current verdict:** not production-ready for live billing, unattended publishing, or general-availability video  
**Migration target:** Convex

This document consolidates all open work from the previous roadmap, launch, production, pricing, Firebase, channel, performance, prompt, design, and social-strategy notes plus the 2026-07-15 repository audit.

## Status legend

- `[x]` implemented and locally verified in this working tree.
- `[ ]` open.
- **P0** blocks launch or can cause security, billing, data, or uncontrolled-cost harm.
- **P1** required for a reliable early production release.
- **P2** planned scale/product work.

## Completed in the 2026-07-15 production pass

- [x] Baseline typechecks/builds for landing, web, admin, and Functions.
- [x] Landing static prerendering/hydration; crawlers receive visible product content in initial HTML.
- [x] SEO title/description/canonical/robots/OG/Twitter metadata for the researched keyword set.
- [x] Organization, WebSite, SoftwareApplication, and visible FAQ structured data.
- [x] Correct sitemap, expanded crawler policy, `llms.txt`, and app/admin `noindex`.
- [x] Removed rendered fake testimonials, fake outcome metrics, placeholder company/social links, fake analytics, fake admin logs/trends/status, and fake admin settings actions.
- [x] Replaced landing Lottie CTA with lightweight UI; local entry is about 232 KB / 72 KB gzip.
- [x] Lazy-split admin routes and vendor chunks.
- [x] Added hosting security headers for Firebase and Vercel configs.
- [x] Fixed protocol-relative login redirect validation.
- [x] Replaced fake account deletion with an honest support-mediated request and renamed the limited export to account summary.
- [x] Aligned rendered pricing claims with enforced post limits: Pro 60, Max 300.
- [x] Disabled anonymous paid checkout; visitors authenticate before checkout.
- [x] Bound Dodo API/webhook secrets through Firebase Secret Manager parameters.
- [x] Added Dodo signature freshness, transactional event-ID idempotency, product mapping, ordering guard, provider IDs/statuses, and customer portal.
- [x] Checkout return no longer claims success before the signed webhook confirms it.
- [x] Corrected the installed Veo SDK integration and added typed GCS/poll/safety validation.
- [x] Added network-free Dodo/Veo contract tests.
- [x] Added Playwright production-build smoke coverage and GitHub Actions CI.
- [x] Applied non-breaking dependency remediation: critical/high findings reduced from 1 critical + 5 high to zero; 9 moderate transitive findings remain.
- [x] Hardened core automation tenant/account/brand validation, manual-post boundary, publishing entitlement, retries, and Firestore client permissions.
- [x] Consolidated verified context into `Context.MD` and work into this file.

## P0 — Release blockers

### P0.1 Deployment and environment isolation

- [ ] Create separate Firebase/GCP/Dodo **test** and production environments. The detected local Dodo mode is live; automated verification must never target it.
- [ ] Deploy the current Functions, rules, indexes, Storage rules, and all three frontend builds to a staging project.
- [ ] Configure secrets in Secret Manager and non-secret environment values from `functions/.env.example`.
- [ ] Remove/rotate stale client `VITE_GEMINI_API_KEY` and `VITE_RAZORPAY_KEY_ID` values after checking deployment history.
- [ ] Restore the missing `RTK.md` instruction file or remove the dangling instruction.

Acceptance criteria:

- Staging uses test product IDs/keys/webhook secret and cannot charge real money.
- Production secrets are not in `.env`, bundles, logs, Git history, or CI output.
- Deployment is reproducible from CI and a tagged commit.

### P0.2 Payment gateway validation

- [ ] In Dodo test mode, verify the four products, USD prices, billing intervals, tax behavior, business ID, KYC/live state, return URL, and webhook registration.
- [ ] Run signed fixtures: valid, invalid signature, missing header, stale timestamp, duplicate ID, distinct duplicate lifecycle events, and out-of-order events.
- [ ] Run lifecycle cases: new authenticated monthly/annual checkout, activation delay, renewal, `on_hold`, payment recovery, cancellation now/end-of-period, expiry, plan change, refund, dispute, webhook outage, replay, and reconciliation.
- [ ] Verify exactly one entitlement transition per provider event and no usage reset on duplicate active/payment events.
- [ ] Verify customer portal cancellation/payment update and prevent a second subscription for an already-active user.
- [ ] Add scheduled provider reconciliation for missed webhook delivery and alert on webhook lag/failure.
- [ ] Decide/implement annual-plan monthly allowance resets independent of annual renewal.
- [ ] Migrate or manually reconcile any legacy `pendingEntitlements` before retiring the collection.

Acceptance criteria:

- Provider dashboard, webhook event ledger, and Firestore subscription agree on uid/customer/subscription/product/status/period.
- All gated operations fail closed when status is not exactly active or period has expired.
- A human-approved $0/test-mode end-to-end transaction has recorded evidence; no live charge is used as CI.

### P0.3 Tenant, publishing, and media security

- [ ] Add Firebase App Check enforcement to expensive/user-mutating callables after measuring legitimate clients.
- [ ] Add per-user/IP rate limits, payload size schemas, concurrency caps, budget alarms, and circuit breakers for AI calls.
- [ ] Finish DNS/IP validation on every redirect for website extraction and any remote-media fetch: block IPv4/IPv6 private, loopback, link-local, metadata, encoded IP, rebinding, large bodies, and slow responses.
- [ ] Replace generated-media `makePublic()` ACLs with authenticated/signed/CDN delivery and define retention/deletion cascades.
- [ ] Make Storage rules split create/update/delete and enforce MIME/type/path/size plus aggregate plan storage.
- [ ] Persist/consume OAuth state nonce exactly once and compare signatures with `timingSafeEqual`.
- [ ] Add admin MFA/recent-auth requirements and one authoritative normalized role source.
- [ ] Add rule/emulator tests for foreign IDs, immutable usage, direct ready/scheduled posts, provider/token mismatch, and media ownership.

Acceptance criteria:

- Cross-tenant IDs and storage paths perform zero external provider/AI calls.
- No client can mutate billing, usage, lifecycle state, token, or another tenant’s object.
- SSRF tests cover redirects, DNS resolution, IPv6, metadata hosts, body limits, and timeouts.

### P0.4 Scheduler and external side effects

- [ ] Add leases/claim timestamps and recovery for posts stuck in `generating` or `posting` after a crash.
- [ ] Persist per-account destination states; retry only failed/pending destinations after partial success.
- [ ] Add provider reconciliation/idempotency to avoid duplicate external posts after “provider succeeded, process crashed.”
- [ ] Make quota reservation and post creation one transaction/idempotent service.
- [ ] Move sequential tick work to bounded fan-out/queue jobs with backlog metrics and DLQ.
- [ ] Default automations to human approval until moderation and provider policy checks are proven.

Acceptance criteria:

- A forced crash at every state transition recovers without an infinite retry, duplicate bill, duplicate post, or stuck record.
- Backlog/load tests meet a documented throughput SLO.

### P0.5 Video feature gate and cost safety

- [ ] Keep general-availability video disabled or explicitly beta/manual until the durable job system is complete.
- [ ] Implement `videoJobs` state machine: `queued → reserved → submitting → running → validating → completed|failed|cancelled`.
- [ ] Persist provider operation name, model/version, prompt hash/version, lease, attempt, cost reservation, timestamps, safety result, and output URI before/after each side effect.
- [ ] Atomically reserve a conservative credit/currency budget before provider submission; define refunds/retries; apply to automation, preview, UGC, regeneration, and concurrent calls.
- [ ] Replace 45–60 second script prompts for an eight-second scene with structured beats: hook 0–2s, demo 2–6s, CTA 6–8s.
- [ ] Use actual supported product/character reference media; do not claim multi-photo identity or product fidelity from text analysis alone.
- [ ] Render real multi-shot MP4 output with Remotion/FFmpeg or remove the JSON-as-video legacy route.
- [ ] Add likeness consent, minor/public-figure restrictions, prompt/input/output moderation, disclosure, and human approval.
- [ ] Add `ffprobe` QA for MP4 validity, duration, 9:16, resolution/FPS, audio presence, plus a 20–50 brief golden quality benchmark.

Acceptance criteria:

- Refresh/crash/resume/cancel/retry never resubmits a completed paid operation.
- Worst-case monthly provider cost per plan remains below an approved gross-margin budget.
- Paid smoke generation runs only in a budget-capped test project with manual approval.

### P0.6 Compliance and truthful UX

- [ ] Implement a complete authenticated data export job across Firestore, media inventory, profile, brands, automations, posts, subscription, and audit metadata.
- [ ] Implement recent-auth account deletion with active-billing resolution, provider token revocation, data/media deletion, legally required billing retention, retryable job status, and audit receipt.
- [ ] Obtain counsel review of `legal/*.md` and published HTML: entity/contact, refund/cancellation, processors, international transfers, AI disclosures, deletion/retention, and Dodo merchant-of-record terms.
- [ ] Verify every landing/security claim against implementation; remove “encrypted,” “all systems operational,” SLA, outcome, or unsupported integration language.

Acceptance criteria:

- A staging user can export and delete, with documented retained records and no orphaned provider access/token/media.
- Published legal HTML is generated from counsel-approved canonical source.

### P1.7 Dependencies

- [x] Remediated all critical/high/low findings and the React Router advisory with compatible updates.
- [ ] Resolve the remaining 9 moderate findings in the Firebase Admin dependency tree. The advertised full fix requires Firebase Admin 14 / Node 22, while Functions currently targets Node 20; plan and test that runtime/major upgrade rather than forcing it.
- [ ] Upgrade deliberately with provider/auth/rules/browser regression tests; do not use an unreviewed force upgrade or an incompatible ESM-only UUID release.
- [ ] Add lockfile policy, SBOM, secret scan, and dependency scanning to CI.

Acceptance criteria:

- Maintain zero known critical/high production vulnerabilities and document the Node 22/Firebase Admin 14 upgrade window for the remaining moderates.

### P0.8 External channel approval

- [ ] Meta business verification/app review for `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, and required business scopes.
- [ ] LinkedIn product access for OpenID Connect and `w_member_social`.
- [ ] Google OAuth consent verification for `youtube.upload`/`youtube.readonly`; request YouTube quota increase beyond the default project budget.
- [ ] Register exact OAuth callback URLs and validate connect, refresh/expiry, disconnect/revoke, and publish for each provider.
- [ ] Launch with unsupported channels visibly disabled; X and TikTok must not be advertised as direct publishing.

## P1 — Production reliability

### Tests and CI

- [ ] Run and keep green the current unauthenticated production-build Playwright suite on every PR.
- [ ] Add Firebase emulator auth/rules tests and Functions service tests.
- [ ] Add provider fakes/contract fixtures for Instagram, LinkedIn, YouTube, Dodo, Brevo, Gemini, Imagen, and Veo.
- [ ] Add authenticated E2E: sign-in/onboarding/skip, brand create/update, connect callback, automation create/edit/pause/resume/run, approval/retry/cancel, calendar/library, quota, billing portal, export/delete, and admin authorization.
- [ ] Add controlled sandbox canaries per provider; never put paid/irreversible provider calls in ordinary CI.
- [ ] Add lint/format rules, bundle budgets, Firestore index checks, and preview deployment checks.

### Observability and operations

- [ ] Structured logs with correlation IDs and redaction; stop logging full prompts, scripts, request bodies, emails, provider tokens, or operation payloads.
- [ ] Exception tracking plus alerts for scheduler failures/backlog/job age, webhook lag/failure, provider error rates, quota/cost anomalies, and auth/admin events.
- [ ] Real health checks. Never infer “all systems operational” from a rendered UI.
- [ ] Backup/restore, webhook replay, reconciliation, incident, key rotation, and rollback runbooks.
- [ ] Define SLOs: checkout activation, post scheduling delay, publish success by provider, generation latency, stuck jobs, and support response.

### Product consistency

- [ ] Move plan IDs, prices, allowances, feature claims, and Dodo product mapping into one typed domain/config package used by landing, app, backend, email, and tests.
- [ ] Remove the outdated “7-day unlimited trial” and old Starter/Growth/Scale language from email unless intentionally reintroduced.
- [ ] Finish real provider-backed analytics or keep the honest unavailable state.
- [ ] Decide whether the legacy avatar/UGC product returns; isolate it as a separate build/module or migrate/delete it after data and legal review.
- [ ] Implement LinkedIn video upload or clearly keep LinkedIn text/image only.

## P1 — SEO, GEO, performance, and authority

### Technical verification after deployment

- [ ] Deploy the prerendered landing and confirm View Source contains hero/FAQ text, canonical, schema, and crawler files.
- [ ] Validate schema; remember normal SaaS FAQ markup is not expected to earn FAQ rich results.
- [ ] Run mobile Lighthouse/WebPageTest from at least two regions and compare to baseline: Performance 67, A11y 84, LCP 3.9s, TBT 610ms, CLS 0.
- [ ] Fix remaining button-name, color-contrast, touch-target, font, and animation issues; target Lighthouse ≥90 performance and ≥95 accessibility with lab and field confirmation.
- [ ] Connect Google Search Console and Bing Webmaster Tools, submit the sitemap, inspect canonicals, request indexing, and monitor crawl errors/Core Web Vitals.
- [ ] Add privacy-safe conversion events for signup, onboarding, channel connect, automation created, checkout started, and webhook-confirmed activation.

### Search-intent page plan

- [ ] `/ai-agent-for-marketing/`: commercial product page with a real workflow, supported channels, approval/control, limitations, pricing, and demo.
- [ ] `/marketing-with-ai/`: people-first pillar guide with examples, review checklist, safety, measurement, and links to tutorials.
- [ ] `/marketing-agents/`: category/comparison page explaining agent vs scheduler vs agency, with verifiable feature matrix.
- [ ] `AI agency near me`: do **not** create fake location doorway pages or LocalBusiness schema. Publish an honest software-vs-agency guide; create a Hyderabad/local service page only if the company truly offers that service/address.
- [ ] Add real use-case and integration pages only after the feature exists; every page needs unique evidence, screenshots, author/reviewer, updated date, internal links, canonical, and conversion path.
- [ ] Publish original research: anonymized workflow benchmarks, channel API guides, automation failure/recovery studies, and transparent video quality evaluations.

### Backlinks/domain authority plan

- [ ] Establish the real baseline in Search Console plus one backlink provider; record indexed URLs, referring domains, followed links, brand mentions, and top queries. Do not invent DR/DA.
- [ ] Earn links through original data/tools, provider/integration documentation, customer case studies with consent, partner directories, credible launch profiles, and expert commentary.
- [ ] Reclaim unlinked brand mentions and broken links; use descriptive internal anchors and canonical URLs.
- [ ] Avoid paid link schemes, mass guest-post networks, fake reviews, generated local pages, and reciprocal-link farms.
- [ ] 90-day measurable target: all canonical pages indexed, no manual actions, ≥10 relevant referring domains, and first non-brand impressions/clicks for the three aligned topics.
- [ ] 180-day target: ≥30 relevant referring domains, ≥4 evidence-led content clusters, improving top-20 query count and qualified organic signup conversion. Reforecast from actual Search Console data.

Top placement is an objective, not a guarantee. Review rankings monthly by country/device, update content from real query data, and prioritize qualified conversions over vanity rank.

## Six-month Firebase → Convex execution plan

### Month 1 — Stabilize Firebase contracts

- [ ] Complete all P0 auth/payment/job tests and freeze typed schemas/events.
- [ ] Introduce `packages/domain`, `packages/config`, and test fixtures without changing persistence behavior.
- [ ] Inventory/export every collection/index/function/scheduler/trigger/storage path and its owner/retention.
- [ ] Define migration SLOs, data checksums, flags, rollback owner, and go/no-go criteria.

Gate: Firebase behavior is tested enough to distinguish migration bugs from existing bugs.

### Month 2 — Convex foundation

Scaffolded in `packages/backend` (new `packages/*` workspace), running alongside Firebase. Decision: **Convex Cloud, free Starter tier** through migration; upgrade to Professional ($25/dev/mo) only at cutover. Not self-hosting.

- [x] Create isolated Convex dev/preview/prod deployments and budget/access policy. _(dev deployment `beloved-lyrebird-288` (project `magicboxai`) live; schema + 20 indexes pushed; `FIREBASE_PROJECT_ID` env set; `users.me`/`brands.list`/`posts.list` deployed. Still to do: separate preview/prod deployments + budget alerts.)_
- [x] Add `convex/schema.ts`, indexes, internal/public function conventions, audit table, and environment validation. _(schema mirrors Firestore with `legacyId` backfill keys; `paymentEvents`/`apiLogs` audit tables; scheduler indexes; typechecks clean.)_
- [x] Integrate Firebase Auth through a custom Convex auth adapter; verify exact issuer and audience and stable uid mapping. _(`convex/auth.config.ts` validates `securetoken.google.com/<project>` issuer + audience; project id from `FIREBASE_PROJECT_ID` env.)_
- [x] Prototype read-only users/brands/posts and authorization tests. _(`users.me`, `brands.list`, `posts.list` via `requireUid()` fail-closed helper; test pass pending live deployment codegen.)_
- [ ] Build idempotent Firestore export → JSONL transform → Convex import tooling; Convex data import is beta, so pin/test CLI behavior.

Gate: foreign-tenant tests fail closed; dev backfill counts/checksums match.

### Month 3 — Read path and backfill

- [ ] Backfill in dependency order: users → brands/accounts → automations → posts/destinations → subscriptions/events → legacy decision set.
- [ ] Mirror new Firebase changes through an outbox/change process, not uncontrolled client dual-writes.
- [ ] Add comparison jobs for count, key checksum, state distribution, orphan references, timestamps, and provider IDs.
- [ ] Switch low-risk reads behind per-user feature flags; monitor mismatch and latency.

Gate: ≥99.99% record/checksum agreement and zero authorization regression for a defined soak window.

### Month 4 — Writes and durable jobs

- [ ] Port server-authorized brand/automation/post mutations and reactive subscriptions.
- [ ] Port scheduling to internal mutations/actions with leases, idempotency, retry policy, DLQ, and reconciliation.
- [ ] Implement durable video jobs and cost ledger in Convex; no blocking 450-second user callable.
- [ ] Keep social OAuth token access server-only and encrypt/restrict at the application layer.

Gate: shadow writes/jobs produce equivalent state without external duplicate side effects.

### Month 5 — Payments and media

- [ ] Choose one authoritative Dodo webhook cutover. Evaluate `@dodopayments/convex`, but preserve the tested event ledger and product mapping invariants.
- [ ] Replay historical payment events into preview, reconcile provider IDs, then switch endpoint once with rollback routing.
- [ ] Keep GCS for video first. Migrate images to Convex storage only after bearer-URL/privacy requirements are accepted; use controlled delivery for private assets.
- [ ] Implement deletion/export across both stores during the transition.

Gate: provider/old/new entitlement states match; one webhook consumer grants access.

### Month 6 — Canary, cutover, decommission

- [ ] Canary internal users, then 1%/10%/50%/100% by stable uid flag with explicit rollback triggers.
- [ ] Run load, chaos, provider outage, webhook replay, backup/restore, and rollback drills.
- [ ] Stop Firebase writes only after soak and reconciliation; retain read-only backup/export for the approved window.
- [ ] Decommission only proven-unused Functions/rules/indexes/data; Firebase Auth may stay until a separate auth migration succeeds.
- [ ] Publish final architecture, runbooks, cost/performance comparison, and incident ownership.

Gate: signed launch review covering data, security, billing, cost, performance, support, and rollback.

## Safe code reorganization sequence

Do not mass-move files before tests protect behavior. Target:

```text
packages/
  domain/          Types, schemas, plan catalogue, state machines
  ui/              Shared components, tokens, assets
  config/          Validated public/server configuration
  firebase-client/ Temporary typed Firebase repositories during migration
apps/web/src/
  app/             Router/providers
  features/        auth, brands, channels, automations, posts, billing, settings
  legacy/          Isolated avatar/UGC feature if retained
functions/src/
  config/
  domain/
  modules/         automations, posts, billing, users
  integrations/    Dodo, Brevo, Instagram, LinkedIn, YouTube
  ai/              Gemini, Imagen, video, moderation
  legacy/
convex/
  schema.ts, auth.config.ts, crons.ts, domain modules
```

Sequence: tests → domain/config packages → feature folders → thin Firebase exports → Convex alongside → cutover. Preserve compatibility exports while moving code.

## Redundant candidates — list only, do not delete

The owner must decide. No candidate is automatically safe to remove.

1. `.design-src/` and `optimus-the-ai-platform-to-build-and-ship.zip`: 97/97 files were reported hash-identical; keep at most one off-repo archive after provenance review.
2. `functions/src/postbridge.ts` plus `functions/lib/postbridge.*`: legacy Post Bridge client now replaced by direct provider OAuth/publishing. Retained for provenance; decide whether to archive after migration/export review.
3. Generated/local `.firebase/`, `.vercel/`, `.netlify/`, `dist/`, `dist-ssr/`, `.DS_Store`, and `.claude/settings.local.json`.
4. Five package lockfiles: choose a root-workspace versus independent-deploy lock policy.
5. `deploy.sh`: calls a previously missing build command; revalidate after root script changes.
6. `gitpush.sh`: blindly stages/commits/pushes the whole worktree.
7. `run_web.sh`, `run_admin.sh`, `run_landing.sh`: duplicate workspace commands/`run.sh` behavior.
8. `test-veo.mjs`: import smoke log, superseded by real contract tests.
9. `magicbox.jpeg`: unreferenced 100×100 logo candidate; verify design provenance.
10. Landing `metrics-section.tsx`, `testimonials-section.tsx`, `ai-influencer-section.tsx`, `api-mcp-section.tsx`, `managed-accounts-section.tsx`, `infrastructure-section.tsx`, landing `assets/lottie/rocket.json`, and web `src/assets/lottie/*.json`: no longer rendered or imported; retain until content/design decision.
11. Recharts dependencies after removal of fake analytics/charts, if no remaining import after final audit.
12. Legacy avatar/UGC pages, Remotion compositions/helpers, callables, and collections if the pivot is permanent. Requires business, export, retention, and migration decision.
13. Duplicate plan/type/prompt definitions across landing/web/backend/email/docs; centralize before deleting compatibility definitions.
14. Historical project docs now superseded by `Context.MD` and this file: `FIREBASE_SETUP.md`, `FUTURE_PLAN.md`, `PRICING.md`, `PRODUCTION.md`, `SYSTEM_PROMPTS.md`, `CHANNELS_SETUP.md`, `LAUNCH.md`, `PERFORMANCE_PLAN.md`, `socials.MD`, `nxtsteps.md`, and `apps/web/DESIGN_SYSTEM.md`.

Retain `marketing-agent/**/*.md` as an operational knowledge-pack structure and `legal/*.md` as standalone legal source. Do not flatten either into one runtime-breaking file.

## Decisions needed from the owner

- [ ] Is MagicBox strictly the marketing automation suite, or will avatar/UGC return as a separately priced product?
- [ ] Launch only after provider approvals, or launch creation/approval without direct publishing first?
- [ ] Approve the Pro/Max limits and a conservative video gross-margin budget.
- [ ] Choose Firebase Hosting or Vercel as the sole frontend deployment source of truth.
- [ ] Choose support/contact/calendar URLs and publish real company/social profiles before linking them.
- [ ] Approve counsel, processor list, refund/cancellation policy, data retention, and AI likeness policy.
- [ ] Approve Convex environments/budget and whether Firebase Auth remains for the full six-month migration.

## Release sign-off checklist

- [ ] All P0 items accepted with evidence.
- [ ] CI/typecheck/build/unit/rules/browser suites green from a clean checkout.
- [ ] Zero unresolved critical/high dependency findings or signed exception.
- [ ] Dodo sandbox lifecycle matrix and one manual test transaction pass.
- [ ] Provider sandbox connect/publish/revoke canaries pass.
- [ ] Video either safely gated or passes durable job/cost/safety/quality gates.
- [ ] Legal/counsel approval and real support process in place.
- [ ] Monitoring, alerting, budgets, backups, restore, reconciliation, incident, and rollback drills pass.
- [ ] Search Console/sitemap/canonical/schema/live performance verified after deployment.
- [ ] Owner signs the launch scope, pricing, channels, and legacy-feature decision.
