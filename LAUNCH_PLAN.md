# MagicBox — Launch Plan (single source of truth)

**Owner:** Nithin · **Company:** Nhancio Technologies Private Limited
**Last updated:** 2026-07-24
**Status:** pre-launch — CI red until the fix below lands; no public checkout until every P0 gate is green.

This is the **one** canonical plan. It consolidates the next-steps / tasks / goals that
were previously scattered across `launchplan.md`, `LAUNCH.md`, `nxtsteps.md`,
`CORE_WORKFLOW_PLAN.md`, `PERFORMANCE_PLAN.md`, `FUTURE_PLAN.md`, `PRICING.md`, and
`socials.MD`. It replaces the missing `NEXTSTEPS.md` that `README.md` / `Context.MD`
pointed at.

Deep operational runbooks are **not** duplicated here — this plan links to them:
- Deploy sequence → [`PRODUCTION.md`](./PRODUCTION.md)
- Firebase / App Check / rules → [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md)
- Channel OAuth provider steps → [`CHANNELS_SETUP.md`](./CHANNELS_SETUP.md)
- Security hardening detail → [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md)
- Verified architecture/context → [`Context.MD`](./Context.MD)
- AI prompt reference → [`SYSTEM_PROMPTS.md`](./SYSTEM_PROMPTS.md)

---

## Legend

| Symbol | Meaning |
| --- | --- |
| 👤 **You** | Needs an external console, credentials/secrets, KYC/banking, legal counsel, or a business decision. Claude cannot do it. |
| 🤖 **Claude** | Doable inside this repo: code, config, docs, local verification, CI. |
| 🤝 **Both** | Claude prepares/verifies in-repo; you supply the credential, approval, or production trigger. |

| Status | Meaning |
| --- | --- |
| ✅ | Done / verified in code |
| 🟡 | In progress or needs your input |
| 🔴 | Not started / blocking a gate |

---

## 0. Product decision that must be confirmed first (👤 You)

Two directions are described across the old docs and they **contradict each other**. Everything
below assumes the newer one. Please confirm:

- **Direction A — Social Automation (recommended, per `launchplan.md`, 24 Jul):** one brief →
  on-brand Instagram / LinkedIn / YouTube drafts → approve → schedule → publish. Plans: Free
  (draft only), **Pro $29/mo or $276/yr (60 posts/mo)**, **Max $149/mo or $1,416/yr (300 posts/mo)**.
  Do **not** launch the legacy avatar/video product.
- **Direction B — UGC video creator (older, per `PRICING.md` / `FUTURE_PLAN.md` / `socials.MD`):**
  avatars, viral templates, watermark, credit packs, Creator $29 / Pro $79. This is the legacy
  vision and is flagged as *not launch-safe*.

**Decision needed:** Confirm Direction A is the launch product (this plan assumes it). If yes,
`PRICING.md` / `FUTURE_PLAN.md` / `socials.MD` are superseded (see §10) and the UGC-video pricing
must not appear on the public site.

Also confirm (from `launchplan.md` §"Decisions needed"):
1. First ICP = solo B2B founders / one-person marketers on LinkedIn + Instagram.
2. First paid motion = guided paid beta (recommended) vs immediate self-serve Pro.
3. Named owner for support, refunds, and incident response.
4. Remove the managed-accounts section now (recommended) vs build a real staffed service first.

---

## 1. Release gate — no public checkout until all are green

Ordered by the sequence in your runbook. Each row links to its detailed section.

| # | Gate | Owner | Status | Blocking? |
| --- | --- | --- | --- | --- |
| G0 | **CI green on latest `main`** (see §2) | 🤖 → 👤 push | 🔴 fix ready, needs push | Yes |
| G1 | **Repo / docs are one source of truth** (§3) | 🤖 | 🟡 in progress | Yes |
| G2 | **App Check deployed + verified** (§4) | 🤝 | 🔴 | Yes |
| G3 | **Dodo live payments end-to-end** (§5) | 👤 | 🔴 | Yes |
| G4 | **Channel OAuth approved** for launched channels (§6) | 👤 | 🔴 (multi-week) | Yes |
| G5 | **Core journey verified on production** (§7) | 🤝 | 🔴 | Yes |
| G6 | **Legal + support/ops real** (§8) | 👤 + counsel | 🔴 | Yes |
| G7 | **Analytics + alerting live** (§9) | 🤝 | 🟡 | Yes |
| G8 | **Site is truthful + SEO tightened** (§10) | 🤖 → 👤 | 🟡 | Yes |
| G9 | **10–15 design partners, ≥5 willing to pay** (§12) | 👤 | 🔴 | Yes (before scale) |

