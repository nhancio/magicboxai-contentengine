# @magicbox/backend — Convex foundation

Month 2 of the Firebase → Convex migration (see `../../NEXTSTEPS.md`).
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

`convex dev` generates `convex/_generated/` (typed API + server bindings). Until
you run it once, `_generated` is absent and typecheck of this package is expected
to fail — that is normal for a fresh checkout.

Then wire the Firebase auth bridge:

```bash
npx convex env set FIREBASE_PROJECT_ID magicboxai-50927
```

## Layout

- `convex/schema.ts` — tables mirroring Firestore, with `legacyId` for backfill.
- `convex/auth.config.ts` — validates Firebase ID tokens (issuer + audience).
- `convex/lib/auth.ts` — `requireUid()`; every tenant function fails closed.
- `convex/users.ts`, `brands.ts`, `posts.ts` — read-only prototype queries.

## Next (Month 3)

- Firestore export → JSONL transform → `convex import` backfill tooling.
- Comparison jobs: counts, checksums, orphan refs, state distribution.
- Switch low-risk reads behind per-user feature flags.
