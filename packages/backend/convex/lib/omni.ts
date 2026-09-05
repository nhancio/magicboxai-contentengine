import { GEMINI_API_BASE, MODELS, requireGeminiKey } from "./models";

/**
 * GEMINI OMNI — video generation that can actually be steered by references.
 *
 * This is the generator behind Maya's replication pipeline. It exists as its
 * own module because Omni does NOT speak the API the rest of this codebase
 * uses: `models/<id>:generateContent` returns
 *   400 "This model only supports Interactions API."
 * Instead it takes POST /v1beta/interactions with a FLAT list of typed steps,
 * and answers with a list of steps rather than candidates/parts.
 *
 * Request:
 *   { model, input: [ {type:"text",  text},
 *                     {type:"image", mime_type, data},     // base64
 *                     {type:"video", mime_type, data} ] }
 * Response:
 *   { status, steps: [ {type:"thought", ...},
 *                      {type:"model_output", content:[{type:"video", mime_type, data}]} ] }
 *
 * All of the above was verified live against this deployment's key on
 * 2026-09-05: an 8.00s 720x1280 MP4 with an AAC audio track came back from a
 * single call, and a reference image demonstrably conditioned the result.
 */

/** Inline payloads ride in the JSON body, so keep the whole request sane. */
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

/** Omni is synchronous and slow; well under Convex's 10-minute action ceiling. */
const REQUEST_TIMEOUT_MS = 8 * 60 * 1000;

export interface OmniReference {
  kind: "image" | "video";
  mimeType: string;
  /** base64, no data: prefix */
  data: string;
}

export interface OmniVideoResult {
  mimeType: string;
  bytes: Uint8Array;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

/**
 * Fetch a URL into an Omni reference. Best-effort by design: a reference is an
 * enhancement, and losing one should soften the output, never fail the render.
 */
export async function fetchOmniReference(
  url: string | undefined,
  kind: "image" | "video",
): Promise<OmniReference | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared && declared > MAX_REFERENCE_BYTES) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_REFERENCE_BYTES) return null;

    const mimeType =
      res.headers.get("content-type")?.split(";")[0] ||
      (kind === "image" ? "image/jpeg" : "video/mp4");
    if (!mimeType.startsWith(`${kind}/`)) return null;

    return { kind, mimeType, data: bytesToBase64(bytes) };
  } catch (e) {
    console.warn(`[omni] ${kind} reference fetch failed, continuing without it:`, e);
    return null;
  }
}

/** Build an Omni reference directly from bytes already in hand. */
export function omniReferenceFromBytes(
  bytes: Uint8Array,
  kind: "image" | "video",
  mimeType: string,
): OmniReference | null {
  if (!bytes.length || bytes.length > MAX_REFERENCE_BYTES) return null;
  return { kind, mimeType, data: bytesToBase64(bytes) };
}

/**
 * Generate one video clip. Throws on failure — the caller owns credits and
 * job state, and a silent empty result would be worse than a loud error.
 */
export async function generateOmniVideo(opts: {
  prompt: string;
  references?: Array<OmniReference | null>;
}): Promise<OmniVideoResult> {
  const key = requireGeminiKey();

  const input: Array<Record<string, unknown>> = [{ type: "text", text: opts.prompt }];
  for (const ref of opts.references ?? []) {
    if (!ref) continue;
    input.push({ type: ref.kind, mime_type: ref.mimeType, data: ref.data });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let data: any;
  try {
    const res = await fetch(`${GEMINI_API_BASE}/interactions`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: `models/${MODELS.omniVideo}`, input }),
      signal: controller.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`[omni] ${res.status}: ${raw.slice(0, 300)}`);
    }
    data = JSON.parse(raw);
  } finally {
    clearTimeout(timeout);
  }

  if (data?.error) {
    throw new Error(`[omni] ${JSON.stringify(data.error).slice(0, 300)}`);
  }

  // Walk every step's content: the video sits in a `model_output` step, but the
  // step list also carries `thought` steps and may grow new kinds over time.
  for (const step of data?.steps ?? []) {
    for (const content of step?.content ?? []) {
      if (content?.type === "video" && typeof content.data === "string") {
        return {
          mimeType: content.mime_type || "video/mp4",
          bytes: base64ToBytes(content.data),
        };
      }
    }
  }

  // Omni answers a blocked or misread prompt with prose instead of video.
  // Surfacing that text is the difference between a fixable message and a
  // mystery, so pull it out rather than reporting a bare "no video".
  const spoken = (data?.steps ?? [])
    .flatMap((s: any) => s?.content ?? [])
    .filter((c: any) => c?.type === "text" && c.text)
    .map((c: any) => c.text)
    .join(" ")
    .slice(0, 300);

  throw new Error(
    spoken
      ? `[omni] returned text instead of video: ${spoken}`
      : `[omni] response contained no video (status: ${data?.status ?? "unknown"})`,
  );
}
