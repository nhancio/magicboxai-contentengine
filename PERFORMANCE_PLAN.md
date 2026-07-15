# MagicBox — Performance & Convex Migration Plan

**Created:** 2026-07-14 · verified against actual code.
Companion to `NEXTSTEPS.md` / `LAUNCH.md`. This doc covers speed + the backend migration; those cover launch ops.

---

## 1. Verified stack

| Layer | What it is | Evidence |
|-------|-----------|----------|
| Frontend | 3 × Vite 5 + React 18.3 SPAs (`landing`, `web`, `admin`), React Router 6, Tailwind, Radix, framer-motion, recharts, lottie-react, Remotion | `apps/*/package.json`, `apps/web/src/App.tsx` |
| Hosting | Firebase Hosting (3 targets). Stray `apps/web/.vercel/` output also present | `.firebaserc`, `firebase.json` |
| Backend API | Firebase Cloud Functions v2 (Node 20, TS): `onCall` callables + Cloud Scheduler 3-tick engine + Dodo webhook | `functions/src/*` |
| Data | Firestore (per-user docs, rules locked) | `firestore.rules`, `firestore.indexes.json` |
| Media | Firebase Storage / GCS. Imagen → base64 → Storage → `makePublic()`; Veo writes video directly to bucket | `functions/src/index.ts`, `core.ts` |
| AI | `@google/genai` — Gemini (captions), Imagen (images), Veo 3.1 (video) | `functions/src/generation.ts`, `index.ts` |

**Note:** the `magicbox-suite-pivot` memory is stale — Post Bridge and Razorpay were removed; publishing is now direct APIs (IG/LinkedIn/YouTube) and payments are Dodo.

---

## 2. Lagging areas (measured)

### Frontend (`apps/web/dist/assets`, uncompressed)
- **908 KB core chunk** on every page load — Firebase full SDK + framer-motion + Radix + `Dashboard` (eagerly imported in `App.tsx:13`).
- **312 KB "empty" Lottie chunk** — oversized for an empty-state animation.
- **383 KB recharts** (Analytics, already lazy) and **281 KB Remotion** (VideoCreator, lazy + flag-gated) — acceptable but heavy.
- **Dead deps:** `@remotion/renderer`, `@remotion/cli` in `apps/web` deps but never imported client-side.
- All CSR: no prerender/SSR even for the marketing landing (worst for SEO/LCP).

### Backend
- **No `setGlobalOptions`** — no `minInstances`, default region → cold starts on interactive callables (`generateImage`, `generateScript`).
- **Blocking long-running callables** — `generateVideoFromImage` polls Veo `30 × 15s` inside a 540s `onCall` (`functions/src/index.ts:384`), holding a 1–2 GiB instance while the client waits. Legacy avatar/UGC path only; Suite uses async ticks (good).
- Scheduler runs `every 5 minutes` (`scheduler.ts`) → up to 5 min latency floor between create → generate → publish.

---

## 3. Performance plan (phased)

### Phase 0 — Quick wins ✅ DONE 2026-07-14 (verified: functions `tsc` clean, `build:web` passes)
1. ✅ **Dropped dead deps** — removed `@remotion/renderer` + `@remotion/cli` from `apps/web/package.json`.
2. ✅ **Manual chunking in `vite.config.ts`** — `firebase`, `motion`, `charts`, `remotion`, `lottie`, `radix`, `react-vendor` split into independently-cached chunks.
3. ✅ **Lazy-loaded `Dashboard` + `Onboarding`** in `App.tsx` (were eager; Onboarding was pulling lottie into the initial graph).
4. ✅ **Lazy-loaded lottie-react** inside `shared/components/ui/lottie.tsx` — lottie-web (~317 KB) now loads only when an animation renders, not at startup.
5. ✅ **`setGlobalOptions`** added in `functions/src/core.ts` — region pinned `us-central1`, `maxInstances: 10` cost cap. `minInstances` intentionally left at 0 (see note) — flip to 1 at launch to kill cold starts.
6. ✅ **Long-cache headers** for `/assets/**` (immutable, 1yr) on all 3 Firebase Hosting targets in `firebase.json`.

**Result — `apps/web` initial entry chunk: 908 KB → 85 KB (gzip 26 KB).** Heavy libs are now separate/lazy: `firebase` 504 KB, `react-vendor` 188 KB, `charts` 383 KB (Analytics-only), `lottie` 317 KB (on-demand), `remotion` 171 KB (legacy-flag routes only). Still open for Phase 1: trim the 504 KB firebase chunk and decide Remotion's fate.

> Not done (deliberately): removing the stray `apps/web/.vercel/` dir (build artifact, left alone); enabling `minInstances` (paid always-on — flip at launch).

### Phase 1 — Structural frontend (≈1 week)
7. **Trim the Firebase SDK** — ensure only `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/functions` are imported (no `firebase/analytics`, etc.); confirms tree-shaking of the 908 KB core.
8. **Decide the fate of Remotion** (ties to `NEXTSTEPS.md` P2). If legacy avatar/UGC is cut, remove `remotion` + `@remotion/player` from `apps/web` entirely — largest single win.
9. **Prerender the landing** — it's a static marketing SPA; add `vite-plugin-ssg`/prerender or move to a static export for real LCP + SEO (supports `LAUNCH.md` §2 SEO goals).
10. **Route-level data prefetch** — kick off Firestore reads on route enter instead of after mount, to remove the request waterfall.

