"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODELS = void 0;
/**
 * Single source of truth for Gemini model ids used by Cloud Functions.
 *
 * `gemini-2.0-flash-001` was removed by Google and 404s on Vertex
 * (projects/.../locations/us-central1/publishers/google/models/...).
 * Keep ids here so the next retirement is one edit.
 */
exports.MODELS = {
    /** Captions, brand fetch, scripts — GA Flash on Vertex us-central1. */
    text: "gemini-2.5-flash",
    /**
     * Image generation. Nano Banana 2 — replaces `imagen-3.0-generate-001`,
     * since Imagen is deprecated and shuts down 2026-08-17. Note this is a
     * `generateContent` model, not a `generateImages` one: use
     * `renderImageBuffer` in `image.ts`, never `ai.models.generateImages`.
     */
    image: "gemini-3.1-flash-image",
};
//# sourceMappingURL=models.js.map