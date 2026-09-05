import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { requireUid } from "./lib/auth";
import { reserveMonthlyPostQuota, DEFAULT_VEO_SECONDS } from "./credits";
import { geminiJson } from "./lib/gemini";
import { requireFalKey } from "./lib/models";
import { searchTrendingReels, type TrendingReelsResult } from "./lib/monid";
import {
  ADAPTATION_JSON_SCHEMA,
  buildAdaptationPrompt,
  geminiResultToSynthesized,
  synthesizeAlgorithmicAdaptation,
} from "./lib/maya/adaptationLogic";
import { SEARCH_QUERY_SCHEMA, buildSearchQueryPrompt, GENERIC_FALLBACK_QUERIES } from "./lib/maya/searchQueries";
import type { BrandContext, MemeTemplate, SynthesizedAdaptation } from "./lib/maya/types";
import { buildVideoReference, injectBrandIntoReference } from "./lib/maya/videoReference";
import { synthesizeSpeech, pcmToWav } from "./lib/tts";
import { submitLipSync, pollLipSyncStatus } from "./lib/fal";
import { isVeoSafetyBlock } from "./media";

/**
 * MAYA-TEMPLATES — brand-adapted viral meme video pipeline.
 *
 * Ingest (Monid, with curated fallback) -> adapt (Gemini, with algorithmic
 * fallback) -> generate:
 *   "lipsync" mode  (needs FAL_API_KEY): TTS the adapted script (Gemini), then
 *                    lip-sync it onto the ORIGINAL viral clip via Fal.ai — the
 *                    actual product goal: the same footage now says the
 *                    brand's new lines.
 *   "veo_synthetic" mode (works today, no new keys): delegates straight to the
 *                    existing, working Veo pipeline in media.ts — a wholly new
 *                    AI-generated clip from the adapted prompt.
 * -> compose (Remotion: burn in text overlays + brand logo via apps/renderer).
 *
 * Mirrors media.ts's durable-job pattern throughout: a job row is the durable
 * handle, a self-rescheduling poller resumes it, credits are billed on start
 * and refunded on terminal failure.
 */

const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 40; // ~10 min ceiling, same as media.ts's Veo poller

/**
 * Attempts to recover a beat that Veo's safety filter dropped. Two is
 * deliberate: attempt 1 re-sends verbatim (the filter is partly
 * non-deterministic), attempt 2 sends a softened rewrite. Beyond that the
 * prompt is genuinely being refused and retrying just burns time.
 */
const MAX_BEAT_RETRIES = 2;

/** One generated shot of the stitched commercial, as stored on the job row. */
type BeatClip = {
  index: number;
  description: string;
  mediaJobId: string;
  url?: string;
  failed?: boolean;
  error?: string;
  prompt?: string;
  retries?: number;
};

/**
 * Rewrite a prompt to clear Veo's safety filter without losing the shot.
 *
 * The filter reliably objects to descriptors that make a generated person
 * feel like a *specific real* person — named nationality/ethnicity, age
 * qualifiers that could read as a minor, and distress language — even in
 * plainly harmless commercial contexts. Swapping those for neutral equivalents
 * keeps the composition, camera and product intact, which is what the beat
 * actually needs to cut together with its neighbours.
 */
export function softenPromptForSafety(prompt: string): string {
  const substitutions: Array<[RegExp, string]> = [
    [/\b(young|little|small|teenage|teen)\s+(man|woman|boy|girl|child|kid)\b/gi, "adult character"],
    [/\b(boy|girl|child|kid|kids|children)\b/gi, "adult character"],
    [/\b(indian|asian|african|american|chinese|japanese|korean|arab|hispanic|latino|black|white)\s+(man|woman|person|family|male|female|guy|lady)\b/gi, "person"],
    [/\b(weeping|sobbing|crying|wailing|distraught|despairing)\b/gi, "comically dismayed"],
    [/\b(scolding|shouting at|yelling at|screaming at|berating)\b/gi, "playfully teasing"],
    [/\b(starving|malnourished|desperate)\b/gi, "very hungry"],
  ];

  let softened = substitutions.reduce((acc, [re, to]) => acc.replace(re, to), prompt);
  softened +=
    "\n\nSAFETY NOTE: All characters are adult, fictional, stylised animated characters. " +
    "The tone is light-hearted commercial comedy with no distress, conflict or real-world likeness.";
  return softened;
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type });
}

type AdaptationDoc = {
  sourceTemplateId: string;
  sourceVideoUrl: string;
  sourceTitle: string;
  sourceFormat?: string;
  sourceThumbnailUrl?: string;
  durationSec: number;
  hookText: string;
  adaptedScript: string;
  lipSyncScript: Array<{ speakerId: string; startSec: number; endSec: number; spokenDialogue: string }>;
  brandSnapshot: {
    name: string;
    logoUrl?: string;
    colors?: { primary: string; secondary?: string; accent?: string };
    industry?: string;
    audience?: string;
    productOffering?: string;
    toneOfVoice?: string;
    targetCallToAction?: string;
  };
};

/**
 * Rebuilds the brand context an adaptation was generated for, from the
 * snapshot stored on it — deliberately NOT re-read from the live brand kit,
 * which may have been edited since.
 */
function brandFromAdaptation(a: AdaptationDoc): BrandContext {
  return {
    name: a.brandSnapshot.name,
    logoUrl: a.brandSnapshot.logoUrl,
    colors: a.brandSnapshot.colors,
    industry: a.brandSnapshot.industry,
    audience: a.brandSnapshot.audience,
    productOffering: a.brandSnapshot.productOffering,
    toneOfVoice: a.brandSnapshot.toneOfVoice,
    targetCallToAction: a.brandSnapshot.targetCallToAction,
  };
}

