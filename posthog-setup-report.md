# PostHog setup report

**Summary:** PostHog browser analytics was added to the existing Vite/React monorepo, with authenticated identity, nine product events, web error tracking, and a starter dashboard.

## Verified by this run

- The repository is an npm-managed TypeScript/React monorepo; no Python application runtime or Python manifest was found, so the Python SDK was not installed.
- The existing shared browser analytics singleton in `shared/lib/analytics.ts` now initializes from `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`. Initialization remains consent-gated and optional when configuration is absent. SDK autocapture and session recording use defaults; explicit disabling overrides were removed.
- `apps/admin/src/main.tsx` initializes the shared analytics singleton; landing and web already used it.
- The real environment values were configured in the root `.env` through wizard tools. `.env.example` documents `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`.
- `npm install` completed successfully.
- `npm run typecheck` passed for landing, web, admin, and functions.
- `npm run build` passed for landing, web, admin, and functions.
- No lint script is defined.
- Firebase UID identification is wired in `apps/web/src/App.tsx` and `apps/admin/src/contexts/AdminAuthContext.tsx`; logout resets analytics. Events inherit the authenticated identity and do not pass a distinct ID directly.
- Web React error-boundary tracking was added through `captureException` in `apps/web/src/components/ErrorBoundary.tsx`, backed by the shared helper. Landing and admin had no existing global React boundary discovered, so no equivalent wiring was added there.
- The dashboard was created with four tagged insights using a 30-day range: [Analytics basics (wizard)](https://us.posthog.com/project/497712/dashboard/1933907).

## Events instrumented

The following nine capture calls were added. The run verified their source call sites and event contract, but did **not** observe events arriving in PostHog.

| Event | What it measures | File |
|---|---|---|
| `avatar_created` | A signed-in creator successfully saves an avatar after creation completes. | `apps/web/src/pages/AvatarCreator.tsx` |
| `ugc_copy_generated` | A signed-in creator successfully generates UGC copy from an avatar and settings. | `apps/web/src/pages/ContentStudio.tsx` |
| `video_generated` | A signed-in creator successfully renders an avatar video. | `apps/web/src/pages/VideoCreator.tsx` |
| `video_hooks_generated` | A signed-in creator successfully generates hook suggestions for a video concept. | `apps/web/src/pages/VideoCreator.tsx` |
| `carousel_generated` | A signed-in creator successfully generates a branded carousel. | `apps/web/src/pages/Carousel.tsx` |
| `carousel_saved_to_library` | A signed-in creator successfully saves a generated carousel as a library draft. | `apps/web/src/pages/Carousel.tsx` |
| `brand_kit_scanned` | A signed-in creator successfully extracts brand details from a website. | `apps/web/src/pages/BrandKit.tsx` |
| `brand_kit_saved` | A signed-in creator successfully saves an extracted brand kit. | `apps/web/src/pages/BrandKit.tsx` |
| `social_channel_connect_started` | A signed-in creator starts connecting a social publishing channel. | `apps/web/src/pages/Settings.tsx` |

Event properties were limited to non-PII operational metadata such as platform, tone, source type, preview status, and slide count. User-entered content, URLs, names, and emails were excluded.

## What remains unconfirmed

- No app startup, test run, or live user workflow was performed. A passing typecheck/build proves compilation only; it does not prove that any event, exception, or identify call was delivered to PostHog.
- The dashboard may initially be empty until real traffic arrives.
- Session recording, autocapture, and error delivery were configured in code but not observed in a running deployment.

## Follow-up issues

- **Python guidance versus application reality:** the requested Python reference applies to a Python SDK, but this repository contains no Python application runtime. The implemented integration is browser-side TypeScript. Treating the Python smoke test as an analytics source would leave product events uninstrumented.
- **Coverage gap:** error tracking is wired only to the web React boundary. Landing and admin errors outside any discovered boundary remain unconfirmed and may not be captured by this integration.
- **Delivery attribution remains unverified:** event delivery and authenticated attribution were not exercised in a live session, so failures in deployment-time environment injection or consent state could leave events absent despite passing builds.

## Before you merge

- [ ] Run the full production build and fix any lint or type errors introduced by generated code; the recorded review passed `npm run build` and `npm run typecheck`, but no post-report verification was run.
- [ ] Run the test suite and update any mocks or fixtures affected by the new analytics calls.
- [ ] Confirm `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` are present in every deploy environment, not only the local root `.env`; check `shared/lib/analytics.ts:9-10,233-250` and `.env.example`.
- [ ] In an authenticated web session, exercise each instrumented workflow and confirm the nine event names arrive in PostHog with the expected Firebase UID; inspect the call sites in `apps/web/src/pages/AvatarCreator.tsx:657,834`, `ContentStudio.tsx:109`, `VideoCreator.tsx:271,300`, `Carousel.tsx:170,242`, `BrandKit.tsx:120,189`, and `Settings.tsx:317`.
- [ ] Verify the returning authenticated visitor path still identifies the user rather than creating an anonymous identity; inspect `apps/web/src/App.tsx:52-73` and `apps/admin/src/contexts/AdminAuthContext.tsx:27-80`.
- [ ] Trigger a handled React render error in web and confirm Error Tracking receives it; inspect `apps/web/src/components/ErrorBoundary.tsx:35` and `shared/lib/analytics.ts:280-282`.
