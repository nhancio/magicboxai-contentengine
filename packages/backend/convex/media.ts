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
import { geminiImage } from "./lib/gemini";
import { GEMINI_API_BASE, MODELS, requireGeminiKey } from "./lib/models";
import { DEFAULT_VEO_SECONDS } from "./credits";

/**
 * AI MEDIA GENERATION — the piece the core loop was missing.
 *
 * Maya/Studio previously produced a `mediaPlan` (a *text prompt* describing the
 * visual) but nothing rendered it, so approved posts would go out text-only and
 * media-required platforms (YouTube) would fail. This module turns a prompt into
 * a real asset stored in Convex file storage, with a URL the publish pipeline
 * can hand to a provider.
 *
 * TWO PATHS, because the models behave very differently:
 *   IMAGE (Gemini image)  — synchronous. One call returns base64; we store it and
 *                           return a URL immediately.
 *   VIDEO (Veo)           — a long-running operation that takes minutes. It CANNOT
 *                           be awaited inside one action, so it's a durable JOB:
 *                           start → record operationName → a scheduled `pollVeo`
 *                           resumes from the row until the video is ready. This is
 *                           what fixes the flagged Firebase bug where a crash
 *                           mid-poll silently lost a paid render.
 */

const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 40; // ~10 min ceiling before we call a Veo render dead
const MAX_GENERATION_PROMPT_LENGTH = 8_000;
const MAX_VIDEO_SECONDS = 30;

const VERTICAL = new Set(["instagram", "youtube", "facebook", "reddit"]);

/** Short-form verticals want 9:16; feed-first platforms read better square. */
export function aspectForPlatform(platform?: string): string {
  if (!platform) return "9:16";
  return VERTICAL.has(platform) ? "9:16" : "1:1";
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Build a Blob from raw bytes. The `as BlobPart` cast bridges a TS lib mismatch:
 * the web app's DOM lib types Uint8Array as `Uint8Array<ArrayBufferLike>` which
 * isn't structurally a `BlobPart`, even though it is one at runtime. This file is
 * typechecked by both the web build and the Convex build, so the cast keeps both
 * happy without weakening the runtime.
 */
function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type });
}

// ---------------------------------------------------------------------------
// Job bookkeeping
// ---------------------------------------------------------------------------

const targetValidator = v.object({
  kind: v.union(v.literal("suggestion"), v.literal("post")),
  id: v.string(),
});

export const createJob = internalMutation({
  args: {
    userId: v.string(),
    kind: v.union(v.literal("image"), v.literal("video")),
    prompt: v.string(),
    aspectRatio: v.optional(v.string()),
    target: v.optional(targetValidator),
  },
  handler: async (ctx, args): Promise<Id<"mediaJobs">> => {
    return await ctx.db.insert("mediaJobs", {
      userId: args.userId,
      kind: args.kind,
      status: "pending",
      prompt: args.prompt,
      aspectRatio: args.aspectRatio,
      target: args.target,
      attempts: 0,
      createdAt: Date.now(),
    });
  },
});

export const patchJob = internalMutation({
  args: { jobId: v.id("mediaJobs"), patch: v.any() },
  handler: async (ctx, { jobId, patch }) => {
    await ctx.db.patch(jobId, { ...patch, updatedAt: Date.now() });
  },
});

export const getJob = internalQuery({
  args: { jobId: v.id("mediaJobs") },
  handler: async (ctx, { jobId }) => ctx.db.get(jobId),
});