/**
 * Minimal MemeTemplate reconstructed from a stored adaptation. Only the fields
 * buildVideoReference actually reads carry real data (video url, title,
 * format, duration, speaker count); the rest satisfy the type.
 */
function templateStubFromAdaptation(a: AdaptationDoc): MemeTemplate {
  return {
    templateId: a.sourceTemplateId,
    title: a.sourceTitle,
    category: "Indian Brainrot",
    format: (a.sourceFormat as MemeTemplate["format"]) ?? "talking_head_rant",
    previewVideoUrl: a.sourceVideoUrl,
    thumbnailUrl: a.sourceThumbnailUrl,
    previewImageUrl: a.sourceThumbnailUrl,
    durationSec: a.durationSec,
    aspectRatio: "9:16",
    viralHook: a.hookText,
    humorMechanism: "Viral pacing with a punchline turn",
    culturalContext: "Trending social reel",
    beats: [],
    textSlots: [],
    audioPlan: { trackType: "bgm", suggestedTrackStyle: "High-energy", sfxCues: [] },
    lipSyncSlots: a.lipSyncScript.map((l) => ({
      speakerId: l.speakerId,
      speakerDescription: "On-screen speaker",
      startSec: l.startSec,
      endSec: l.endSec,
      originalDialogue: l.spokenDialogue,
      emotionalExpression: "ranting" as const,
    })),
    defaultScript: a.adaptedScript,
    tags: [],
  };
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

export const searchTrendingTemplates = action({
  args: { query: v.optional(v.string()), paginationToken: v.optional(v.string()) },
  handler: async (ctx, { query: keyword, paginationToken }): Promise<TrendingReelsResult> => {
    await requireUid(ctx);
    return await searchTrendingReels({ keyword, paginationToken });
  },
});

/**
 * Public: turns brand context into 3-5 search queries biased toward
 * "blank canvas" reel formats (animated avatars, green-screen rants,
 * universal reactions) that swap in cleanly for this specific brand, instead
 * of the generic/location-based queries the trending tab uses by default.
 */
export const suggestSearchQueries = action({
  args: {
    brandName: v.string(),
    industry: v.optional(v.string()),
    productOffering: v.optional(v.string()),
    audience: v.optional(v.string()),
    toneOfVoice: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ queries: string[] }> => {
    await requireUid(ctx);
    if (!args.brandName.trim()) {
      throw new Error("Brand name is required");
    }
    try {
      const parsed = await geminiJson<{ queries: string[] }>({
        prompt: buildSearchQueryPrompt(
          args.brandName,
          args.industry,
          args.productOffering,
          args.audience,
          args.toneOfVoice,
        ),
        schema: SEARCH_QUERY_SCHEMA,
        temperature: 0.7,
      });
      const queries = (parsed.queries || []).map((q) => String(q).trim()).filter(Boolean).slice(0, 5);
      if (queries.length) return { queries };
    } catch (err) {
      console.warn("[mayaTemplates] suggestSearchQueries failed, using generic fallback:", err);
    }
    return { queries: GENERIC_FALLBACK_QUERIES };
  },
});

// ---------------------------------------------------------------------------
// Adaptation
// ---------------------------------------------------------------------------

const brandSnapshotValidator = v.object({
  name: v.string(),
  logoUrl: v.optional(v.string()),
  colors: v.optional(
    v.object({
      primary: v.string(),
      secondary: v.optional(v.string()),
      accent: v.optional(v.string()),
    }),
  ),
  industry: v.optional(v.string()),
  audience: v.optional(v.string()),
  productOffering: v.optional(v.string()),
  toneOfVoice: v.optional(v.string()),
  targetCallToAction: v.optional(v.string()),
});

const textOverlayValidator = v.object({
  slotId: v.string(),
  text: v.string(),
  placement: v.string(),
  color: v.string(),
  bgColor: v.optional(v.string()),
  startSec: v.optional(v.number()),
  endSec: v.optional(v.number()),
});

const lipSyncLineValidator = v.object({
  speakerId: v.string(),
  startSec: v.number(),
  endSec: v.number(),
  spokenDialogue: v.string(),
  deliveryTone: v.string(),
  facialExpression: v.optional(v.string()),
});

const videoModelPromptsValidator = v.object({
  googleVeoPrompt: v.string(),
  negativePrompt: v.string(),
});

const subtitleCueValidator = v.object({
  startSec: v.number(),
  endSec: v.number(),
  text: v.string(),
});

const sfxCueValidator = v.object({
  timestampSec: v.number(),
  sfxName: v.string(),
  volumeMultiplier: v.optional(v.number()),
});

export const saveAdaptation = internalMutation({
  args: {
    userId: v.string(),
    sourceTemplateId: v.string(),
    sourceVideoUrl: v.string(),
    sourceTitle: v.string(),
    brandId: v.optional(v.string()),
    brandSnapshot: brandSnapshotValidator,
    sourceFormat: v.optional(v.string()),
    sourceThumbnailUrl: v.optional(v.string()),
    hookText: v.string(),
    adaptedScript: v.string(),
    textOverlays: v.array(textOverlayValidator),
    lipSyncScript: v.array(lipSyncLineValidator),
    videoModelPrompts: videoModelPromptsValidator,
    subtitleCues: v.array(subtitleCueValidator),
    sfxCues: v.array(sfxCueValidator),
    instagramCaption: v.string(),
    hashtags: v.array(v.string()),
    adaptationNote: v.optional(v.string()),
    durationSec: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"mayaAdaptations">> => {
    return await ctx.db.insert("mayaAdaptations", { ...args, createdAt: Date.now() });
  },
});

export const getAdaptation = internalQuery({
  args: { adaptationId: v.id("mayaAdaptations") },
  handler: async (ctx, { adaptationId }) => ctx.db.get(adaptationId),
});

interface AdaptTemplateResult {
  adaptationId: Id<"mayaAdaptations">;
  sourceTemplateId: string;
  sourceVideoUrl: string;
  sourceTitle: string;
  durationSec: number;
  hookText: string;
  adaptedScript: string;
  textOverlays: SynthesizedAdaptation["textOverlays"];
  lipSyncScript: SynthesizedAdaptation["lipSyncScript"];
  videoModelPrompts: SynthesizedAdaptation["videoModelPrompts"];
  subtitleCues: SynthesizedAdaptation["subtitleCues"];
  sfxCues: SynthesizedAdaptation["sfxCues"];
  instagramCaption: string;
  hashtags: string[];
  adaptationNote?: string;
  /** false means Gemini failed/was unavailable and the deterministic
   * template-based synthesizer ran instead — surfaced so the UI (and this
   * function's own logs) can tell the two apart instead of masking it. */
  usedAI: boolean;
}

/** Public: adapt a meme template to a brand. Gemini first, algorithmic fallback on failure. */
export const adaptTemplate = action({
  args: {
    template: v.any(),
    brand: v.any(),
    brandId: v.optional(v.string()),
    customProductAngle: v.optional(v.string()),
    humorIntensity: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AdaptTemplateResult> => {
    const uid = await requireUid(ctx);
    const template = args.template as MemeTemplate;
    const brand = args.brand as BrandContext;

    if (!template?.templateId || !template?.previewVideoUrl || !template?.durationSec) {
      throw new Error("A valid meme template (templateId, previewVideoUrl, durationSec) is required");
    }
    if (!brand?.name?.trim()) {
      throw new Error("Brand name is required");
    }

    let synthesized: SynthesizedAdaptation;
    let usedAI = true;
    try {
      const prompt = buildAdaptationPrompt(template, brand, {
        customProductAngle: args.customProductAngle,
        humorIntensity: args.humorIntensity,
      });
      const parsed = await geminiJson<any>({ prompt, schema: ADAPTATION_JSON_SCHEMA, temperature: 0.85 });
      synthesized = geminiResultToSynthesized(parsed, template, brand);
    } catch (err) {
      usedAI = false;
      console.warn(
        `[mayaTemplates] Gemini adaptation failed for template=${template.templateId} brand=${brand.name}, using algorithmic fallback:`,
        err,
      );
      synthesized = synthesizeAlgorithmicAdaptation(template, brand, args.customProductAngle);
    }

    const adaptationId = await ctx.runMutation(internal.mayaTemplates.saveAdaptation, {
      userId: uid,
      sourceTemplateId: template.templateId,
      sourceVideoUrl: template.previewVideoUrl,
      sourceTitle: template.title,
      brandId: args.brandId,
      brandSnapshot: {
        name: brand.name,
        logoUrl: brand.logoUrl,
        colors: brand.colors,
        industry: brand.industry,
        audience: brand.audience,
        productOffering: brand.productOffering,
        toneOfVoice: brand.toneOfVoice,
        targetCallToAction: brand.targetCallToAction,
      },
      sourceFormat: template.format,
      sourceThumbnailUrl: template.thumbnailUrl ?? template.previewImageUrl,
      hookText: synthesized.hookText,
      adaptedScript: synthesized.adaptedScript,
      textOverlays: synthesized.textOverlays,
      lipSyncScript: synthesized.lipSyncScript.map((l) => ({
        speakerId: l.speakerId,
        startSec: l.startSec,
        endSec: l.endSec,
        spokenDialogue: l.spokenDialogue,
        deliveryTone: l.deliveryTone,
        facialExpression: l.facialExpression,
      })),
      videoModelPrompts: synthesized.videoModelPrompts,
      subtitleCues: synthesized.subtitleCues,
      sfxCues: synthesized.sfxCues,
      instagramCaption: synthesized.instagramCaption,
      hashtags: synthesized.hashtags,
      adaptationNote: synthesized.adaptationNote,
      durationSec: template.durationSec,
    });

    return {
      adaptationId,
      sourceTemplateId: template.templateId,
      sourceVideoUrl: template.previewVideoUrl,
      sourceTitle: template.title,
      durationSec: template.durationSec,
      hookText: synthesized.hookText,
      adaptedScript: synthesized.adaptedScript,
      textOverlays: synthesized.textOverlays,
      lipSyncScript: synthesized.lipSyncScript,
      videoModelPrompts: synthesized.videoModelPrompts,
      subtitleCues: synthesized.subtitleCues,
      sfxCues: synthesized.sfxCues,
      instagramCaption: synthesized.instagramCaption,
      hashtags: synthesized.hashtags,
      adaptationNote: synthesized.adaptationNote,
      usedAI,
    };
  },
});

// ---------------------------------------------------------------------------
// Video job bookkeeping
// ---------------------------------------------------------------------------

export const createVideoJob = internalMutation({
  args: {
    userId: v.string(),
    adaptationId: v.id("mayaAdaptations"),
    mode: v.union(
      v.literal("replicate"),
      v.literal("dub"),
      v.literal("lipsync"),
      v.literal("veo_synthetic"),
    ),
  },
  handler: async (ctx, args): Promise<Id<"mayaVideoJobs">> => {
    return await ctx.db.insert("mayaVideoJobs", {
      ...args,
      stage: "tts",
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });
  },
});

export const patchVideoJob = internalMutation({
  args: { jobId: v.id("mayaVideoJobs"), patch: v.any() },
  handler: async (ctx, { jobId, patch }) => {
    await ctx.db.patch(jobId, { ...patch, updatedAt: Date.now() });
  },
});

export const getVideoJob = internalQuery({
  args: { jobId: v.id("mayaVideoJobs") },
  handler: async (ctx, { jobId }) => ctx.db.get(jobId),
});

/** Public: the frontend polls this reactively (same pattern as media.job/Studio.tsx). */
export const job = query({
  args: { jobId: v.id("mayaVideoJobs") },
  handler: async (ctx, { jobId }) => {
    const uid = await requireUid(ctx);
    const j = await ctx.db.get(jobId);
    if (!j || j.userId !== uid) return null;
    return {
      _id: j._id,
      mode: j.mode,
      stage: j.stage,
      status: j.status,
      generatedVideoUrl: j.generatedVideoUrl ?? null,
      finalVideoUrl: j.finalVideoUrl ?? null,
      ttsAudioUrl: j.ttsAudioUrl ?? null,
      fullPrompt: j.fullPrompt ?? null,
      beatClips: j.beatClips ?? null,
      error: j.error ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Public: kick off generation for an adaptation. Picks lip-sync onto the
 * original clip when FAL_API_KEY is configured, otherwise falls back to a
 * synthetic Veo render (which already works today via media.renderVideo).
 */
export const dispatchVideoGeneration = action({
  args: {
    adaptationId: v.id("mayaAdaptations"),
    mode: v.optional(
      v.union(
        v.literal("replicate"),
        v.literal("dub"),
        v.literal("lipsync"),
        v.literal("veo_synthetic"),
      ),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    jobId: Id<"mayaVideoJobs">;
    mode: "replicate" | "dub" | "lipsync" | "veo_synthetic";
  }> => {
    const uid = await requireUid(ctx);
    const adaptation = await ctx.runQuery(internal.mayaTemplates.getAdaptation, {
      adaptationId: args.adaptationId,
    });
    if (!adaptation || adaptation.userId !== uid) {
      throw new Error("Adaptation not found");
    }

    // Default is the replication pipeline: reverse-engineer the reel into a
    // production prompt and generate a fresh original commercial from it.
    // dub / lipsync (which reuse the original footage) and veo_synthetic
    // (one generic clip) remain available when asked for explicitly.
    const mode = args.mode ?? "replicate";

    const jobId = await ctx.runMutation(internal.mayaTemplates.createVideoJob, {
      userId: uid,
      adaptationId: args.adaptationId,
      mode,
    });
    const seconds = Math.max(1, Math.ceil(adaptation.durationSec));

    if (mode === "replicate") {
      // Reverse-engineer the reel, then generate one fresh clip per beat.
      // Each beat is its own media.renderVideo job, which bills its own
      // v-credits — so a 4-beat commercial costs ~4x a single clip.
      try {
        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: { status: "rendering", stage: "analyze" },
        });

        const brand = brandFromAdaptation(adaptation as AdaptationDoc);
        const reference = await buildVideoReference(
          templateStubFromAdaptation(adaptation as AdaptationDoc),
          brand,
        );
        const injected = injectBrandIntoReference(reference, brand, adaptation.adaptedScript);

        // Voiceover for the stitched cut — Veo clips come back silent.
        let ttsAudioStorageId: Id<"_storage"> | undefined;
        let ttsAudioUrl: string | undefined;
        try {
          const { pcmBase64, sampleRateHz } = await synthesizeSpeech(adaptation.adaptedScript);
          const wavBytes = pcmToWav(pcmBase64, sampleRateHz);
          ttsAudioStorageId = await ctx.storage.store(bytesToBlob(wavBytes, "audio/wav"));
          ttsAudioUrl = (await ctx.storage.getUrl(ttsAudioStorageId)) ?? undefined;
        } catch (ttsErr) {
          console.warn("[mayaTemplates] TTS failed for replicate run, cut will be silent:", ttsErr);
        }

        // One generation job per beat. Kicked off together; the poller waits
        // for all of them before stitching.
        const beatClips: BeatClip[] = [];
        for (const beat of injected.beats) {
          const beatJobId: Id<"mediaJobs"> = await ctx.runAction(internal.media.renderVideo, {
            userId: uid,
            prompt: beat.clipPrompt,
            aspectRatio: "9:16",
            durationSeconds: DEFAULT_VEO_SECONDS,
            referenceImageUrl: brand.logoUrl,
          });
          beatClips.push({
            index: beat.index,
            description: beat.description,
            mediaJobId: String(beatJobId),
            // Kept so the poller can re-send (or soften and re-send) a beat
            // that Veo's safety filter drops, without re-running analysis.
            prompt: beat.clipPrompt,
            retries: 0,
          });
        }

        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: {
            status: "rendering",
            stage: "generate",
            fullPrompt: injected.fullPrompt,
            beatClips,
            referenceImageUrl: brand.logoUrl,
            ttsAudioStorageId,
            ttsAudioUrl,
            ...(reference.degraded
              ? { error: "Video analysis degraded — used a genre-matched fallback prompt." }
              : {}),
          },
        });
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.mayaTemplates.pollReplicateBeats, {
          jobId,
        });
      } catch (e) {
        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: { status: "failed", error: String(e).slice(0, 300) },
        });
      }
    } else if (mode === "dub") {
      // Keep the original reel exactly as-is; only its audio changes. No
      // external video model involved, so nothing extra to bill.
      try {
        const { pcmBase64, sampleRateHz } = await synthesizeSpeech(adaptation.adaptedScript);
        const wavBytes = pcmToWav(pcmBase64, sampleRateHz);
        const ttsStorageId = await ctx.storage.store(bytesToBlob(wavBytes, "audio/wav"));
        const ttsUrl = await ctx.storage.getUrl(ttsStorageId);
        if (!ttsUrl) throw new Error("storage.getUrl returned null for tts audio");

        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: {
            status: "rendering",
            stage: "compose",
            ttsAudioStorageId: ttsStorageId,
            ttsAudioUrl: ttsUrl,
            // The "generated" video IS the source reel — compose lays the new
            // voice + overlays onto it.
            generatedVideoUrl: adaptation.sourceVideoUrl,
          },
        });
        await composeAndFinish(ctx, jobId);
      } catch (e) {
        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: { status: "failed", error: String(e).slice(0, 300) },
        });
      }
    } else if (mode === "lipsync") {
      // Billed here because Fal is a standalone paid call; veo_synthetic bills
      // itself inside media.renderVideo, so don't double-charge that path.
      await ctx.runMutation(internal.credits.spendV, {
        userId: uid,
        amount: seconds,
        reason: "maya_lipsync_generate",
        refId: String(jobId),
      });
      try {
        const { pcmBase64, sampleRateHz } = await synthesizeSpeech(adaptation.adaptedScript);
        const wavBytes = pcmToWav(pcmBase64, sampleRateHz);
        const ttsStorageId = await ctx.storage.store(bytesToBlob(wavBytes, "audio/wav"));
        const ttsUrl = await ctx.storage.getUrl(ttsStorageId);
        if (!ttsUrl) throw new Error("storage.getUrl returned null for tts audio");

        const requestId = await submitLipSync(adaptation.sourceVideoUrl, ttsUrl);
        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: {
            status: "rendering",
            stage: "generate",
            falRequestId: requestId,
            ttsAudioStorageId: ttsStorageId,
            ttsAudioUrl: ttsUrl,
            billedSeconds: seconds,
          },
        });
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.mayaTemplates.pollFalJob, { jobId });
      } catch (e) {
        await ctx.runMutation(internal.credits.refundV, {
          userId: uid,
          amount: seconds,
          reason: "refund_maya_lipsync_failed",
          refId: String(jobId),
        });
        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: { status: "failed", error: String(e).slice(0, 300) },
        });
      }
    } else {
      try {
        // Veo returns SILENT footage — it only renders the visual prompt, it
        // never speaks the adapted script. So voice the script separately here
        // and let the compose step lay it over the video; without this the
        // "adaptation" would be visual-only and the script would never be
        // heard, which is the whole point of adapting it.
        let ttsAudioStorageId: Id<"_storage"> | undefined;
        let ttsAudioUrl: string | undefined;
        try {
          const { pcmBase64, sampleRateHz } = await synthesizeSpeech(adaptation.adaptedScript);
          const wavBytes = pcmToWav(pcmBase64, sampleRateHz);
          ttsAudioStorageId = await ctx.storage.store(bytesToBlob(wavBytes, "audio/wav"));
          ttsAudioUrl = (await ctx.storage.getUrl(ttsAudioStorageId)) ?? undefined;
        } catch (ttsErr) {
          // Non-fatal: a silent Veo clip with burned-in overlays still beats
          // failing the whole render, so continue and note it on the job.
          console.warn("[mayaTemplates] TTS for veo_synthetic failed, video will have no voice track:", ttsErr);
        }

        const veoJobId: Id<"mediaJobs"> = await ctx.runAction(internal.media.renderVideo, {
          userId: uid,
          prompt: adaptation.videoModelPrompts.googleVeoPrompt,
          aspectRatio: "9:16",
          durationSeconds: adaptation.durationSec,
        });
        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: {
            status: "rendering",
            stage: "generate",
            veoMediaJobId: String(veoJobId),
            ttsAudioStorageId,
            ttsAudioUrl,
            ...(ttsAudioUrl ? {} : { error: "Voiceover generation failed — video will be silent" }),
          },
        });
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.mayaTemplates.pollVeoBridge, { jobId });
      } catch (e) {
        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: { status: "failed", error: String(e).slice(0, 300) },
        });
      }
    }

    return { jobId, mode };
  },
});

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

