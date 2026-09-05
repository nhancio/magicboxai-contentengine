import { geminiFetch } from "../gemini";
import { MODELS } from "../models";
import { referencePromptsFor, HOUSE_PROMPT_STRUCTURE } from "./higgsfieldPrompts";
import type { MemeTemplate, BrandContext } from "./types";

/**
 * Steps 2+3 of the pipeline: watch the fetched reel and reverse-engineer a
 * house-structured production prompt that would recreate its ENERGY as an
 * original piece.
 *
 * The model gets the ACTUAL VIDEO (Gemini 3.8 takes video input), not a
 * thumbnail — camera movement, pacing, performance and shot changes are most
 * of what makes a replication prompt faithful, and none of that is visible in
 * a still frame.
 *
 * Output is deliberately two-shaped:
 *   - `fullPrompt` — the complete sectioned document, for pasting into a
 *     generator that can take a 30s multi-shot brief (Omni/Higgsfield).
 *   - `beats[]`    — one self-contained prompt per beat, because Veo generates
 *     ~8s single shots with no shared context between calls. Each beat prompt
 *     re-states optics/camera/physics/lighting so the clips cut together.
 */

/** Gemini's inline-data ceiling is ~20MB for the whole request; stay well under it. */
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

/** The cover frame rides alongside the video, so it gets a much smaller share. */
const MAX_FRAME_BYTES = 4 * 1024 * 1024;

export type CutType = "HARD CUT" | "MATCH CUT" | "WHIP CUT" | "INSERT CUT";

export interface ReferenceBeat {
  index: number;
  /** The cut that leads INTO this beat. Null for the first beat. */
  cutType: CutType | null;
  /** The BEAT line from the document — what happens on screen. */
  description: string;
  /** Self-contained prompt for one generation call. */
  clipPrompt: string;
}

export interface VideoReference {
  /** The complete sectioned production document. */
  fullPrompt: string;
  /** Per-beat prompts, each generatable independently. */
  beats: ReferenceBeat[];
  /** The named camera language the document leads with. */
  cameraMotion: string;
  /** What's physically on screen — used to keep the brand rewrite visually coherent. */
  sceneSummary: string;
  /** Number of distinct speakers visible, so the script can match. */
  speakerCount: number;
  /** True when analysis fell back (video too large / unfetchable / model error). */
  degraded: boolean;
}

const VIDEO_REFERENCE_SCHEMA = {
  type: "object",
  properties: {
    fullPrompt: { type: "string" },
    beats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" },
          cutType: { type: "string", enum: ["HARD CUT", "MATCH CUT", "WHIP CUT", "INSERT CUT", "NONE"] },
          description: { type: "string" },
          clipPrompt: { type: "string" },
        },
        required: ["index", "description", "clipPrompt"],
      },
    },
    cameraMotion: { type: "string" },
    sceneSummary: { type: "string" },
    speakerCount: { type: "number" },
  },
  required: ["fullPrompt", "beats", "cameraMotion", "sceneSummary", "speakerCount"],
} as const;

async function fetchVideoAsBase64(
  url: string,
): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared && declared > MAX_VIDEO_BYTES) {
      console.warn(`[videoReference] video is ${declared} bytes, over the ${MAX_VIDEO_BYTES} inline cap`);
      return null;
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_VIDEO_BYTES) {
      console.warn(`[videoReference] video is ${bytes.length} bytes, over the inline cap`);
      return null;
    }

    const mimeType = res.headers.get("content-type")?.split(";")[0] || "video/mp4";
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { mimeType, data: btoa(binary) };
  } catch (err) {
    console.warn("[videoReference] could not fetch source video:", err);
    return null;
  }
}

/**
 * Pull the reel's cover frame — the "screenshot" of the source video.
 *
 * Convex's V8 runtime has no ffmpeg and no way to decode H.264, so a frame
 * cannot be extracted from the MP4 here. The cover image the platform already
 * publishes alongside the reel IS a frame of that video, so it costs one cheap
 * GET instead of a whole decode path or a round-trip to the render service.
 */
async function fetchFrameAsBase64(
  url: string | undefined,
): Promise<{ mimeType: string; data: string } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_FRAME_BYTES) return null;

    const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;

    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { mimeType, data: btoa(binary) };
  } catch (err) {
    console.warn("[videoReference] could not fetch cover frame:", err);
    return null;
  }
}

