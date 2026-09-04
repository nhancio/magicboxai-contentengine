/**
 * Brand adaptation: turns a meme template + brand kit into a ship-ready
 * script, overlays, subtitles, SFX cues and an Instagram caption.
 *
 * Two paths, same output shape:
 *  - `adaptWithGemini`  — the real AI writer (needs GEMINI_API_KEY)
 *  - `synthesizeAlgorithmicAdaptation` — deterministic 0-latency fallback
 */
import { geminiJson } from "../../packages/backend/convex/lib/gemini";
import {
  ADAPTATION_JSON_SCHEMA,
  buildAdaptationPrompt,
  geminiResultToSynthesized,
  synthesizeAlgorithmicAdaptation,
  formatConditioningCues,
} from "../../packages/backend/convex/lib/maya/adaptationLogic";
import type { BrandContext, MemeTemplate, SynthesizedAdaptation } from "./types";

export {
  ADAPTATION_JSON_SCHEMA,
  buildAdaptationPrompt,
  geminiResultToSynthesized,
  synthesizeAlgorithmicAdaptation,
  formatConditioningCues,
};

export interface AdaptOptions {
  customProductAngle?: string;
  humorIntensity?: string;
}

/**
 * Full adapt: Gemini first, deterministic synthesizer on any failure — the
 * same order the deployed `mayaTemplates.adaptTemplate` action uses.
 * `usedAI` tells you which path produced the result instead of hiding it.
 */
export async function adaptTemplate(
  template: MemeTemplate,
  brand: BrandContext,
  opts: AdaptOptions = {},
): Promise<{ adaptation: SynthesizedAdaptation; usedAI: boolean }> {
  try {
    const parsed = await geminiJson<any>({
      prompt: buildAdaptationPrompt(template, brand, opts),
      schema: ADAPTATION_JSON_SCHEMA as unknown as Record<string, unknown>,
      temperature: 0.85,
    });
    return { adaptation: geminiResultToSynthesized(parsed, template, brand), usedAI: true };
  } catch (err) {
    console.warn("[maya] Gemini adaptation failed, using algorithmic fallback:", err);
    return {
      adaptation: synthesizeAlgorithmicAdaptation(template, brand, opts.customProductAngle),
      usedAI: false,
    };
  }
}