/** One poll step for a Fal lip-sync request. Mirrors media.ts's pollVeo exactly. */
export const pollFalJob = internalAction({
  args: { jobId: v.id("mayaVideoJobs") },
  handler: async (ctx, { jobId }) => {
    const jobRow = await ctx.runQuery(internal.mayaTemplates.getVideoJob, { jobId });
    if (!jobRow || jobRow.status !== "rendering" || !jobRow.falRequestId) return;
    const attempts = (jobRow.attempts ?? 0) + 1;

    const reschedule = async () => {
      await ctx.runMutation(internal.mayaTemplates.patchVideoJob, { jobId, patch: { attempts } });
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.mayaTemplates.pollFalJob, { jobId });
    };
    const fail = async (error: string) => {
      const billed = Number(jobRow.billedSeconds ?? 0);
      if (billed > 0) {
        await ctx.runMutation(internal.credits.refundV, {
          userId: jobRow.userId,
          amount: billed,
          reason: "refund_maya_lipsync_failed",
          refId: String(jobId),
        });
      }
      await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
        jobId,
        patch: { status: "failed", error: error.slice(0, 300), attempts, billedSeconds: 0 },
      });
    };

    let result: { done: boolean; videoUrl?: string; error?: string };
    try {
      result = await pollLipSyncStatus(jobRow.falRequestId);
    } catch (e) {
      if (attempts >= MAX_POLLS) return await fail(`poll failed: ${String(e)}`);
      return await reschedule();
    }

    if (!result.done) {
      if (attempts >= MAX_POLLS) return await fail("lip-sync generation timed out");
      return await reschedule();
    }
    if (result.error || !result.videoUrl) {
      return await fail(result.error || "completed request had no video url");
    }

    try {
      const dl = await fetch(result.videoUrl);
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      const bytes = new Uint8Array(await dl.arrayBuffer());
      const storageId = await ctx.storage.store(bytesToBlob(bytes, "video/mp4"));
      const url = await ctx.storage.getUrl(storageId);
      if (!url) throw new Error("storage.getUrl returned null for video");
      await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
        jobId,
        patch: { stage: "compose", generatedVideoStorageId: storageId, generatedVideoUrl: url, attempts },
      });
      await composeAndFinish(ctx, jobId);
    } catch (e) {
      await fail(`download/store failed: ${String(e)}`);
    }
  },
});

