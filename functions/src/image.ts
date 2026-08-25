import type { GoogleGenAI } from "@google/genai";
import { MODELS } from "./models";

/**
 * One place every Cloud Function renders an image.
 *
 * WHY THIS EXISTS: four call sites used to each call `generateImages` with
 * `imagen-3.0-generate-001`. Imagen is deprecated (shut down 2026-08-17), and
 * Nano Banana is a `generateContent` model — different request and response
 * shape — so the swap lives behind one helper instead of being repeated.
 *
 * Mirrors the Convex path (`convex/lib/gemini.ts#geminiImage`), which runs the
 * same model over REST.
 */
export type ImageAspectRatio = "1:1" | "9:16" | "16:9";

export async function renderImageBuffer(args: {
  ai: Pick<GoogleGenAI, "models">;
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  imageSize?: "1K" | "2K" | "4K";
}): Promise<Buffer> {
  const response = await args.ai.models.generateContent({
    model: MODELS.image,
    contents: args.prompt.slice(0, 8_000),
    // Nano Banana returns text alongside the image; both modalities are
    // requested and the text part is ignored below.
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: args.aspectRatio ?? "1:1",
        imageSize: args.imageSize ?? "1K",
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const data = parts.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!data) {
    throw new Error(`No image returned from ${MODELS.image}`);
  }
  return Buffer.from(data, "base64");
}