/** Only a completed Veo job owned by this user may skip a second post-time charge. */
export const isOwnedCompletedVideo = internalQuery({
  args: { userId: v.string(), url: v.string() },
  handler: async (ctx, { userId, url }) => {
    const jobs = await ctx.db
      .query("mediaJobs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return jobs.some((job) => job.kind === "video" && job.status === "completed" && job.url === url);
  },
});

/** Public: the Studio UI polls this while a video renders. Never leaks storage internals. */
export const job = query({
  args: { jobId: v.id("mediaJobs") },
  handler: async (ctx, { jobId }) => {
    const uid = await requireUid(ctx);
    const j = await ctx.db.get(jobId);
    if (!j || j.userId !== uid) return null;
    return { _id: j._id, kind: j.kind, status: j.status, url: j.url ?? null, error: j.error ?? null };
  },
});

/**
 * Attach a finished asset back to whatever requested it. For a post whose
 * publish was gated on a video ("generating"), this also releases it to the
 * scheduler by flipping to "scheduled" (or "draft" if no channel is connected).
 */
export const attachMedia = internalMutation({
  args: {
    target: targetValidator,
    type: v.union(v.literal("image"), v.literal("video")),
    url: v.string(),
    storagePath: v.optional(v.string()),
    source: v.union(v.literal("imagen"), v.literal("veo")),
  },
  handler: async (ctx, { target, type, url, storagePath, source }) => {
    const item = { type, url, storagePath, source } as const;

    if (target.kind === "suggestion") {
      const s = await ctx.db.get(target.id as Id<"suggestions">);
      if (!s) return;
      await ctx.db.patch(s._id, { media: [...(s.media ?? []), item], updatedAt: Date.now() });
      return;
    }

    const p = await ctx.db.get(target.id as Id<"posts">);
    if (!p) return;
    const patch: Record<string, unknown> = {
      media: [...(p.media ?? []), item],
      updatedAt: Date.now(),
    };
    if (p.status === "generating") {
      let next: "scheduled" | "draft" | "pending_approval" =
        p.socialAccountIds.length > 0 ? "scheduled" : "draft";
      if (next === "scheduled" && p.automationId) {
        const autoId = ctx.db.normalizeId("automations", p.automationId);
        const automation = autoId ? await ctx.db.get(autoId) : null;
        if (automation?.requiresApproval) next = "pending_approval";
      }
      patch.status = next;
    }
    await ctx.db.patch(p._id, patch);
  },
});

// ---------------------------------------------------------------------------
// Image (synchronous)
// ---------------------------------------------------------------------------

async function renderImageToStorage(
  ctx: ActionCtx,
  prompt: string,
  aspectRatio: string,
): Promise<{ url: string; storageId: Id<"_storage"> }> {
  const { mimeType, base64 } = await geminiImage({ prompt, aspectRatio });
  const bytes = base64ToBytes(base64);
  const storageId = await ctx.storage.store(bytesToBlob(bytes, mimeType));
  const url = await ctx.storage.getUrl(storageId);
  if (!url) throw new Error("[media] storage.getUrl returned null for image");
  return { url, storageId };
}

/** Internal: one-shot image render for automation posts (no extra i-credit). */
export const renderImageOnce = internalAction({
  args: {
    prompt: v.string(),
    aspectRatio: v.optional(v.string()),
  },
  returns: v.object({ url: v.string(), storageId: v.id("_storage") }),
  handler: async (ctx, { prompt, aspectRatio }) => {
    if (!prompt.trim() || prompt.length > MAX_GENERATION_PROMPT_LENGTH) {
      throw new Error("Image prompt must be between 1 and 8,000 characters");
    }
    const ratio = aspectRatio && ["1:1", "9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "1:1";
    return await renderImageToStorage(ctx, prompt, ratio);
  },
});

/** Public: Studio "generate image" — returns a ready-to-use URL immediately. */
export const generateImage = action({
  args: { prompt: v.string(), aspectRatio: v.optional(v.string()) },
  handler: async (ctx, { prompt, aspectRatio }): Promise<{ url: string; storageId: string }> => {
    const uid = await requireUid(ctx);
    if (!prompt.trim() || prompt.length > MAX_GENERATION_PROMPT_LENGTH) {
      throw new Error("Image prompt must be between 1 and 8,000 characters");
    }
    if (aspectRatio && !["1:1", "9:16", "16:9"].includes(aspectRatio)) {
      throw new Error("Unsupported image aspect ratio");
    }
    await ctx.runMutation(internal.credits.spendI, {
      userId: uid,
      amount: 1,
      reason: "generate_image",
    });
    try {
      const { url, storageId } = await renderImageToStorage(ctx, prompt, aspectRatio ?? "9:16");
      return { url, storageId };
    } catch (e) {
      await ctx.runMutation(internal.credits.refundI, {
        userId: uid,
        amount: 1,
        reason: "refund_generate_image_failed",
      });
      throw e;
    }
  },
});

/**
 * Maya deck preview: render a poster image for a suggestion and attach it, so the
 * swipe card shows a real visual. Best-effort — a failed preview must never break
 * a deck, so it swallows errors.
 */
export const renderImageForSuggestion = internalAction({
  args: { suggestionId: v.id("suggestions"), prompt: v.string(), aspectRatio: v.string() },
  handler: async (ctx, { suggestionId, prompt, aspectRatio }) => {
    try {
      const { url, storageId } = await renderImageToStorage(ctx, prompt, aspectRatio);
      await ctx.runMutation(internal.media.attachMedia, {
        target: { kind: "suggestion", id: suggestionId },
        type: "image",
        url,
        storagePath: storageId,
        source: "imagen",
      });
    } catch (e) {
      console.warn("[media] suggestion preview image failed", e);
    }
  },
});

// ---------------------------------------------------------------------------
// Video (durable, long-running)
// ---------------------------------------------------------------------------

/** Reference images are capped hard — they ride inline in the request body. */
const MAX_REFERENCE_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * Fetch an image and inline it for Veo. Best-effort: a missing or oversized
 * brand asset must degrade to a text-only render, never fail the whole job.
 */
async function fetchReferenceImage(
  url: string | undefined,
): Promise<{ mimeType: string; bytesBase64Encoded: string } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_REFERENCE_IMAGE_BYTES) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/png";
    if (!mimeType.startsWith("image/")) return null;

    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return { mimeType, bytesBase64Encoded: btoa(binary) };
  } catch (e) {
    console.warn("[veo] reference image fetch failed, rendering from text alone:", e);
    return null;
  }
}