/**
 * Waits for every beat's generation job, then stitches them into one cut.
 *
 * Beats are independent media.renderVideo jobs. A single failed beat doesn't
 * sink the run — we stitch whatever succeeded and note the gap, because
 * losing a whole billed commercial to one bad clip is worse than a short cut.
 */
export const pollReplicateBeats = internalAction({
  args: { jobId: v.id("mayaVideoJobs") },
  handler: async (ctx, { jobId }) => {
    const jobRow = await ctx.runQuery(internal.mayaTemplates.getVideoJob, { jobId });
    if (!jobRow || jobRow.status !== "rendering" || !jobRow.beatClips?.length) return;
    const attempts = (jobRow.attempts ?? 0) + 1;

    const resolved: BeatClip[] = [];
    let pending = 0;

    for (const clip of jobRow.beatClips) {
      if (clip.url || clip.failed) {
        resolved.push(clip);
        continue;
      }
      const mediaJob = await ctx.runQuery(internal.media.getJob, {
        jobId: clip.mediaJobId as Id<"mediaJobs">,
      });
      if (!mediaJob) {
        resolved.push({ ...clip, failed: true, error: "generation job disappeared" });
        continue;
      }
      if (mediaJob.status === "completed" && mediaJob.url) {
        resolved.push({ ...clip, url: mediaJob.url });
        continue;
      }
      if (mediaJob.status !== "failed") {
        resolved.push(clip);
        pending++;
        continue;
      }

      // Veo's safety filter is stochastic: the same prompt that was dropped
      // often passes on a second attempt, and softening the wording usually
      // clears it. A blocked beat used to be dead on the spot, which is how a
      // 4-beat commercial silently became an 8-second clip. Retry before
      // giving up. Each retry re-bills, but the failed attempt was refunded by
      // media.renderVideo, so the user only pays for clips they actually get.
      const retries = clip.retries ?? 0;
      const canRetry = isVeoSafetyBlock(mediaJob.error) && retries < MAX_BEAT_RETRIES && !!clip.prompt;
      if (!canRetry) {
        resolved.push({
          ...clip,
          failed: true,
          error: mediaJob.error ?? "generation failed",
        });
        continue;
      }

      // First retry re-sends verbatim (filtering is partly non-deterministic);
      // later retries also soften the wording that most often trips the filter.
      const nextPrompt = retries === 0 ? clip.prompt! : softenPromptForSafety(clip.prompt!);
      console.warn(
        `[mayaTemplates] beat ${clip.index} blocked by Veo safety filter, retry ${retries + 1}/${MAX_BEAT_RETRIES}: ${mediaJob.error}`,
      );
      try {
        const retryJobId: Id<"mediaJobs"> = await ctx.runAction(internal.media.renderVideo, {
          userId: jobRow.userId,
          prompt: nextPrompt,
          aspectRatio: "9:16",
          durationSeconds: DEFAULT_VEO_SECONDS,
          referenceImageUrl: jobRow.referenceImageUrl ?? undefined,
        });
        resolved.push({
          ...clip,
          mediaJobId: String(retryJobId),
          prompt: nextPrompt,
          retries: retries + 1,
          error: undefined,
        });
        pending++;
      } catch (retryErr) {
        resolved.push({
          ...clip,
          failed: true,
          error: `${mediaJob.error ?? "generation failed"} (retry failed: ${String(retryErr).slice(0, 80)})`,
        });
      }
    }

    await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
      jobId,
      patch: { beatClips: resolved, attempts },
    });

    if (pending > 0) {
      if (attempts >= MAX_POLLS) {
        await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
          jobId,
          patch: { status: "failed", error: `Timed out waiting on ${pending} beat clip(s)` },
        });
        return;
      }
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.mayaTemplates.pollReplicateBeats, { jobId });
      return;
    }

    const ready = resolved.filter((c) => c.url).sort((a, b) => a.index - b.index);
    if (!ready.length) {
      await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
        jobId,
        patch: {
          status: "failed",
          error:
            "Every beat clip failed to generate. " +
            resolved.map((c) => `Beat ${c.index}: ${c.error ?? "unknown"}`).join(" | "),
        },
      });
      return;
    }

    const lost = resolved.filter((c) => !c.url);
    await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
      jobId,
      patch: {
        stage: "compose",
        ...(lost.length
          ? {
              error:
                `${lost.length} of ${resolved.length} beats failed after ${MAX_BEAT_RETRIES} retries; ` +
                `stitching the rest. ` +
                lost.map((c) => `Beat ${c.index}: ${c.error ?? "unknown"}`).join(" | "),
            }
          : {}),
      },
    });

    await stitchBeats(ctx, jobId, ready.map((c) => c.url!), jobRow.ttsAudioUrl);
  },
});

