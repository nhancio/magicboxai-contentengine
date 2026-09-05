/**
 * Single source of truth for Gemini model ids.
 *
 * WHY THIS FILE EXISTS: `ai.ts` previously hard-coded `gemini-2.0-flash-001`,
 * which Google has since removed — every call 404s with "no longer available".
 * Model ids are a moving target, so they live in exactly one place: when the
 * next one is retired, this file is the only edit.
 *
 * Verified live against the configured GEMINI_API_KEY on 2026-07-17.
 */

export const MODELS = {
  /** Workhorse for captions, scripts, hooks. Newest GA flash. */
  text: "gemini-3.5-flash",
  /** Harder synthesis (trend briefs, multi-constraint planning). */
  textPro: "gemini-2.5-pro",
  /** Image generation (replaces the Imagen path for the Convex pipeline). */
  image: "gemini-3.1-flash-image",
  /** Text-to-video. Long-running (predictLongRunning) — see media.ts. */
  video: "veo-3.1-generate-preview",
  /**
   * Video generation WITH reference images — the generator Maya's replication
   * pipeline actually uses.
   *
   * Chosen over Veo for that path because, verified live on 2026-09-05 against
   * this deployment's key, it: accepts inline reference images and videos that
   * genuinely condition the output; returns 9:16 vertical WITH an audio track;
   * and completes in ONE synchronous call. Veo 3.1 on the Gemini Developer API
   * does none of those — its `referenceImages` are rejected on 9:16 renders,
   * its clips come back silent, and it needs long-running-operation polling.
   *
   * Reached through the Interactions API (POST /v1beta/interactions), NOT
   * generateContent — that endpoint 400s with "only supports Interactions
   * API". See lib/omni.ts.
   */
  omniVideo: "gemini-omni-1.1-flash",
  /**
   * Video *understanding* (not generation). Accepts video input, used to watch
   * a fetched reel and reverse-engineer a prompt that would recreate it —
   * see lib/maya/videoReference.ts.
   */
  videoAnalysis: "gemini-3.8-flash",
  /** Embeddings for Maya's duplicate-suggestion detection. */
  embedding: "gemini-embedding-001",
} as const;

/**
 * MUST stay in sync with the `suggestions.by_embedding` vectorIndex dimensions
 * in `schema.ts`. `gemini-embedding-001` defaults to 3072 but accepts an
 * explicit `outputDimensionality`; 768 keeps the index small and is verified.
 */
export const EMBEDDING_DIMS = 768;

/** Base URL for the Gemini (Google AI) REST API. */
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export function requireGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set on this Convex deployment. Set it with: npx convex env set GEMINI_API_KEY <key>",
    );
  }
  return key;
}

/** Base URL for the Monid (TikHub proxy) REST API. */
export const MONID_API_BASE = "https://api.monid.ai/v1";

export function requireMonidKey(): string {
  const key = process.env.MONID_API_KEY;
  if (!key) {
    throw new Error(
      "MONID_API_KEY is not set on this Convex deployment. Set it with: npx convex env set MONID_API_KEY <key>",
    );
  }
  return key;
}

export function requireFalKey(): string {
  const key = process.env.FAL_API_KEY;
  if (!key) {
    throw new Error(
      "FAL_API_KEY is not set on this Convex deployment. Set it with: npx convex env set FAL_API_KEY <key>",
    );
  }
  return key;
}