---

## 2. G0 — CI green (🤖 Claude, then 👤 push)

**Current state:** CI is **red** on the last 5 commits. Root cause found and fixed locally.

- **Cause:** `packages/backend/.gitignore` ignored `convex/_generated/`, so the Convex-generated
  types were never committed. CI has no Convex codegen step (and `convex codegen` needs a deploy key),
  so `@convex/_generated/api` can't resolve in `apps/web` — failing `typecheck` and `build:hosting`
  and cascading into `implicit any` errors in `Library.tsx`, `Onboarding.tsx`, `Schedule.tsx`.
- **Fix:** removed the ignore rule and commit the `_generated` directory. This is exactly what the
  Convex CLI instructs ("this code … should be committed to the repo; your code won't typecheck
  without it"). `convex codegen` produced **no diff**, so the checked-in files are current.
- **Verified locally after fix:** `npm run typecheck` → PASS · `npm test` → 17/17 pass.
  (CI also runs the Playwright browser smoke + `npm audit --omit=dev --audit-level=high`, which
  only run in the GitHub runner.)

| Task | Owner | Status |
| --- | --- | --- |
| Root-cause the red CI | 🤖 | ✅ |
| Commit untracked `packages/backend/convex/_generated/` | 🤖 | 🟡 staged, awaiting your OK to push |
| Push to `main` and confirm all required workflows pass | 👤 (or 🤖 with your OK) | 🔴 |
| If any workflow still fails, capture the redacted log and fix | 🤖 | — |

---

## 3. G1 — One source of truth (🤖 Claude)

The old docs drifted and pointed at a non-existent `NEXTSTEPS.md`. This section fixes that.

| Task | Owner | Status |
| --- | --- | --- |
| Create this consolidated `LAUNCH_PLAN.md` | 🤖 | ✅ (this file) |
| Repoint `README.md` and `nxtsteps.md` from missing `NEXTSTEPS.md` → `LAUNCH_PLAN.md` | 🤖 | 🟡 |
| Reconcile / archive stale plans (`launchplan.md`, `LAUNCH.md`, `PRICING.md`, `FUTURE_PLAN.md`, `socials.MD`, `CORE_WORKFLOW_PLAN.md`, `PERFORMANCE_PLAN.md`) — see §10 map | 🤖 | 🔴 needs your archival preference |
| Fix the `@RTK.md` pointer referenced by repo instructions (file doesn't exist) | 🤖 | 🔴 |
| Remove retained historical body from `README.md` | 🤖 | 🔴 |

---

## 4. G2 — App Check (🤝 Both) — do before enforcing

Callables already **reject** requests without a valid App Check token, so this must be live before
production traffic. Detailed sequence in [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) and [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).

| Task | Owner | Status |
| --- | --- | --- |
| Create reCAPTCHA Enterprise site keys for `app.magicboxai.in` and `admin.magicboxai.in` | 👤 | 🔴 |
| Register the web + admin Firebase apps with their keys | 👤 | 🔴 |
| Add each public site key as `VITE_FIREBASE_APPCHECK_SITE_KEY` in the matching Vercel prod project | 👤 | 🔴 |
| Grant the Cloud Functions v2 runtime SA the **Firebase App Check Token Verifier** IAM role | 👤 | 🔴 |
| Confirm Firebase Auth allows only prod + deliberate dev domains | 👤 | 🔴 |
| Deploy browser clients first: `./deploy.sh` | 👤 (I verify build locally) | 🔴 |
| Confirm valid App Check traffic in Firebase metrics | 👤 | 🔴 |
| Deploy protection: `firebase deploy --only firestore:rules,storage,functions` | 🤝 | 🔴 |
| Confirm anonymous Firestore/Storage denied; no cross-tenant reads | 🤝 | 🔴 |
| Enable uniform bucket-level access **after** auditing/migrating legacy public GCS objects | 👤 | 🔴 |

---

## 5. G3 — Dodo live payments (👤 You)

Live and test use **separate** products, credentials, and webhooks. Never paste secrets in chat —
use `firebase functions:secrets:set …`. Webhook URL: `https://us-central1-magicboxai-50927.cloudfunctions.net/dodoWebhook`

| Task | Owner | Status |
| --- | --- | --- |
| Complete Dodo live KYC + bank/payout setup | 👤 | 🔴 |
| Create/copy Pro & Max products in **live** mode | 👤 | 🔴 |
| Set `DODO_PRODUCT_*`, `DODO_MODE=live`, `DODO_BUSINESS_ID` in prod Functions config | 👤 | 🔴 |
| Add the live webhook endpoint (URL above) | 👤 | 🔴 |
| Subscribe **all** subscription lifecycle events (activate, renew, plan change, hold, cancel, fail, expire) | 👤 | 🔴 |
| `firebase functions:secrets:set DODO_API_KEY` and `DODO_WEBHOOK_SECRET` | 👤 | 🔴 |
| One real low-value purchase → entitlement unlocks | 👤 | 🔴 |
| Test cancellation/refund → access changes correctly; customer portal works | 👤 | 🔴 |
| (Code) checkout + signed webhook + 4 products mapped | 🤖 | ✅ built |

> ⚠️ Without the webhook + `DODO_WEBHOOK_SECRET`, payments succeed but plans do **not** auto-activate.

---

## 6. G4 — Channel OAuth approvals (👤 You) — the long pole (weeks)

Live channel OAuth is on **Convex**, not Firebase Functions. Register this exact callback everywhere:
`https://beloved-lyrebird-288.convex.site/oauth/callback`. Store creds via `npx convex env set …`
(from `packages/backend/`) — full steps in [`CHANNELS_SETUP.md`](./CHANNELS_SETUP.md).

| Task | Owner | Status |
| --- | --- | --- |
| Register the exact Convex callback URL in Google, Meta, LinkedIn | 👤 | 🔴 |
| **Google/YouTube:** enable YouTube Data API v3; consent-screen branding (name `MagicBox`, homepage, privacy, terms, `support@magicboxai.in`); scopes `youtube.upload` + `youtube.readonly` only; remove all other scopes; submit verification | 👤 | 🔴 |
| **Instagram:** Instagram Login; request `instagram_business_basic` + `instagram_business_content_publish`; complete Meta App Review | 👤 | 🔴 |
| **LinkedIn:** create/link company app; enable Sign In w/ OIDC + Share on LinkedIn; scopes `openid profile w_member_social` | 👤 | 🔴 |
| Set channel secrets on Convex (`GOOGLE_OAUTH_*`, `META_APP_*`, `META_IG_APP_*`, `LINKEDIN_*`, `APP_BASE_URL`) | 👤 | 🔴 |
| Request YouTube quota increase (default ≈6 uploads/day for whole app) | 👤 | 🔴 |
| Verify OAuth connect + real publish per channel (browser round-trip) | 👤 | 🔴 blocked on creds |
| **Decision:** launch WITH channels (await reviews) vs WITHOUT (Skip flow, enable later) | 👤 | 🔴 |

---

## 7. G5 — Core journey + reliability (🤝 Both)

Documented run: sign-up → onboarding → brand brief → 3 drafts → approve → schedule → publish →
receipt/status → paid entitlement, per channel + a failure/retry path.

| Task | Owner | Status |
| --- | --- | --- |
| Run production-preview browser smoke suite | 🤖 (local) / CI | 🟡 |
| Manual end-to-end walkthrough on live consoles with real test accounts | 👤 | 🔴 |
| Enforce quota/entitlement on the **Convex** publish path before charging | 🤖 | 🔴 |
| Fix Instagram double-post idempotency (persist `creationId` per destination) | 🤖 | 🔴 |
| Add `httpRaw()`/`fetchBytes()` to `base.ts`; collapse provider duplication | 🤖 | 🔴 |
| Implement LinkedIn video via Videos API (currently text+image only) | 🤖 | 🔴 |
| Wire Veo generation into Convex (durable polling) | 🤖 | 🔴 |
| Add Post/Schedule button to VideoCreator UI (bridge `studio.createPost` exists) | 🤖 | 🔴 |
| Decide + execute Firestore↔Convex publish cutover so only one system publishes | 🤝 | 🔴 |
| Confirm crons fire on schedule (trends daily, maya hourly, publish 1-min) | 🤖 | 🟡 |
| Publishing recovery: stuck claims, partial success, idempotency, quota, OAuth expiry, operator replay runbook | 🤖 | 🔴 |

---

## 8. G6 — Legal + support/ops (👤 You + counsel)

Drafts exist at `legal/terms-of-service.md` and `legal/privacy-policy.md` (published as
`/terms.html`, `/privacy.html`) but still carry placeholders.

| Task | Owner | Status |
| --- | --- | --- |
| Fill privacy policy with the full processor list (Google/Firebase, Dodo, Brevo, PostHog, Meta, LinkedIn, Google/YouTube, Vertex AI) | 🤖 draft | 🔴 |
| Confirm refund/cancellation terms + support email in drafts | 👤 | 🔴 |
| Counsel review: Terms, Privacy, refund/cancellation, subscription-renewal disclosures | 👤 + counsel | 🔴 |
| Counsel review: Dodo/payment wording, support contact, business identity, tax treatment | 👤 + counsel | 🔴 |
| Counsel review: data retention/deletion, AI/provider disclosures, subprocessor list | 👤 + counsel | 🔴 |
| Name incident owner + support escalation process; publish a status/incident route | 👤 | 🔴 |
| Full account export + deletion flow (reauth, token revocation, billing, retention) | 🤖 | 🔴 |

---

## 9. G7 — Analytics, alerting, and instrumentation (🤝 Both)

| Task | Owner | Status |
| --- | --- | --- |
| PostHog wired into web + landing (autocapture, SPA pageviews, identify) | 🤖 | ✅ |
| Consent-gated (GDPR) analytics + cookie banner | 🤖 | ✅ |
| Set `VITE_POSTHOG_KEY` (+ `VITE_POSTHOG_HOST`) in hosting env and redeploy | 👤 | 🔴 (no-ops until set) |
| Add funnel events (acquisition/activation/revenue/retention/reliability) from `launchplan.md` | 🤖 | 🔴 |
| Error tracking, uptime checks, cloud-cost/quota alerts, Dodo webhook-failure alerts | 🤝 | 🔴 |
| Daily review dashboard for first-week metrics | 👤 | 🔴 |

> Never send post text, OAuth tokens, or emails to analytics. Tie paid status to signed server-side
> payment events, not browser events.

---

## 10. G8 — Truthful site + SEO/GEO (🤖 Claude → 👤 approve)

| Task | Owner | Status |
| --- | --- | --- |
| Remove fabricated testimonials, logo marquee, fake "live examples", `example.com` links | 🤖 (you approve what stays) | 🔴 |
| Hide managed-accounts section until a real compliant service exists | 🤝 | 🔴 |
| Stop advertising unimplemented features (TikTok publishing, unlimited Max, analytics results) | 🤖 | 🔴 |
| Tighten landing `<title>` to ≈50–60 chars (currently 72) and description to ≈150–160 (currently 221) | 🤖 | 🔴 |
| Verify canonical, OG image 1200×630, Twitter large-image card, JSON-LD matches visible content | 🤖 | 🟡 (JSON-LD + OG present) |
| Fix landing accessibility failures (button names, color contrast, target size — Lighthouse a11y 84) | 🤖 | 🔴 |
| Ensure deployed landing serves the prerendered/crawlable HTML (live was stale/client-only) | 🤝 | 🔴 |
| Register Search Console / Bing / Brave; submit sitemap | 👤 | 🔴 |

---

## 11. Security hardening — status (mostly ✅, from `SECURITY_AUDIT.md`)

**Already done in code:** SSRF guard on brand import · timing-safe OAuth HMAC + one-time nonce + 303
redirect · callable origin allowlist + App Check enforcement · bounded AI/media calls + atomic Veo
quota · Firebase download tokens (no public ACLs) · Convex publish SSRF/ownership checks · upload
MIME/size limits · Vercel CSP/HSTS/anti-framing headers · Jimp 1.6.1 + CI audit gate + Dependabot ·
Firestore per-user rules (`socialTokens` locked) · Storage rules (users/{uid}/**, 10 MB cap).

**Still to do:**

| Task | Owner | Status |
| --- | --- | --- |
| Rotate every provider secret before launch (Gemini, Dodo, Meta, LinkedIn, Google OAuth, Post Bridge, Brevo, OAuth state) | 👤 | 🔴 |
| Rotate the Vercel token + Gemini key shared in chat earlier | 👤 | 🔴 |
| Remove/rotate stale client-side `VITE_GEMINI_API_KEY` (nothing reads it now) | 🤖 code + 👤 rotate | 🔴 |
| GitHub branch protection on `main` (PRs, required CI, 1 review, no force-push) | 👤 | 🔴 |
| Monitor Firebase Admin advisories; upgrade when a supported release resolves the 9 moderates | 🤖 | 🟡 |
| Review App Check / Function error / CSP telemetry for first week | 👤 | 🔴 |

---

## 12. G9 — Prove value before scale (👤 You)

Recruit 10–15 ICP design partners; ≥10 complete a first scheduled/published post; ≥5 willing to pay
or paid after a structured review. Guided onboarding calls; fix top-3 failures per cohort; interview
after first publish and at day 7. Do not scale channels until one has verified payback.

---

## 13. Post-launch backlog (P1 / P2 — not gating)

- In-app publish history w/ per-destination status, retries, human-readable errors.
- Help content per channel (connect, permissions, approval, billing, cancellation, failed posts).
- Onboarding: <15 min to first draft, <1 day to first verified publish.
- Durable cost/credit ledger + conservative video quotas **before** broad video generation.
- Case-study format + permission workflow for quotes/logos/screenshots.
- Affiliate/partner attribution before promising commissions.
- **Performance** (`PERFORMANCE_PLAN.md`): flip `minInstances` to 1 at launch; trim Firebase SDK
  imports; remove stray `apps/web/.vercel/`; prerender landing; route-level prefetch; async video
  generation; decide Remotion removal if legacy UGC is cut; drop unused Recharts.
- **Convex migration** (`Context.MD` / `PERFORMANCE_PLAN.md`): strangler, reads-first, sequenced
  after launch — schema+indexes, reactive reads, scheduler/writes, generation actions, then Dodo
  webhook + publishing cutover, then decommission Cloud Functions/Firestore.
- **Roadmap** (`FUTURE_PLAN.md`): only relevant if UGC-video direction is kept — treat as archived
  otherwise.

---

## 14. Ownership summary

### 👤 On you (external — I can't do these)
- App Check: reCAPTCHA Enterprise keys, app registration, Vercel site keys, IAM Token Verifier role.
- Run the production deploys (`./deploy.sh`, `firebase deploy`) with your logged-in CLIs.
- Dodo: KYC/bank, live products, webhook + events, `DODO_*` config, secrets, real purchase + refund test.
- Channel OAuth: enable APIs, consent screens, Meta/LinkedIn/Google review + verification, Convex secrets, quota increase.
- Legal counsel review; incident owner; support process.
- Rotate all secrets (incl. the Vercel token + Gemini key from chat); Firebase Auth domains; bucket-level access; GitHub branch protection.
- `VITE_POSTHOG_KEY` in hosting; Search Console + sitemap submit.
- Business decisions in §0 (product direction, ICP, paid motion, support owner, managed-accounts, launch-with/without-channels).
- Recruit design partners; content; Product Hunt.

### 🤖 On Claude (I can do these now)
- ✅ Fix red CI (commit Convex `_generated`) — done locally, awaiting push OK.
- ✅ This consolidated `LAUNCH_PLAN.md`.
- Repoint `README.md`/`nxtsteps.md`; reconcile/archive stale docs; fix `@RTK.md` pointer.
- Fill privacy-policy processor list (draft; counsel reviews).
- Site truthfulness edits + SEO title/description/a11y fixes.
- Funnel event instrumentation.
- Engineering (§7): Convex entitlement enforcement, IG idempotency, `httpRaw`/`fetchBytes`, LinkedIn video, Veo-in-Convex, Post/Schedule button.
- Remove client-side env-var references; perf cleanups; run local release-gate checks; monitor CI via `gh`.

### 🤝 Both
- App Check final `firebase deploy` (you set keys/role → I run/verify the sequence).
- Legal drafts (I fill → counsel reviews).
- Acceptance tests (I run smoke suite / CI → you do the live manual walkthrough).
- Firestore↔Convex publish cutover; alerting setup.

---

## 15. Consolidation map — where each old doc went

| Old doc | Disposition |
| --- | --- |
| `launchplan.md` | Folded into this plan → propose archive. |
| `LAUNCH.md` | Folded (done-items + gates) → propose archive. |
| `nxtsteps.md` | Broken pointer → repoint to this file. |
| `CORE_WORKFLOW_PLAN.md` | Folded into §7 → keep for engineering detail or archive. |
| `PERFORMANCE_PLAN.md` | Folded into §13 → keep as detailed perf/migration reference. |
| `FUTURE_PLAN.md` | Legacy UGC roadmap → archive unless Direction B is chosen. |
| `PRICING.md` | **Contradicts** launch pricing → archive/rewrite to Direction A. |
| `socials.MD` | Legacy UGC social GTM → archive. |
| `PRODUCTION.md`, `FIREBASE_SETUP.md`, `CHANNELS_SETUP.md`, `SECURITY_AUDIT.md`, `Context.MD`, `SYSTEM_PROMPTS.md` | **Kept** — operational runbooks / reference, linked from here. |
| `README.md` | Repoint canonical link here; trim historical body. |

> **Archival preference needed:** delete, move to `docs/archive/`, or leave with a "superseded → see LAUNCH_PLAN.md" banner?