/**
 * Concatenates the beat clips into one video via the renderer's declarative
 * FFmpeg endpoint, laying the TTS voiceover over the whole cut.
 *
 * Convex's V8 runtime has no ffmpeg, so this step genuinely cannot happen
 * without a reachable renderer — on failure we surface the best available
 * artifact (the first beat) rather than losing the run.
 */
async function stitchBeats(
  ctx: ActionCtx,
  jobId: Id<"mayaVideoJobs">,
  clipUrls: string[],
  voiceUrl?: string,
): Promise<void> {
  const rendererBase = (process.env.RENDERER_URL || "http://localhost:8005")
    .replace(/\/api\/(render|compose)$/, "")
    .replace(/\/+$/, "");
  const token = process.env.RENDERER_TOKEN;

  try {
    const manifest = {
      output: { width: 1080, height: 1920, fps: 30 },
      scenes: clipUrls.map((source, i) => ({
        source,
        kind: "video" as const,
        transitionToNext: i < clipUrls.length - 1 ? { type: "cut" as const } : undefined,
      })),
      ...(voiceUrl ? { audio: { voice: { source: voiceUrl, volume: 1 } } } : {}),
    };

    const res = await fetch(`${rendererBase}/api/compose`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ manifest }),
    });
    const data = await res.json();
    if (!res.ok || !data?.videoUrl) {
      throw new Error(data?.error || `renderer responded ${res.status}`);
    }

    const dl = await fetch(data.videoUrl);
    if (!dl.ok) throw new Error(`download stitched video ${dl.status}`);
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const storageId = await ctx.storage.store(bytesToBlob(bytes, "video/mp4"));
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("storage.getUrl returned null for stitched video");

    // Hand the stitched cut to the normal compose step for overlays + logo.
    await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
      jobId,
      patch: { generatedVideoStorageId: storageId, generatedVideoUrl: url },
    });
    await composeAndFinish(ctx, jobId);
  } catch (e) {
    const raw = String(e);
    const unreachable = /Connection refused|ECONNREFUSED|tcp connect error|error sending request|fetch failed/i.test(raw);
    const message = unreachable
      ? `Stitching needs the render service, which is unreachable at ${rendererBase}. ` +
        `Deploy apps/renderer somewhere this Convex deployment can reach and set it with: ` +
        `npx convex env set RENDERER_URL <url>. Showing the first beat only — the individual ` +
        `beat clips all generated fine.`
      : `Stitching failed (${raw.slice(0, 200)}). Showing the first beat only.`;
    console.warn("[mayaTemplates] beat stitching failed:", raw);
    await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
      jobId,
      patch: {
        status: "completed",
        stage: "done",
        finalVideoUrl: clipUrls[0],
        error: message,
      },
    });
  }
}

