# @magicbox/backend — Convex foundation

Month 2 of the Firebase → Convex migration (see [`../../LAUNCH_PLAN.md`](../../LAUNCH_PLAN.md)).
This runs **alongside** Firebase; nothing here changes the live Firestore backend yet.

## Decision: Convex Cloud (free Starter tier)

- **Dev/preview/migration:** free Starter tier — 1M function calls, 0.5 GiB DB,
  1 GiB DB + 1 GiB file bandwidth per month. Enough because the heavy compute
  (Veo/Gemini) is external and media stays in GCS/Blob, not Convex storage.
- **Cutover:** upgrade to Professional ($25/dev/mo, 250M calls) only when real
  live traffic + reactive dashboards push past the free call budget.
- **Not self-hosting:** it re-creates the Postgres/backup/scaling ops burden we
  are leaving Firebase to escape.

## First-time setup (you run these — they need your login)

```bash
# from repo root
npm install                       # installs the convex dep in this workspace

cd packages/backend
npx convex login                  # opens browser; authenticates to Convex Cloud
npx convex dev                    # creates a dev deployment + writes convex/_generated
```

`convex dev` generates `convex/_generated/` (typed API + server bindings). These
files are **committed** to the repo (the web/admin apps import `@convex/_generated/api`
and CI has no Convex deploy key), so a fresh checkout already has them. Re-run
`convex dev` / `convex codegen` and commit the diff whenever the Convex functions change.

Then wire the Firebase auth bridge:

```bash
npx convex env set FIREBASE_PROJECT_ID magicboxai-50927
```

## Layout

- `convex/schema.ts` — tables mirroring Firestore, with `legacyId` for backfill.
- `convex/auth.config.ts` — validates Firebase ID tokens (issuer + audience).
- `convex/lib/auth.ts` — `requireUid()`; every tenant function fails closed.
- `convex/users.ts`, `brands.ts`, `posts.ts` — read-only prototype queries.

## Maya meme templates (`convex/mayaTemplates.ts`)

Brand-adapts viral meme templates and generates video: ingest (Monid, curated
fallback) -> adapt (Gemini) -> TTS + lip-sync onto the original clip -> Remotion
composite. Set these on the Convex deployment:

```bash
npx convex env set MONID_API_KEY <key>     # trending reel ingestion; falls back to curated templates if unset
npx convex env set FAL_API_KEY <key>       # lip-sync (fal-ai/sync-lipsync); falls back to a synthetic Veo render if unset
npx convex env set RENDERER_URL <url>      # apps/renderer deployment, e.g. https://renderer.example.com/api/render
npx convex env set RENDERER_TOKEN <secret> # must match apps/renderer's RENDERER_TOKEN
```

`GEMINI_API_KEY` (already required for the rest of the app) covers both the
script adaptation and the TTS voiceover — no separate ElevenLabs account needed.
`apps/renderer` isn't deployed anywhere by default; see `apps/renderer/Dockerfile`.

## Next (Month 3)

- Firestore export → JSONL transform → `convex import` backfill tooling.
- Comparison jobs: counts, checksums, orphan refs, state distribution.
- Switch low-risk reads behind per-user feature flags.