async function postVeo(body: unknown): Promise<Response> {
  return await fetch(`${GEMINI_API_BASE}/models/${MODELS.video}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": requireGeminiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function startVeoOperation(
  prompt: string,
  aspectRatio: string,
  referenceImage?: { mimeType: string; bytesBase64Encoded: string } | null,
): Promise<string> {
  // personGeneration=allow_adult, NOT allow_all. allow_all additionally permits
  // generating minors and is allowlist-gated in most regions; when it isn't
  // granted, Veo does not reject the request — it accepts it and then silently
  // drops the sample through the RAI filter, which is indistinguishable from a
  // broken pipeline. Every character in this product is an adult anyway.
  const parameters = { aspectRatio, personGeneration: "allow_adult" };

  // A reference image is what keeps the product identical across beats that are
  // generated in separate calls sharing no context. Support for it varies by
  // Veo revision, so a rejection falls back to a text-only render rather than
  // losing the beat — a slightly less consistent clip beats no clip.
  if (referenceImage) {
    const res = await postVeo({
      instances: [
        {
          prompt,
          referenceImages: [{ image: referenceImage, referenceType: "asset" }],
        },
      ],
      parameters,
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.name) return data.name as string;
    } else {
      console.warn(
        `[veo] reference image rejected (${res.status}), retrying text-only: ${(await res.text()).slice(0, 200)}`,
      );
    }
  }

  const res = await postVeo({ instances: [{ prompt }], parameters });
  if (!res.ok) {
    throw new Error(`[veo] start ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data?.name) throw new Error("[veo] predictLongRunning returned no operation name");
  return data.name as string;
}

/**
 * Explain a Veo operation that finished successfully but produced no video.
 *
 * This is NOT a generic failure: `done: true` with no `error` and an empty
 * `generatedSamples` is how Veo reports that its Responsible-AI filter dropped
 * the render. The reason lives in `raiMediaFilteredReasons`, which we surfaced
 * as a useless "completed operation had no video uri" until this existed —
 * leaving a caller unable to tell a blocked prompt from a broken pipeline.
 *
 * The field has moved between API revisions, so check both known locations.
 */
function describeEmptyVeoResponse(data: any): string {
  const inner = data?.response?.generateVideoResponse ?? data?.response ?? {};
  const reasons: string[] = inner.raiMediaFilteredReasons ?? [];
  const count: number = Number(inner.raiMediaFilteredCount ?? 0);

  if (reasons.length) {
    return `blocked by Veo's safety filter: ${reasons.join("; ")}`;
  }
  if (count > 0) {
    return `blocked by Veo's safety filter (${count} sample(s) filtered, no reason given)`;
  }
  return "Veo returned no video and gave no reason (likely a silent safety filter)";
}

/** True when a job died because Veo's safety filter rejected it, not because of an outage. */
export function isVeoSafetyBlock(error: string | null | undefined): boolean {
  return typeof error === "string" && error.includes("safety filter");
}

/**
 * Kick off a Veo render as a durable job, then hand off to the scheduled poller.
 * Returns the jobId so callers (Studio) can watch it; the post path ignores it
 * and lets `attachMedia` release the post when the video lands.
 */