function extractText(data: any): string {
  const parts: Array<{ text?: string }> = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

function buildReferencePrompt(
  template: MemeTemplate,
  brand: BrandContext,
  sources: { hasVideo: boolean; hasFrame: boolean },
): string {
  const example = referencePromptsFor(template.format, 1)[0];

  const shown = sources.hasVideo
    ? sources.hasFrame
      ? "the reel itself AND a full-resolution still frame from it"
      : "a short vertical reel"
    : "a full-resolution still frame from a short vertical reel (the video itself was too large to attach — infer motion and pacing from the composition, motion blur and framing in the still)";

  return `You are a commercial director reverse-engineering a reference reel into a production prompt.

You are shown ${shown}. Write the production document for a NEW commercial for the brand below that carries this reel's ENERGY — its pacing, cutting rhythm, performance intensity, lighting attitude and transition style.

CRITICAL: Create an ORIGINAL concept. Do not reproduce the reel's characters, locations, props, compositions or individual shots. You are borrowing its energy, not its content.

## THE BRAND (this is what the commercial is actually for)
- Name: ${brand.name}
- Industry: ${brand.industry || "General"}
- Product / USP: ${brand.productOffering || brand.uniqueSellingPoint || "their core offering"}
- Audience: ${brand.audience || "Indian digital consumers"}
- Tone: ${brand.toneOfVoice || "energetic, playful"}

## WHAT TO WATCH FOR IN THE REEL
- the cutting rhythm and how fast pattern-interrupts land
- performance intensity and acting register
- lighting attitude and colour temperament
- transition vocabulary (crash zooms, whip cuts, match cuts on shape/motion)
- the render style (photoreal / 3D cartoon / Pixar-style / anime CGI / stylised)

## OUTPUT STRUCTURE — follow this exactly
${HOUSE_PROMPT_STRUCTURE}

## REFERENCE EXAMPLE OF THE HOUSE FORMAT (${example.genre})
${example.prompt}

## HARD CONSTRAINTS FOR THE GENERATOR (every beat is rejected outright if these are broken)
The generator runs an automatic safety filter that silently discards a shot
rather than explaining itself, so write every beat to pass it first time:
- Describe people ONLY as adults. Never "young", "little", "boy", "girl",
  "child", "kid", or any age qualifier that could read as a minor.
- Never name a nationality, ethnicity or race for a character ("Indian man",
  "Asian woman"). Describe wardrobe, setting and props instead — that is what
  actually carries cultural specificity on screen anyway.
- Never name a real person, celebrity, existing character or third-party brand.
- Keep emotion in the comedic register: "comically dismayed", "mock-outraged",
  "delighted". Avoid genuine distress language — crying, weeping, sobbing,
  desperate, starving, shouting at someone.
- No violence, injury, medical detail or anything a viewer would read as real
  suffering, even played for laughs.
State plainly in each beat that the characters are stylised fictional animated
characters.

## ALSO SPLIT IT INTO BEATS
Each beat becomes ONE independent generation call on a model that produces ~8
second single shots and shares no context between calls. So every beat's
\`clipPrompt\` must stand completely on its own: restate the optics, camera
character, physics, lighting and render style each time, and describe the
product using <<<image_1>>> so it stays consistent across beats. Aim for 4
beats unless the reel's structure clearly calls for more.

## THE CLIP'S KNOWN METADATA (secondary — trust your eyes over this)
- Title: ${template.title}
- Format: ${template.format}
- Duration: ${template.durationSec}s
- Described as: ${template.viralHook}

Return JSON only:
{
  "fullPrompt": "the complete sectioned document, all sections, ready to paste",
  "beats": [
    {
      "index": 1,
      "cutType": "HARD CUT" | "MATCH CUT" | "WHIP CUT" | "INSERT CUT" | "NONE",
      "description": "what happens on screen in this beat",
      "clipPrompt": "self-contained prompt for generating ONLY this beat"
    }
  ],
  "cameraMotion": "the dominant camera language",
  "sceneSummary": "one sentence: what is physically happening across the piece",
  "speakerCount": <how many distinct characters visibly speak>
}`;
}

/** Deterministic fallback so the pipeline still produces a usable prompt when analysis fails. */
function fallbackReference(template: MemeTemplate, brand: BrandContext): VideoReference {
  const example = referencePromptsFor(template.format, 1)[0];
  const product = brand.productOffering || brand.industry || "the product";
  const shared =
    `Optics: 47° standard-normal for medium shots, 18° telephoto for product macro. ` +
    `Camera: deliberate studio moves, quick mechanical zooms. ` +
    `Physics: believable mass, contact and follow-through. ` +
    `Lighting: hard colourful studio key with a controlled specular highlight on the product. ` +
    `Render: polished 3D commercial finish, 9:16 vertical.`;

  const beatSpecs: Array<{ description: string; cutType: CutType | null }> = [
    { description: `Open on the ${brand.name} product held centre-frame, hero lighting, energetic push in.`, cutType: null },
    { description: `A character reacts with exaggerated comedic disbelief to the problem ${product} solves.`, cutType: "HARD CUT" },
    { description: `The ${brand.name} product arrives as the turn — the character's expression flips to delight.`, cutType: "MATCH CUT" },
    { description: `Final hero frame: the product upright and fully readable, clean premium hold.`, cutType: "HARD CUT" },
  ];

  return {
    fullPrompt: example.prompt,
    beats: beatSpecs.map((b, i) => ({
      index: i + 1,
      cutType: b.cutType,
      description: b.description,
      clipPrompt: `${b.description} The product matches <<<image_1>>> exactly and stays dimensionally stable. ${shared}`,
    })),
    cameraMotion: example.cameraMotion,
    sceneSummary: template.viralHook || template.title,
    speakerCount: Math.max(1, template.lipSyncSlots.length),
    degraded: true,
  };
}

/**
 * Watches the source reel and returns a house-structured production prompt
 * plus per-beat clip prompts. Never throws — on any failure it degrades to a
 * genre-matched fallback and flags `degraded`, so a bad analysis can't take
 * down the whole generation run.
 */
export async function buildVideoReference(
  template: MemeTemplate,
  brand: BrandContext,
): Promise<VideoReference> {
  // Both inputs are best-effort and independent. The video carries motion,
  // pacing and cutting; the cover frame is a clean, full-resolution still that
  // reads composition, palette and render style far more reliably than any
  // single compressed video frame the model samples internally.
  const [video, frame] = await Promise.all([
    fetchVideoAsBase64(template.previewVideoUrl),
    fetchFrameAsBase64(template.thumbnailUrl || template.previewImageUrl),
  ]);

  // Only give up entirely when there is nothing to look at. A reel too large
  // to inline used to skip analysis completely and fall back to a generic
  // prompt; with the frame alone the model still sees the real thing.
  if (!video && !frame) return fallbackReference(template, brand);

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: buildReferencePrompt(template, brand, { hasVideo: !!video, hasFrame: !!frame }) }];
  if (video) parts.push({ inlineData: video });
  if (frame) {
    parts.push({ text: "\nSTILL FRAME FROM THE SAME REEL (full resolution — read style, palette and composition from this):" });
    parts.push({ inlineData: frame });
  }

  try {
    const data = await geminiFetch(`models/${MODELS.videoAnalysis}:generateContent`, {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: VIDEO_REFERENCE_SCHEMA,
      },
    });

    const parsed = JSON.parse(extractText(data));
    if (!parsed?.fullPrompt || !Array.isArray(parsed.beats) || !parsed.beats.length) {
      return fallbackReference(template, brand);
    }

    const beats: ReferenceBeat[] = parsed.beats
      .filter((b: any) => b?.clipPrompt)
      .map((b: any, i: number) => ({
        index: Number(b.index) || i + 1,
        cutType: b.cutType && b.cutType !== "NONE" ? (b.cutType as CutType) : null,
        description: String(b.description ?? ""),
        clipPrompt: String(b.clipPrompt),
      }));

    if (!beats.length) return fallbackReference(template, brand);

    return {
      fullPrompt: String(parsed.fullPrompt),
      beats,
      cameraMotion: String(parsed.cameraMotion ?? "Push In"),
      sceneSummary: String(parsed.sceneSummary ?? template.viralHook),
      speakerCount: Number(parsed.speakerCount) || Math.max(1, template.lipSyncSlots.length),
      // Frame-only analysis is real analysis of the real reel, but it cannot
      // see motion or cutting — flag it so the UI can say so honestly.
      degraded: !video,
    };
  } catch (err) {
    console.warn("[videoReference] analysis failed, using genre-matched fallback:", err);
    return fallbackReference(template, brand);
  }
}