### Phase 2 — Backend latency (≈few days)
11. **Make video generation async** — convert `generateVideoFromImage` from a blocking poll to: enqueue → return job id → Cloud Tasks / scheduled poll → write result → client subscribes. Frees instances and removes client-side timeouts. (This is the exact pattern Convex makes trivial — see §4.)
12. **Tighten scheduler cadence where it matters** — the 5-min tick is fine for posting, but consider a faster/event-driven generation tick so users see results sooner.

---

## 4. Convex.dev migration plan

**Goal:** replace Firestore + the polling/callable model with Convex's reactive DB + serverless functions, and store generated media more efficiently.

### 4.1 Why Convex fits this app
- **Reactive queries** replace manual Firestore listeners and, crucially, the **client polling for video/post status** — the UI subscribes to a `posts`/`jobs` query and updates live as ticks progress.
- **Actions + scheduler** (`ctx.scheduler.runAfter`, cron) natively express the 3-tick engine and the long Veo poll as durable async jobs — no more 450s blocking callables.
- **File storage** (`ctx.storage`) gives CDN-served blob URLs for images/short videos, with the file id stored on the record.

### 4.2 Media strategy (the honest part)
- Convex File Storage **is** suitable for Imagen images and 8s Veo clips (returns a served URL; store the `storageId` on the post). This satisfies "store data including videos more efficiently" for the current short-clip sizes.
- **Caveat:** Veo currently writes **directly to GCS**. Two options:
  - **A (simplest):** keep Veo → GCS, store the public URL + metadata in Convex. Least migration risk; Convex still owns all structured data + reactivity.
  - **B (fully in Convex):** after generation, stream the file from GCS into `ctx.storage.store()` and drop the GCS copy. Cleaner single-store model; watch egress + large-file limits if clip length grows. For long-form video later, front it with a dedicated video host (Mux/Cloudflare Stream) and keep only the reference in Convex.
- **Recommendation:** start with **A**, move generated images fully into Convex storage, revisit B once clip sizes/volume are known.

### 4.3 Data model mapping
| Firestore | Convex |
|-----------|--------|
| `users/{uid}` doc | `users` table keyed by auth subject |
| `automations` (status, nextRunAt) | `automations` table + index `by_status_nextRun` |
| `posts` (status, scheduledFor, nextAttemptAt) | `posts` table + indexes mirroring `firestore.indexes.json` |
| `socialTokens` (locked) | `socialTokens` table, server-only access via internal functions |
| Storage refs | `_storage` ids or external URL field on the record |

Convex indexes are declared in `schema.ts` — port the 5 composite indexes from `firestore.indexes.json` directly.

### 4.4 Function mapping
- `generateImage` / `generateScript` / `analyzeImage` → Convex **actions** (they call external AI; actions can do network I/O). Keep `@google/genai` calls; secrets via Convex env vars.
- `scheduler.ts` 3 ticks → Convex **crons** + `scheduler.runAfter` chains; idempotency via deterministic ids (already the pattern).
- `dodoWebhook` → Convex **httpAction** (verify signature identically).
- `publishing.ts` (IG/LinkedIn/YouTube) → actions, unchanged logic.

### 4.5 Auth
Convex supports Firebase Auth as an OIDC provider — **keep Firebase Auth**, point Convex at it. Avoids re-doing login and lets you migrate data/functions without touching the sign-in flow.

### 4.6 Phased rollout (strangler pattern)
1. **Stand up Convex** alongside Firebase; wire Firebase Auth as the identity provider. No user-facing change.
2. **Port read models first** — mirror `posts`/`automations` into Convex; switch the web app's *reads* to reactive Convex queries (kills polling). Dual-write from functions during transition.
3. **Port writes + the scheduler engine** to Convex crons/actions; retire the Cloud Scheduler ticks.
4. **Port generation actions** (Gemini/Imagen/Veo); move images into Convex storage (media strategy A).
5. **Cut over the webhook + publishing**, then decommission Cloud Functions + Firestore.
6. Keep GCS only if staying on media-strategy A.

### 4.7 Risks / watch-items
- **Media egress + large-file limits** in Convex (see 4.2) — the main reason not to naively dump long videos in.
- **Vendor migration effort** vs. current "resolved launch blockers" — this competes with shipping; sequence it *after* launch unless data-model pain is blocking.
- **Two systems during transition** — dual-write discipline needed to avoid drift.

---

## 5. Recommended sequencing

1. **Now (pre/at launch):** Phase 0 quick wins + Phase 2 #11 (async video). High impact, low risk, no rewrite. Complements open `NEXTSTEPS.md` P1/P2 items (rate-limits, App Check).
2. **Post-launch:** Phase 1 frontend structural (Remotion decision, landing prerender).
3. **When data/reactivity pain justifies it:** the Convex migration (§4), strangler-style, reads-first.

Convex is the right long-term backend for the reactive/scheduled nature of this product, but **the Phase 0/2 wins deliver most of the felt speed-up without waiting on a migration.**
