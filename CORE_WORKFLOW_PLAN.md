# MagicBox — Core Workflow (Studio · Maya · Channels)

**Built:** 2026-07-17 · **Backend:** Convex (`dev:beloved-lyrebird-288`)
**Status vocabulary follows `Context.MD`:** Verified / Implemented / External.

---

## 1. What changed

The core loop — *create content → post or schedule it → do it automatically every
day* — now exists end-to-end in **Convex**. Firebase Functions remain for billing
(Dodo) and as the legacy path; all new workflow logic is Convex-native, per the
Convex-first decision.

```
apps/web (Vite/React)
  └── ConvexProviderWithAuth  ← bridges the EXISTING Firebase auth into Convex
        │  Firebase ID token → Convex customJwt (issuer/audience already configured)
        ▼
packages/backend/convex/
  schema.ts        + trends, suggestions (768-d vector index), slotTemplates,
                     contentPillars, mayaConfig, oauthStates
  lib/
    models.ts      ← ONE place for Gemini model ids
    gemini.ts      ← text / JSON-mode / grounding / embeddings (raw fetch, retry)
    bestTime.ts    ← per-platform slot templates + timezone-correct next-open-slot
    presets.ts     ← THE canonical Studio preset catalogue
    providers/
      types.ts     ← SocialProvider interface + typed errors
      base.ts      ← BaseProvider: retrying http + limit validation
      registry.ts  ← the only place platforms are enumerated
      instagram · facebook · linkedin · youtube · twitter(deferred) · reddit(deferred)
  trends.ts        ← daily: live web trends → normalized rows
  maya.ts          ← daily: pillars × trends → 5 posts → embed → vector-dedup → deck
  studio.ts        ← presets → copy → THE BRIDGE (post now / schedule / draft)
  social.ts        ← connect URL, one-time nonce state, disconnect
  http.ts          ← /oauth/callback + /health
  publish.ts       ← per-destination fan-out + typed-error recovery
  scheduler.ts     ← lease-based claim, bounded retry, stuck-claim recovery
  crons.ts         ← trends(daily) · maya(hourly) · publish(1 min)
```

## 2. The two workflows

### Studio (manual)
`presets` → user picks a format and fills its inputs (avatar / context / images /
prompt / reference video) → `generateCopy` → generate media → **`createPost`**
with `mode: "now" | "schedule" | "draft"`.

`mode:"now"` publishes through *the same engine* the cron uses, so "post now" and
"scheduled" can never diverge. `mode:"schedule"` without an explicit time falls
into the same best-time queue Maya uses, so the two never fight over slots.

### Maya (autonomous)
Hourly cron → for users whose **local** time hits `reviewHourLocal - 2` →
load brand + pillars → pull today's trend brief → Gemini writes `dailyCount + 3`
candidates → embed each → **vector-dedup** against the user's own history
(cosine ≥ 0.85 = same idea, different words) → insert 5 as `pending`.

User swipes:
- **right** → bind to the next **open** best-time slot → create a real `scheduled`
  post → the publish cron takes it. *No date picker.*
- **left** → `discarded` (row **retained**) → that pillar's weight decays.

## 3. Design decisions worth keeping

| Decision | Why |
|---|---|
| One `SocialProvider` interface + registry | Firebase branched on platform literals in ~5 places; adding a channel meant editing all of them and silently failing if you missed one. Now: one file + one registry line. |
| Providers only **throw typed errors** | `RefreshTokenError` / `NotEnoughScopesError` / `BadBodyError` / `RetryableError` drive the engine's recovery. Platform code knows nothing about retries. |
| **Fan-out per destination** | IG succeeding while LinkedIn fails is a normal outcome, not a rollback. Each destination has its own status/permalink/error. |
| **Vector** dedup, not string | Suggestions repeat semantically. String matching never catches "5 tips for X" vs "X: five things". |
| Discards are **retained** | A left swipe is the only honest negative signal available. |
| Lease-based claiming | Convex mutations are serializable → two overlapping ticks cannot claim the same post. Expired leases are recovered (an explicit Firebase gap). |
| One-time OAuth nonce | Firebase used a replayable stateless HMAC state. `oauthStates` burns the nonce on use. |
| Model ids in one file | `ai.ts` pinned `gemini-2.0-flash-001`, which Google **removed** — it 404'd on every call. Now one edit when the next is retired. |

## 4. Verified live (not claimed — actually run)

- Gemini key valid; `gemini-3.5-flash`, `gemini-embedding-001` **@768 dims**
  (matches the vector index), and Google-Search grounding all return real data.