/**
 * Step 4: fold the brand and the spoken script into the reference.
 *
 * Applied to the full document AND to every beat prompt, because each beat is
 * generated independently and would otherwise lose the brand entirely.
 */
export function injectBrandIntoReference(
  reference: VideoReference,
  brand: BrandContext,
  adaptedScript: string,
): { fullPrompt: string; beats: ReferenceBeat[] } {
  const product = brand.productOffering || brand.industry || "the product";
  const brandBlock = [
    ``,
    `BRAND INTEGRATION`,
    `- <<<image_1>>> is ${brand.name} (${product}). It is the product source of truth: keep its colours, proportions and layout exact and dimensionally stable in every shot.`,
    `- The speaking character delivers this line, lip-synced: "${adaptedScript}"`,
    brand.colors?.primary
      ? `- Work ${brand.colors.primary} into the palette as an accent (props, screen glow, wardrobe) without restyling the shot.`
      : ``,
    `- Do not add logos, watermarks or on-screen text; those are composited separately.`,
    `- Create an original concept. Do not reproduce the reference reel's characters, locations, compositions or individual shots.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    fullPrompt: `${reference.fullPrompt}\n${brandBlock}`,
    beats: reference.beats.map((b) => ({
      ...b,
      clipPrompt: `${b.clipPrompt}\n${brandBlock}`,
    })),
  };
}