export const renderVideo = internalAction({
  args: {
    userId: v.string(),
    prompt: v.string(),
    aspectRatio: v.string(),
    target: v.optional(targetValidator),
    /** Seconds of video to bill (Veo default clip length). */
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"mediaJobs">> => {
    if (!args.prompt.trim() || args.prompt.length > MAX_GENERATION_PROMPT_LENGTH) {
      throw new Error("Video prompt must be between 1 and 8,000 characters");
    }
    // Product rule: every generated video is 9:16 (vertical Reel/Short shape),
    // never square or landscape — regardless of what the caller requested. This
    // is the single chokepoint for Studio, Maya and automation video renders.
    const aspectRatio = "9:16";
    const requestedSeconds = args.durationSeconds ?? DEFAULT_VEO_SECONDS;
    if (!Number.isFinite(requestedSeconds) || requestedSeconds < 1 || requestedSeconds > MAX_VIDEO_SECONDS) {
      throw new Error(`Video duration must be between 1 and ${MAX_VIDEO_SECONDS} seconds`);
    }
    const seconds = Math.ceil(requestedSeconds);
    await ctx.runMutation(internal.credits.spendV, {
      userId: args.userId,
      amount: seconds,
      reason: "generate_video",
    });

    const jobId = await ctx.runMutation(internal.media.createJob, {
      userId: args.userId,
      kind: "video",
      prompt: args.prompt,
      aspectRatio,
      target: args.target,
    });

    try {
      const operationName = await startVeoOperation(args.prompt, aspectRatio);
      await ctx.runMutation(internal.media.patchJob, {
        jobId,
        patch: { status: "rendering", operationName, billedSeconds: seconds },
      });
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.media.pollVeo, { jobId });
    } catch (e) {
      await ctx.runMutation(internal.credits.refundV, {
        userId: args.userId,
        amount: seconds,
        reason: "refund_generate_video_failed",
        refId: String(jobId),
      });
      await ctx.runMutation(internal.media.patchJob, {
        jobId,
        patch: { status: "failed", error: String(e).slice(0, 300) },
      });
    }
    return jobId;
  },
});

/** Public: Studio "generate video" — returns a jobId the UI polls via `job`. */
export const generateVideo = action({
  args: {
    prompt: v.string(),
    aspectRatio: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { prompt, aspectRatio, durationSeconds },
  ): Promise<{ jobId: Id<"mediaJobs"> }> => {
    const uid = await requireUid(ctx);
    const jobId: Id<"mediaJobs"> = await ctx.runAction(internal.media.renderVideo, {
      userId: uid,
      prompt,
      aspectRatio: aspectRatio ?? "9:16",
      durationSeconds,
    });
    return { jobId };
  },
});

/**
 * One poll step for a Veo operation. Re-schedules itself until the operation is
 * done or the attempt cap is hit — so it survives restarts and never blocks.
 */
export const pollVeo = internalAction({
  args: { jobId: v.id("mediaJobs") },
  handler: async (ctx, { jobId }) => {
    const jobRow = await ctx.runQuery(internal.media.getJob, { jobId });
    if (!jobRow || jobRow.status !== "rendering" || !jobRow.operationName) return;
    const attempts = (jobRow.attempts ?? 0) + 1;

    const key = requireGeminiKey();

    const reschedule = async () => {
      await ctx.runMutation(internal.media.patchJob, { jobId, patch: { attempts } });
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.media.pollVeo, { jobId });
    };
    const fail = async (error: string) => {
      const billed = Number((jobRow as any).billedSeconds ?? 0);
      if (billed > 0) {
        await ctx.runMutation(internal.credits.refundV, {
          userId: jobRow.userId,
          amount: billed,
          reason: "refund_generate_video_failed",
          refId: String(jobId),
        });
      }
      await ctx.runMutation(internal.media.patchJob, {
        jobId,
        patch: { status: "failed", error: error.slice(0, 300), attempts, billedSeconds: 0 },
      });
    };

    let data: any;
    try {
      const res = await fetch(`${GEMINI_API_BASE}/${jobRow.operationName}`, {
        headers: { "x-goog-api-key": key },
      });
      if (!res.ok) throw new Error(`poll ${res.status}: ${(await res.text()).slice(0, 200)}`);
      data = await res.json();
    } catch (e) {
      if (attempts >= MAX_POLLS) return await fail(`poll failed: ${String(e)}`);
      return await reschedule();
    }

    if (!data?.done) {
      if (attempts >= MAX_POLLS) return await fail("video generation timed out");
      return await reschedule();
    }

    if (data.error) {
      return await fail(`veo error: ${JSON.stringify(data.error)}`);
    }

    const uri: string | undefined =
      data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!uri) return await fail(describeEmptyVeoResponse(data));

    try {
      const dl = await fetch(uri, { headers: { "x-goog-api-key": key } });
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      const bytes = new Uint8Array(await dl.arrayBuffer());
      const storageId = await ctx.storage.store(bytesToBlob(bytes, "video/mp4"));
      const url = await ctx.storage.getUrl(storageId);
      if (!url) throw new Error("storage.getUrl returned null for video");

      await ctx.runMutation(internal.media.patchJob, {
        jobId,
        patch: { status: "completed", url, storageId, attempts },
      });

      if (jobRow.target) {
        await ctx.runMutation(internal.media.attachMedia, {
          target: jobRow.target,
          type: "video",
          url,
          storagePath: storageId,
          source: "veo",
        });
      }
    } catch (e) {
      await fail(`download/store failed: ${String(e)}`);
    }
  },
});