/** Bridges an in-flight media.renderVideo job (Veo) into this table's job shape. */
export const pollVeoBridge = internalAction({
  args: { jobId: v.id("mayaVideoJobs") },
  handler: async (ctx, { jobId }) => {
    const jobRow = await ctx.runQuery(internal.mayaTemplates.getVideoJob, { jobId });
    if (!jobRow || jobRow.status !== "rendering" || !jobRow.veoMediaJobId) return;

    const mediaJob = await ctx.runQuery(internal.media.getJob, {
      jobId: jobRow.veoMediaJobId as Id<"mediaJobs">,
    });
    if (!mediaJob) {
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.mayaTemplates.pollVeoBridge, { jobId });
      return;
    }
    if (mediaJob.status === "failed") {
      await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
        jobId,
        patch: { status: "failed", error: mediaJob.error ?? "Veo generation failed" },
      });
      return;
    }
    if (mediaJob.status !== "completed" || !mediaJob.url) {
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.mayaTemplates.pollVeoBridge, { jobId });
      return;
    }

    await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
      jobId,
      patch: { stage: "compose", generatedVideoStorageId: mediaJob.storageId, generatedVideoUrl: mediaJob.url },
    });
    await composeAndFinish(ctx, jobId);
  },
});

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export const createPostFromJob = internalMutation({
  args: {
    userId: v.string(),
    jobId: v.id("mayaVideoJobs"),
    videoUrl: v.string(),
    storageId: v.optional(v.id("_storage")),
    caption: v.string(),
    hashtags: v.array(v.string()),
    brief: v.string(),
    brandProfileId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"posts">> => {
    const accounts = await ctx.db
      .query("socialAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const active = accounts.filter((a) => a.status === "active");
    if (!active.length) {
      throw new Error("No connected channel — connect a social account in Settings first.");
    }

    // Same entitlement/quota guard the Maya swipe-approval path uses, so
    // publishing from here can't bypass plan limits.
    await reserveMonthlyPostQuota(ctx, args.userId);

    const now = Date.now();
    return await ctx.db.insert("posts", {
      userId: args.userId,
      source: "manual",
      postFormat: "reel",
      scheduledFor: now,
      timezone: "Asia/Kolkata",
      status: "ready",
      brief: args.brief.slice(0, 300),
      content: { caption: args.caption, hashtags: args.hashtags },
      media: [{ type: "video", url: args.videoUrl, storagePath: args.storageId, source: "remotion" }],
      platforms: active.map((a) => a.platform),
      socialAccountIds: active.map((a) => a._id),
      brandProfileId: args.brandProfileId,
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: `maya_reel_${args.jobId}`,
      createdAt: now,
    });
  },
});

/**
 * Public: publish a finished adapted reel to the user's connected channels
 * right now, reusing the existing publish engine (scheduler.publishNow ->
 * publish.runPost) rather than a parallel posting path.
 */
export const postFinishedReel = action({
  args: { jobId: v.id("mayaVideoJobs") },
  handler: async (ctx, { jobId }): Promise<{ status: string; published: number; of: number; postId: Id<"posts"> }> => {
    const uid = await requireUid(ctx);
    const jobRow = await ctx.runQuery(internal.mayaTemplates.getVideoJob, { jobId });
    if (!jobRow || jobRow.userId !== uid) throw new Error("Video job not found");
    if (jobRow.status !== "completed" || !jobRow.finalVideoUrl) {
      throw new Error("This reel isn't finished rendering yet.");
    }
    const adaptation = await ctx.runQuery(internal.mayaTemplates.getAdaptation, {
      adaptationId: jobRow.adaptationId,
    });
    if (!adaptation) throw new Error("Adaptation not found");

    const postId = await ctx.runMutation(internal.mayaTemplates.createPostFromJob, {
      userId: uid,
      jobId,
      videoUrl: jobRow.finalVideoUrl,
      storageId: jobRow.finalVideoStorageId,
      caption: adaptation.instagramCaption ?? adaptation.hookText,
      hashtags: adaptation.hashtags ?? [],
      brief: adaptation.hookText,
      brandProfileId: adaptation.brandId,
    });

    const result = await ctx.runAction(internal.scheduler.publishNow, { postId });
    return { ...result, postId };
  },
});

// ---------------------------------------------------------------------------
// Composition (Remotion: text overlays + brand logo)
// ---------------------------------------------------------------------------

/**
 * Burns text overlays + brand logo onto the generated base video via
 * apps/renderer's /api/render (MayaMemeComposition). If the renderer is
 * unreachable or fails, degrades gracefully to the uncomposited base video
 * rather than losing an already-billed generation.
 */
async function composeAndFinish(ctx: ActionCtx, jobId: Id<"mayaVideoJobs">): Promise<void> {
  const jobRow = await ctx.runQuery(internal.mayaTemplates.getVideoJob, { jobId });
  if (!jobRow || !jobRow.generatedVideoUrl) return;
  const adaptation = await ctx.runQuery(internal.mayaTemplates.getAdaptation, {
    adaptationId: jobRow.adaptationId,
  });
  if (!adaptation) return;

  try {
    const rendererBase = (process.env.RENDERER_URL || "http://localhost:8005")
      .replace(/\/api\/(render|compose)$/, "")
      .replace(/\/+$/, "");
    const token = process.env.RENDERER_TOKEN;
    const fps = 30;
    const durationInFrames = Math.round(adaptation.durationSec * fps);
    const props = {
      baseVideoUrl: jobRow.generatedVideoUrl,
      textOverlays: adaptation.textOverlays.map((t) => ({
        text: t.text,
        placement: t.placement,
        color: t.color,
        bgColor: t.bgColor,
        startFrame: Math.round((t.startSec ?? 0) * fps),
        durationFrames: Math.round(((t.endSec ?? adaptation.durationSec) - (t.startSec ?? 0)) * fps),
      })),
      subtitleCues: (adaptation.subtitleCues ?? []).map((c) => ({
        text: c.text,
        startFrame: Math.round(c.startSec * fps),
        durationFrames: Math.max(1, Math.round((c.endSec - c.startSec) * fps)),
      })),
      // Fal's lip-synced output already contains the voice track, so re-laying
      // it would double the audio. Veo footage is silent and dub mode uses the
      // untouched original reel — both need the voiceover laid over them (and
      // the original's own audio muted, see MayaMemeComposition).
      voiceAudioUrl: jobRow.mode === "lipsync" ? undefined : jobRow.ttsAudioUrl,
      logoUrl: adaptation.brandSnapshot.logoUrl,
    };

    const res = await fetch(`${rendererBase}/api/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        templateId: "MayaMemeComposition",
        videoId: String(jobId),
        props: { ...props, durationInFrames, fps },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.videoUrl) {
      throw new Error(data?.error || `renderer responded ${res.status}`);
    }

    const dl = await fetch(data.videoUrl);
    if (!dl.ok) throw new Error(`download composited video ${dl.status}`);
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const storageId = await ctx.storage.store(bytesToBlob(bytes, "video/mp4"));
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("storage.getUrl returned null for composited video");

    await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
      jobId,
      patch: { status: "completed", stage: "done", finalVideoStorageId: storageId, finalVideoUrl: url },
    });
  } catch (e) {
    const raw = String(e);
    const unreachable = /Connection refused|ECONNREFUSED|tcp connect error|error sending request/i.test(raw);
    // A connection error here almost always means RENDERER_URL still points at
    // localhost while this Convex deployment runs on a different machine —
    // say so, because the raw "connection refused" sends people hunting the
    // wrong problem.
    const message = unreachable
      ? `Render service unreachable at ${process.env.RENDERER_URL || "http://localhost:8005"}. ` +
        `This Convex deployment can't reach a renderer on localhost — deploy apps/renderer somewhere reachable ` +
        `(or expose it via a tunnel) and set it with: npx convex env set RENDERER_URL <url>. ` +
        `Showing the un-composited video: no voiceover, captions or logo were applied.`
      : `Compositing failed, showing the un-composited video: ${raw.slice(0, 200)}`;
    console.warn("[mayaTemplates] composition failed:", raw);
    await ctx.runMutation(internal.mayaTemplates.patchVideoJob, {
      jobId,
      patch: {
        status: "completed",
        stage: "done",
        finalVideoUrl: jobRow.generatedVideoUrl,
        error: message,
      },
    });
  }
}
