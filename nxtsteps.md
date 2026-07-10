# MagicBox AI — production readiness checklist

**Purpose:** Track everything needed before this product is safe and reliable in production.

**Maintenance rule:** Whenever we ship a meaningful change (auth, security, deploy, data model, env vars, legal, etc.), **update this file** — check items off, add new ones, or move completed work to a “Done” section with dates.

---

## Product flow audit: avatar-to-UGC pipeline

Target flow:
`User signs in -> uploads up to 10 photos -> system creates avatar from facial features -> system shows preview video ("Hello, this is your avatar") -> user selects a template -> uploads product image + script -> output video shows avatar holding the product and speaking`

Current repo status:

| Status | Area | What exists now | Production gap |
|--------|------|-----------------|----------------|
| [~] | Sign-in | Google sign-in exists in `apps/web` via Firebase Auth. | Needs full production env validation and domain setup. |
| [~] | Photo upload | Avatar builder exists, but only supports **5** photos today. | Must support up to **10** photos, with clearer minimum/maximum rules and upload progress/retry handling. |
| [~] | Facial analysis | `analyzeAvatarPhotos()` exists, but currently analyzes only the **first** image. | No real multi-photo face aggregation, identity consistency checks, or avatar model training pipeline. |
| [ ] | Avatar generation | The app stores uploaded photos plus AI-generated text metadata. | There is no actual generated reusable avatar asset/model/persona beyond saved photos + description. |
| [~] | Preview video | UI expects a `generateAvatarVideo` function. | Backend does **not** implement `generateAvatarVideo`, so this preview flow is broken right now. |
| [~] | Product video scripting | Product script generation exists with Gemini prompts. | This is script generation, not a reliable rendered final video pipeline. |
| [~] | Product video rendering | There is a Veo-based `generateUGCVideo` backend function and a Remotion export path. | The main product flow in `VideoCreator` does not call `generateUGCVideo`; Remotion export currently writes a JSON project/fallback, not a guaranteed production MP4 renderer. |
| [ ] | Avatar holding product | Prompt mentions product presentation. | No controllable composition, pose system, or verified image-to-video pipeline that guarantees the avatar visibly holds the uploaded product. |
| [ ] | Video delivery | Records are saved in Firestore. | Saved `videos` docs do not consistently store final `videoUrl`, thumbnail, render job state, retries, or failure reason. |
| [ ] | Payments / quotas | Pricing page and subscription docs exist. | Current client-side subscription activation is not production-safe and lacks verified payment backend/webhook flow. |
| [ ] | Library consistency | Dashboard uses `photoAvatars` and `videos`. | `Library` / `ContentStudio` still use older `influencers` / `ads` model, so the product is mid-migration. |

Immediate implementation priorities:

| Priority | Item |
|---------|------|
| P0 | Add a real backend `generateAvatarVideo` job or remove the broken call and replace it with a real preview pipeline. |
| P0 | Decide the true avatar architecture: `photo-backed persona`, `image avatar`, or `consistent talking-head video avatar`. Right now the code mixes these concepts. |
| P0 | Redesign Firestore schema for avatar jobs and video jobs with statuses, asset URLs, and error fields. |
| P0 | Move payment activation and plan enforcement to trusted backend logic. |
| P1 | Expand avatar upload from 5 to 10 photos and analyze all submitted images, not just the first one. |
| P1 | Wire `VideoCreator` to a real final render pipeline that returns `videoUrl`, thumbnail, duration, and job status. |
| P1 | Unify app screens around `photoAvatars` / `videos`; retire the old `influencers` / `ads` paths. |
| P2 | Add moderation, abuse prevention, and consent checks for uploading faces and generating likeness-based videos. |

Known code-level blockers found in this repo:

| Severity | Item |
|---------|------|
| Critical | `apps/web/src/pages/AvatarCreator.tsx` calls `generateAvatarVideo`, but `functions/src/index.ts` does not export it. |
| Critical | `shared/lib/gemini.ts` only analyzes the first uploaded avatar image, so the requested “based on facial features in image(s)” behavior is not implemented. |
| Critical | `apps/web/src/pages/VideoCreator.tsx` saves generated scripts as completed videos before a final MP4 is actually guaranteed. |
| High | `functions/src/index.ts` `renderRemotionVideo` stores a JSON project file and marks status `completed`; it is not a true production renderer. |
| High | `apps/web/src/pages/Library.tsx` and `apps/web/src/pages/ContentStudio.tsx` still depend on the older `influencers` model, not the new avatar/video flow. |
| High | `apps/web/src/pages/Pricing.tsx` activates plans client-side after Razorpay checkout callback without backend payment verification or webhook reconciliation. |

---

## Security & authentication

| Status | Item |
|--------|------|
| [ ] | **Admin panel:** Replace hardcoded `admin123` / `admin123` with real auth (e.g. Firebase Auth with admin-only custom claims, or separate IdP + RBAC). |
| [ ] | **Admin session:** Move off “localStorage-only” if needed; consider httpOnly cookies or Firebase session with refresh + secure flags on production domains. |
| [ ] | **Firestore rules:** Deploy strict production rules (users own their docs; admin reads via Cloud Functions or custom claims — avoid wide-open `read, write` for `influencers` / `ads`). |
| [ ] | **Storage rules:** Lock down uploads/downloads; no public buckets unless intentional; align with Cloud Function paths (`users/{uid}/...`). |
| [ ] | **API keys:** Ensure no secrets in client bundles; OpenAI only in Cloud Functions secrets / server-side. |
| [ ] | **Authorized domains:** Add production domains in Firebase Console → Authentication → Settings. |
| [ ] | **CORS / callable functions:** Review `generateImage` (and any future functions) for allowed origins and abuse protection. |

---

## Firebase & backend

| Status | Item |
|--------|------|
| [ ] | **Production Firebase project:** Separate from dev/staging (recommended) or use distinct Firebase apps + env per environment. |
| [ ] | **`.env` on CI/hosting:** Configure `VITE_*` vars in Vercel/Netlify/Cloudflare (never commit `.env`). |
| [ ] | **Firestore indexes:** Create all composite indexes required by queries (console links from runtime errors). |
| [ ] | **Cloud Functions:** Deploy `functions/`; set `OPENAI_API_KEY` via `firebase functions:secrets:set`; verify billing and quotas. |
| [ ] | **Function hardening:** Rate limits, payload validation, cost caps, monitoring for `generateImage`. |
| [ ] | **Backups / export:** Optional scheduled Firestore exports for disaster recovery. |

---

## Apps: web, admin, landing

| Status | Item |
|--------|------|
| [ ] | **Error boundaries & UX:** User-friendly errors when Firebase is down or quota exceeded; avoid silent failures. |
| [ ] | **Loading / empty states:** Consistent across dashboards, library, avatars, ads. |
| [ ] | **Remove or gate “demo” flows:** e.g. Admin “reset demo data” / demo copy — disable or protect in production. |
| [ ] | **Landing:** Production SEO (meta, OG tags, sitemap, analytics consent if EU traffic). |
| [ ] | **PWA / offline (optional):** Only if product requires it. |

---

## Build, deploy & operations

| Status | Item |
|--------|------|
| [ ] | **DNS & TLS:** `magicboxai.in`, `app.*`, `admin.*` with valid HTTPS. |
| [ ] | **Hosting:** Deploy all three Vite apps (landing, web, admin) with correct env per app. |
| [ ] | **CI pipeline:** Lint + `tsc` + build for each app on PR; block merge on failure. |
| [ ] | **Versioning / changelog:** Tag releases; document breaking changes. |
| [ ] | **Monitoring:** Firebase Crashlytics (if mobile later), web vitals, error reporting (e.g. Sentry), uptime checks. |
| [ ] | **Logging:** Structured logs for Functions; avoid PII in logs. |

