/**
 * MAYA-Templates — meme-template engine.
 *
 * WHERE THE RUNTIME LIVES: the deployed pipeline runs as Convex actions in
 * `packages/backend/convex/mayaTemplates.ts` (jobs, credits, polling,
 * rendering, publishing — all of which need the Convex runtime). This package
 * is the standalone view of the *pure* engine: ingestion, adaptation, TTS and
 * lip-sync dispatch, usable from a plain Node script without Convex.
 *
 * Every module here re-exports the canonical implementation rather than
 * copying it, so there is exactly one source of truth.
 */

export * from "./types";
export * from "./curatedTemplates";
export * from "./adaptationEngine";
export * from "./monidService";
export * from "./lipSyncService";

import { searchTrendingReels } from "./monidService";
import { CURATED_INDIAN_MEME_TEMPLATES } from "./curatedTemplates";
import { adaptTemplate, formatConditioningCues } from "./adaptationEngine";
import type { BrandContext, MemeTemplate, SynthesizedAdaptation } from "./types";

export interface AdaptedMemeReel {
  template: MemeTemplate;
  adaptation: SynthesizedAdaptation;
  /** false = the deterministic synthesizer ran because Gemini was unavailable. */
  usedAI: boolean;
  /** Whether `template` came from a live Monid search or the curated fallback set. */
  templateSource: "monid" | "curated";
  /** Shot-by-shot delivery cues, handy for prompting a video/lip-sync model. */
  conditioningCues: string;
}

/**
 * End-to-end convenience wrapper: find a trending AI-generated reel that fits
 * the brand, then adapt it. Falls back to the curated set when Monid has
 * nothing (or isn't configured) so this always returns something usable.
 */
export async function createAdaptedMemeReel(opts: {
  brand: BrandContext;
  keyword?: string;
  customProductAngle?: string;
  humorIntensity?: string;
}): Promise<AdaptedMemeReel> {
  const search = await searchTrendingReels({ keyword: opts.keyword });

  const templateSource: "monid" | "curated" = search.templates.length ? "monid" : "curated";
  const template = search.templates[0] ?? CURATED_INDIAN_MEME_TEMPLATES[0];

  const { adaptation, usedAI } = await adaptTemplate(template, opts.brand, {
    customProductAngle: opts.customProductAngle,
    humorIntensity: opts.humorIntensity,
  });

  return {
    template,
    adaptation,
    usedAI,
    templateSource,
    conditioningCues: formatConditioningCues(adaptation.lipSyncScript),
  };
}
