/**
 * Single source of truth for Gemini model ids used by Cloud Functions.
 *
 * `gemini-2.0-flash-001` was removed by Google and 404s on Vertex
 * (projects/.../locations/us-central1/publishers/google/models/...).
 * Keep ids here so the next retirement is one edit.
 */
export const MODELS = {
  /** Captions, brand fetch, scripts — GA Flash on Vertex us-central1. */
  text: "gemini-2.5-flash",
} as const;
