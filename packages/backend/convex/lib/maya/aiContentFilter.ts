import { geminiFetch } from "../gemini";
import { MODELS } from "../models";
import type { MemeTemplate } from "./types";

/**
 * Hard filter, not just search-query wording: verifies each Monid result's
 * thumbnail is genuinely AI-generated/synthetic (an avatar, animated
 * character, AI-rendered scene) before it's ever shown, rather than trusting
 * that keyword matching alone surfaced only AI content. Real Monid/TikHub
 * results can include normal human-recorded reels that happen to mention "ai"
 * in a caption/hashtag.
 */

const AI_CONTENT_FILTER_SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          templateId: { type: "string" },
          isAiGenerated: { type: "boolean" },
          characterType: {
            type: "string",
            enum: ["animated_superhero_parody", "talking_animal", "animated_object", "3d_cartoon", "real_human"],
          },
          reason: { type: "string" },
        },
        required: ["templateId", "isAiGenerated", "characterType", "reason"],
      },
    },
  },
  required: ["verdicts"],
} as const;

const CLASSIFIER_SYSTEM_PROMPT = `You are a strict AI video content classifier. Your job is to analyze video thumbnail images or frames and determine whether the video is SYNTHETIC / AI-GENERATED / ANIMATED or REAL LIVE-ACTION HUMAN FOOTAGE.

STRICT REJECTION RULES (Mark isAiGenerated = false):
- Any real photographed or filmed human being (e.g., influencers filming selfie rants, real vloggers, real people talking to camera, live-action skits, real human reactions).
- Real animals filmed on real cameras without CGI/synthetic animation.
- Normal live-action street or indoor footage of people.

STRICT ACCEPTANCE RULES (Mark isAiGenerated = true):
- AI-Generated / 3D Animated Characters (e.g., 3D Spider-Man, Hulk, Batman, cartoon superheroes in everyday or Indian domestic settings).
- AI Talking Animals (e.g., hyper-realistic or cartoon cats, dogs, monkeys speaking, reacting, or wearing clothes).
- Anthropomorphic Non-Living Objects (e.g., 3D animated talking coffee cup, smiling shoe, talking gadget, animated food items promoting or discussing something).
- 3D / 2D Cartoon and CGI Animation (e.g., Pixar/Disney-style characters, anime CGI, 3D desi brainrot meme characters, animated Indian mom/aunty figures).
- Deepfake / Synthetic digital avatars clearly rendered by AI tools.`;

/** Cap how many candidates get classified in one call — keeps the multimodal request small/fast. */
const MAX_CANDIDATES = 15;

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return { mimeType, data: btoa(binary) };
  } catch {
    return null;
  }
}

function extractText(data: any): string {
  const parts: Array<{ text?: string }> = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

/**
 * Returns only the templates whose thumbnail Gemini confirms is AI-generated
 * content. Anything it can't fetch/classify, or that classification fails
 * entirely for, is EXCLUDED rather than assumed — "only AI generated content"
 * means erring toward dropping the unverifiable, not letting it through.
 */
export async function filterAIGeneratedOnly(templates: MemeTemplate[]): Promise<MemeTemplate[]> {
  if (!templates.length) return [];
  const candidates = templates.slice(0, MAX_CANDIDATES);

  const withImages = await Promise.all(
    candidates.map(async (t) => ({
      template: t,
      image: await fetchImageAsBase64(t.thumbnailUrl || t.previewImageUrl || ""),
    })),
  );
  const usable = withImages.filter((x) => x.image);
  if (!usable.length) return [];

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: CLASSIFIER_SYSTEM_PROMPT },
    { text: "\nINPUT:\nEvaluate each image below, labeled by its templateId." },
  ];
  for (const { template, image } of usable) {
    parts.push({ text: `Image for templateId="${template.templateId}":` });
    parts.push({ inlineData: image! });
  }
  parts.push({
    text:
      '\nOUTPUT FORMAT:\nReturn JSON only: { "verdicts": [{ "templateId": "...", "isAiGenerated": true|false, ' +
      '"characterType": "animated_superhero_parody" | "talking_animal" | "animated_object" | "3d_cartoon" | "real_human", ' +
      '"reason": "Short 1-sentence explanation of why it passed or failed" }, ...] } — exactly one entry per image above.',
  });

  try {
    const data = await geminiFetch(`models/${MODELS.text}:generateContent`, {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: AI_CONTENT_FILTER_SCHEMA,
      },
    });
    const parsed = JSON.parse(extractText(data));
    const verdicts: Array<{ templateId: string; isAiGenerated: boolean; characterType?: string; reason?: string }> =
      parsed.verdicts || [];
    console.log(
      "[monid] AI-content verdicts:",
      verdicts.map((v) => `${v.templateId}=${v.isAiGenerated}(${v.characterType}): ${v.reason}`).join(" | "),
    );
    const aiIds = new Set<string>(verdicts.filter((v) => v.isAiGenerated).map((v) => String(v.templateId)));
    return usable.map((x) => x.template).filter((t) => aiIds.has(t.templateId));
  } catch (err) {
    console.warn("[monid] AI-content classification failed, excluding all live results to stay conservative:", err);
    return [];
  }
}
