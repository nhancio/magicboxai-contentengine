import { GEMINI_API_BASE, MODELS, EMBEDDING_DIMS, requireGeminiKey } from "./models";

/**
 * Gemini helpers for Convex actions.
 *
 * Deliberately uses raw `fetch` against the REST API rather than @google/genai:
 * fetch is native to the Convex runtime, so these work without the `"use node"`
 * escape hatch and without pulling a Node-only SDK into the bundle.
 *
 * All calls go through `geminiFetch`, which retries transient failures (429/5xx)
 * with backoff. Model ids come from `./models` — never inline them here.
 */

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

/**
 * Exported for callers that need a request shape geminiJson/geminiText don't
 * cover (e.g. multiple inlineData image parts for a classification prompt) —
 * still gets the shared retry/backoff behavior.
 */
export async function geminiFetch(
  path: string,
  body: unknown,
  { retries = 3 }: { retries?: number } = {},
): Promise<any> {
  const key = requireGeminiKey();
  let lastErr = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${GEMINI_API_BASE}/${path}`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) return await res.json();

    const text = await res.text();
    lastErr = `${res.status} ${text.slice(0, 300)}`;

    // 4xx (except 429) are our fault — retrying just burns quota.
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt === retries) break;

    // 1s, 2s, 4s — enough to clear a short rate-limit window.
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }

  throw new Error(`[gemini] ${path} failed: ${lastErr}`);
}

function extractText(data: any): string {
  const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/** Plain text generation. */
export async function geminiText(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const data = await geminiFetch(`models/${opts.model ?? MODELS.text}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    generationConfig: { temperature: opts.temperature ?? 0.8 },
  });
  return extractText(data);
}

/**
 * Structured generation. Uses Gemini's native JSON mode with an explicit
 * responseSchema, so the model is constrained to valid shapes instead of us
 * regex-scraping "HOOK:"/"SCRIPT:" markers out of prose (which is what the
 * legacy Firebase path does, and why it drifts).
 */
export async function geminiJson<T = unknown>(opts: {
  prompt: string;
  schema: Record<string, unknown>;
  system?: string;
  model?: string;
  temperature?: number;
}): Promise<T> {
  const data = await geminiFetch(`models/${opts.model ?? MODELS.text}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    generationConfig: {
      temperature: opts.temperature ?? 0.8,
      responseMimeType: "application/json",
      responseSchema: opts.schema,
    },
  });

  const raw = extractText(data);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`[gemini] expected JSON, got: ${raw.slice(0, 200)}`);
  }
}

/**
 * Image generation via Gemini's image model.
 *
 * TWO NON-OBVIOUS REQUIREMENTS (both cause silent 200-with-no-image failures):
 *  1. responseModalities MUST include BOTH "TEXT" and "IMAGE". Passing just
 *     ["IMAGE"] returns 200 with an empty parts array and no error.
 *  2. Must hit the /v1beta generateContent endpoint (not /v1, not the OpenAI
 *     shim), which `geminiFetch` already does.
 *
 * Returns the raw base64 + mime so the caller can store it (Convex file storage)
 * and hand a URL to the publish pipeline.
 */
export async function geminiImage(opts: {
  prompt: string;
  model?: string;
  /** "9:16" for short-form verticals, "1:1"/"16:9" otherwise. */
  aspectRatio?: string;
  imageSize?: "512" | "1K" | "2K" | "4K";
}): Promise<{ mimeType: string; base64: string }> {
  const data = await geminiFetch(`models/${opts.model ?? MODELS.image}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspect_ratio: opts.aspectRatio ?? "9:16",
        image_size: opts.imageSize ?? "1K",
      },
    },
  });

  const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img?.inlineData?.data) {
    throw new Error("[gemini] image response contained no inlineData (check responseModalities)");
  }
  return { mimeType: img.inlineData.mimeType || "image/png", base64: img.inlineData.data };
}

/**
 * Google-Search-grounded generation — Maya's free trend source for platforms
 * with no usable trends API (X/Instagram). Returns the text plus the real source
 * URLs so a suggestion can cite why it thinks something is trending.
 */
export async function geminiGrounded(opts: {
  prompt: string;
  system?: string;
  model?: string;
}): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  const data = await geminiFetch(`models/${opts.model ?? MODELS.text}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    tools: [{ google_search: {} }],
  });

  const meta = data?.candidates?.[0]?.groundingMetadata;
  const sources = (meta?.groundingChunks ?? [])
    .map((c: any) => ({
      title: c?.web?.title ?? "",
      url: c?.web?.uri ?? "",
    }))
    .filter((s: { url: string }) => !!s.url);

  return { text: extractText(data), sources };
}

/**
 * Embed text for Maya's duplicate detection. Dimensionality is pinned to
 * EMBEDDING_DIMS to match the `suggestions.by_embedding` vector index — a
 * mismatch here fails at insert time, not at read time, so keep them in lockstep.
 */
export async function geminiEmbed(text: string): Promise<number[]> {
  const data = await geminiFetch(`models/${MODELS.embedding}:embedContent`, {
    model: `models/${MODELS.embedding}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMS,
  });

  const values: number[] | undefined = data?.embedding?.values;
  if (!values || values.length !== EMBEDDING_DIMS) {
    throw new Error(
      `[gemini] embedding returned ${values?.length ?? 0} dims, expected ${EMBEDDING_DIMS}`,
    );
  }
  return values;
}

/** Cosine similarity for de-dup scoring. Vectors are already unit-ish; this is exact. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