- `trends:refresh` → **68 real, cited trend rows** (Monsoon Aesthetics, FIFA World
  Cup 2026, AI Content Fatigue…) with **zero paid APIs**.
- `maya:generateForUser` → **5/5** trend-grounded, platform-native posts, each
  embedded and dedup-checked.
- Schema + 768-d vector index deployed.
- `social:catalogue` → 4 live (Instagram/Facebook/LinkedIn/YouTube), 2 deferred
  with honest reasons.
- `https://beloved-lyrebird-288.convex.site/health` → 200.
- `apps/web` typecheck **clean**; production build **succeeds**.

## 5. NOT yet verified (needs your credentials / a browser)

- **OAuth connect** — needs the app credentials in §6, then a browser round-trip.
- **Actual publishing** — needs a connected account. The code path is complete
  and typed but has never posted to a real platform.
- **The swipe UI in a browser** — needs Google sign-in.
- **Crons firing** — registered and deployed; they fire on schedule.

## 6. WHAT I NEED FROM YOU

### a) One click (unblocks YouTube trend enrichment)
Enable **YouTube Data API v3** on project `115005286326`:
https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=115005286326
then: `npx convex env set YOUTUBE_API_KEY <a key from that project>`
*(Maya already works without this — grounding covers it. This adds a free, legal
trending-topics source.)*

### b) Channel credentials (unblocks real posting)
Register this **exact** OAuth redirect URI in every provider console:

```
https://beloved-lyrebird-288.convex.site/oauth/callback
```

Then set, from `packages/backend/`:
```bash
npx convex env set META_APP_ID <id>              # Instagram + Facebook
npx convex env set META_APP_SECRET <secret>
npx convex env set LINKEDIN_CLIENT_ID <id>
npx convex env set LINKEDIN_CLIENT_SECRET <secret>
npx convex env set GOOGLE_OAUTH_CLIENT_ID <id>   # YouTube
npx convex env set GOOGLE_OAUTH_CLIENT_SECRET <secret>
npx convex env set APP_BASE_URL https://app.magicboxai.in
```
App-review requirements per platform are unchanged — see `CHANNELS_SETUP.md`.
**Instagram requires a Business/Creator account linked to a Facebook Page.**

### c) Rotate the Gemini key
It was pasted into chat, so treat it as exposed. Also `apps/web/.env` still has a
client-side `VITE_GEMINI_API_KEY` — `Context.MD` already flags that it should be
removed and rotated; nothing reads it from source any more.

### d) Deferred by your decision
**X (Twitter)** and **Reddit** are registered provider slots that throw
`ProviderDeferredError` with an honest reason. To enable either: implement the
documented TODO in its module, set its credentials, and delete the `deferred`
flag. The economics that drove deferral: X ≈ $0.015/post **+$0.20 if the post
contains a link**, no free tier; Reddit's free API forbids commercial use and the
commercial tier is ≈$12k/yr behind manual approval.

## 7. Known gaps / next

1. **Instagram double-post window.** `media_publish` isn't idempotent. If a retry
   happens after container creation, it can create a second container. Fix:
   persist `creationId` per destination and resume from it. *(Engine-level, not
   provider-level.)*
2. **`base.http` can't return headers or binary.** LinkedIn needs the
   `x-restli-id` response header; YouTube/LinkedIn need raw media bytes
   (`res.text()` corrupts them). Three providers hand-rolled bare `fetch` +
   duplicated the error mapping. Add `httpRaw()` / `fetchBytes()` to `base.ts`
   and collapse that duplication.
3. **LinkedIn video** throws `BadBodyError` (explicit, visible) instead of
   Firebase's silent text-only fallback. Needs the Videos API.
4. **Veo is not yet wired into Convex.** `veo-3.1-generate-preview` IS available
   on the current key via `predictLongRunning`. Convex's scheduler makes durable
   polling straightforward — and would fix the flagged Firebase bug where a crash
   mid-poll loses a paid operation. Studio currently accepts an existing media URL.
5. **VideoCreator still has no Post/Schedule button.** The backend bridge
   (`studio.createPost`) exists and is deployed; the UI needs to call it.
6. **Firestore ↔ Convex dual-write.** Legacy Firebase posting still exists.
   Decide the cutover; don't let both publish.
7. **Quota/entitlement checks** are not yet enforced on the Convex publish path
   (Firebase's `assertActivePublishingEntitlement` has no Convex equivalent).
   **Do this before charging anyone.**
