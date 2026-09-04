# MAYA-Templates

Meme-template engine: find trending **AI-generated** reels, rewrite them for a
brand, and voice/lip-sync the result.

## Where the code actually lives

The deployed pipeline runs as **Convex actions** in
`packages/backend/convex/mayaTemplates.ts` — jobs, credits, polling, rendering
and publishing all need the Convex runtime, so they can't live in a plain
package.

This folder is the standalone view of the **pure engine** (ingestion,
adaptation, TTS, lip-sync dispatch), runnable from a normal Node script. Each
module here **re-exports** the canonical implementation instead of copying it,
so there is exactly one source of truth and no drift:

| This package | Canonical implementation |
|---|---|
| `src/types.ts` | `convex/lib/maya/types.ts` |
| `src/curatedTemplates.ts` | `convex/lib/maya/curatedTemplates.ts` |
| `src/adaptationEngine.ts` | `convex/lib/maya/adaptationLogic.ts` |
| `src/monidService.ts` | `convex/lib/monid.ts`, `lib/maya/searchQueries.ts`, `lib/maya/aiContentFilter.ts` |
| `src/lipSyncService.ts` | `convex/lib/tts.ts`, `convex/lib/fal.ts` |

## Pipeline

```
Monid search  ->  AI-content filter  ->  Gemini adaptation  ->  TTS  ->  video
(trending      (vision classifier      (script, overlays,     (voice)   (dub /
 reels)         drops real-human            subtitles,                  lip-sync /
                footage)                    caption)                    Veo)
```

**Video modes**, chosen automatically by `dispatchVideoGeneration`:

- **`dub`** (default) — keeps the original reel, replaces its audio with the
  adapted script's voiceover, burns in overlays. No extra keys.
- **`lipsync`** — additionally re-syncs the speaker's mouth to the new audio
  via Fal.ai. Used automatically when `FAL_API_KEY` is set.
- **`veo_synthetic`** — discards the original footage and generates new video
  from the adapted prompt. Only when explicitly requested.

## Usage

```bash
npm install
npm test        # deterministic path only — no keys, no network
npm run demo    # live: hits Monid + Gemini
```

```ts
import { createAdaptedMemeReel } from "./src/index";

const { template, adaptation, usedAI } = await createAdaptedMemeReel({
  brand: {
    name: "Ownly",
    industry: "Food Delivery App",
    productOffering: "Curated Indian meals delivered in 20 minutes",
    targetCallToAction: "Order on Ownly today",
    colors: { primary: "#ff5f56", accent: "#ffbd2e" },
  },
  humorIntensity: "unhinged_brainrot",
});

console.log(adaptation.adaptedScript);   // what gets voiced
console.log(adaptation.subtitleCues);    // burned-in captions
console.log(adaptation.instagramCaption);
```

## Environment

Read from `process.env`; nothing is hardcoded. Each is independently optional —
the pipeline degrades rather than failing.

| Var | Without it |
|---|---|
| `GEMINI_API_KEY` | falls back to the deterministic synthesizer (and no TTS voiceover) |
| `MONID_API_KEY` | no live reel search; curated fallback set only |
| `FAL_API_KEY` | `dub` instead of true lip-sync |

For the deployed pipeline these are set on the Convex deployment
(`npx convex env set <NAME> <value>` from `packages/backend/`), plus
`RENDERER_URL` / `RENDERER_TOKEN` pointing at a reachable `apps/renderer`.