---

## Legal, privacy & compliance

| Status | Item |
|--------|------|
| [ ] | **Privacy policy** (data: Firebase, Google sign-in, OpenAI, analytics). |
| [ ] | **Terms of service** (acceptable use, generated content, liability). |
| [ ] | **Cookie / consent banner** if using non-essential cookies or certain analytics (esp. EU/UK). |
| [ ] | **DPA / subprocessors** if selling B2B or handling EU personal data at scale. |

---

## Quality & testing

| Status | Item |
|--------|------|
| [ ] | **Unit tests** for critical `shared/lib` (Firestore helpers, auth helpers). |
| [ ] | **E2E smoke tests** (login, one core flow per app) — Playwright or Cypress. |
| [ ] | **`npm audit`:** Address high/critical vulnerabilities; document accepted risks. |
| [ ] | **Accessibility:** Keyboard nav and contrast on main flows (WCAG target). |

---

## Performance & cost

| Status | Item |
|--------|------|
| [ ] | **Bundle size:** Analyze Vite build output; lazy-load heavy routes. |
| [ ] | **Firestore reads/writes:** Audit hot paths; pagination for admin lists. |
| [ ] | **Image CDN / resizing:** If serving many large images from Storage. |
| [ ] | **Firebase & OpenAI budgets:** Alerts in Google Cloud + OpenAI usage caps. |

---

## Documentation (keep in sync with code)

| Status | Item |
|--------|------|
| [ ] | **README:** Deploy URLs, env var list, run scripts (`run_*.sh`). |
| [ ] | **FIREBASE_SETUP.md:** Update if rules, functions, or env names change. |
| [ ] | **This file (`nxtsteps.md`):** Update after each production-related change. |

---

## Done (move items here when finished)

_Format: `- [x] YYYY-MM-DD — short description`_

- [x] 2026-07-10 — Pivoted product to "MagicBox Suite": enterprise social marketing automation (prompt → AI content/image → auto-post to Instagram/Twitter/LinkedIn on schedules).
- [x] 2026-07-10 — New Firestore collections (`socialAccounts`, `brandProfiles`, `automations`, `posts`) with rules + composite indexes; server engine in `functions/src/{scheduler,generation,callables,postbridge,quota,schedule-math}.ts` (3 Cloud Scheduler ticks: create → generate → publish, with retries/backoff and idempotent slot keys).
- [x] 2026-07-10 — Post Bridge integration behind `POST_BRIDGE_API_KEY` Functions secret; runs in dry-run sandbox mode until the key is set (`firebase functions:secrets:set POST_BRIDGE_API_KEY`).
- [x] 2026-07-10 — New web UI: onboarding wizard (`/onboarding`), automations list + creation wizard with live platform previews, real calendar (`/calendar`), posts lifecycle + approval queue (`/posts`), brand kit (`/brand`), reworked dashboard and Settings connected-channels; marketing-agent skill pack distilled into `functions/src/prompts/marketingPrompts.ts`.
- [x] 2026-04-09 — Added backend callables for avatar preview generation, Razorpay order verification, and video job updates.
- [x] 2026-04-09 — Upgraded avatar creation flow to support 5-10 photos with multi-photo analysis and reusable storage paths.
- [x] 2026-04-09 — Rewired video generation to create queued jobs and only mark success after a final `videoUrl` is returned.
- [x] 2026-04-09 — Unified web Library and Content Studio screens around `photoAvatars` and `videos`.

---

## Quick reference — env vars (web & admin)

See `.env.example` and `FIREBASE_SETUP.md`. Production hosting must inject:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Add new `VITE_*` variables to **`.env.example`**, **README**, **FIREBASE_SETUP.md** (if relevant), and **this checklist** when introduced.
