import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUid } from "./lib/auth";
import { geminiJson } from "./lib/gemini";
import { MODELS } from "./lib/models";
import { PRESETS, getPreset } from "./lib/presets";
import { DEFAULT_SLOTS, nextOpenSlot, type Platform, type Slot } from "./lib/bestTime";
import { getProvider } from "./lib/providers/registry";
import { DEFAULT_VEO_SECONDS } from "./credits";

/**
 * STUDIO — preset-driven creation, and the bridge into publishing.
 *
 * The bridge is the point. Today VideoCreator generates a real Veo video and
 * then... offers "Download". There is no path from a finished asset into the
 * posting pipeline (`createManualPost` exists in Firebase but nothing calls it).
 * `createPost` + `postNow` close that loop.
 */

const COPY_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    mediaPrompt: { type: "string" },
  },
  required: ["hook", "caption", "hashtags"],
} as const;

/** The preset catalogue for the Studio picker. */
export const presets = query({
  args: {},
  handler: async () => PRESETS,
});

/**
 * Direct upload support: the Studio lets a user post their OWN image/video
 * (or a reference), not only AI-generated media. The client PUTs the file to
 * this short-lived URL, then calls `resolveUpload` to turn the storage id into a
 * servable URL for `createPost`.
 */
export const uploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireUid(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const resolveUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<{ url: string; storageId: string }> => {
    await requireUid(ctx);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Uploaded file not found");
    return { url, storageId };
  },
});

/**
 * Generate the copy (and a media prompt) for a preset + the user's inputs.
 * Media rendering is a separate step so the user can approve copy first.
 */
export const generateCopy = action({
  args: {
    presetId: v.string(),
    platform: v.string(),
    prompt: v.optional(v.string()),
    context: v.optional(v.string()),
    productName: v.optional(v.string()),
    brandProfileId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ hook: string; caption: string; hashtags: string[]; mediaPrompt?: string }> => {
    await requireUid(ctx);
    const preset = getPreset(args.presetId);
    const provider = getProvider(args.platform);

    const result = await geminiJson<{
      hook: string;
      caption: string;
      hashtags: string[];
      mediaPrompt?: string;
    }>({
      model: MODELS.text,
      temperature: 0.9,
      system:
        "You write social copy that sounds like a real practitioner, never like an AI or a press " +
        "release. Never invent statistics, testimonials or results.",
      prompt:
        `Write a ${preset.name} post for ${provider.displayName}.\n\n` +
        `## Structure to follow\n${preset.structure}\n\n` +
        (args.productName ? `## Product\n${args.productName}\n\n` : "") +
        (args.prompt ? `## The brief\n${args.prompt}\n\n` : "") +
        (args.context ? `## Extra context\n${args.context}\n\n` : "") +
        `## Hard limits\n` +
        `- caption MUST be under ${provider.limits.maxCaptionLength} characters.\n` +
        `- Ready to publish. No placeholders like [insert X].\n` +
        `- 3-8 relevant hashtags, no spam walls.\n` +
        (preset.mediaType !== "none"
          ? `- mediaPrompt: a concrete ${preset.mediaType} description for a generator. Directing notes: ${preset.direction}\n`
          : `- No media; omit mediaPrompt.\n`),
      schema: COPY_SCHEMA as unknown as Record<string, unknown>,
    });

    // Enforce the platform limit rather than trusting the model to obey it.
    if (result.caption.length > provider.limits.maxCaptionLength) {
      result.caption = result.caption.slice(0, provider.limits.maxCaptionLength - 1).trimEnd() + "…";
    }
    return result;
  },
});

export const insertPost = internalMutation({
  args: {
    userId: v.string(),
    caption: v.string(),
    hashtags: v.array(v.string()),
    platforms: v.array(v.string()),
    socialAccountIds: v.array(v.string()),
    media: v.optional(v.array(v.any())),
    brief: v.string(),
    brandProfileId: v.optional(v.string()),
    mode: v.union(v.literal("now"), v.literal("schedule"), v.literal("draft")),
    scheduledFor: v.optional(v.number()),
    timezone: v.string(),
  },
  handler: async (ctx, args): Promise<{ postId: Id<"posts">; scheduledFor: number; status: string }> => {
    const now = Date.now();
    const platform = (args.platforms[0] ?? "instagram") as Platform;

    // Resolve WHEN. "now" publishes immediately; "schedule" without an explicit
    // time falls back to the same best-time queue Maya uses, so Studio and Maya
    // never fight over slots.
    let scheduledFor = args.scheduledFor ?? now;
    if (args.mode === "schedule" && !args.scheduledFor) {
      const tpl = await ctx.db
        .query("slotTemplates")
        .withIndex("by_userId_platform", (q) =>
          q.eq("userId", args.userId).eq("platform", platform),
        )
        .unique();
      const slots: Slot[] = tpl?.slots ?? DEFAULT_SLOTS[platform] ?? [];
      const upcoming = await ctx.db
        .query("posts")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
      const taken = upcoming
        .filter((p) => p.scheduledFor > now && p.status !== "cancelled" && p.status !== "failed")
        .map((p) => p.scheduledFor);
      scheduledFor = nextOpenSlot({
        slots,
        timeZone: tpl?.timezone ?? args.timezone,
        from: now,
        taken,
      });
    }

    const status =
      args.mode === "draft" || args.socialAccountIds.length === 0 ? "draft" : "scheduled";

    const postId = await ctx.db.insert("posts", {
      userId: args.userId,
      brandProfileId: args.brandProfileId,
      source: "manual",
      scheduledFor,
      timezone: args.timezone,
      status: status as any,
      brief: args.brief,
      content: { caption: args.caption, hashtags: args.hashtags },
      media: args.media,
      platforms: args.platforms as any,
      socialAccountIds: args.socialAccountIds,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
    });

    return { postId, scheduledFor, status };
  },
});

/**
 * THE BRIDGE: take a finished Studio asset and post it now, schedule it, or save
 * it as a draft.
 *
 * `mode: "now"` publishes immediately via the same engine the cron uses — one
 * publish path, so "post now" and "scheduled" can never diverge in behaviour.
 */
export const createPost = action({
  args: {
    caption: v.string(),
    hashtags: v.optional(v.array(v.string())),
    platforms: v.array(v.string()),
    socialAccountIds: v.optional(v.array(v.string())),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
    mediaSource: v.optional(v.string()),
    /** For video uploads: seconds to bill as v-credits. Defaults to 8. */
    durationSeconds: v.optional(v.number()),
    brief: v.optional(v.string()),
    brandProfileId: v.optional(v.string()),
    mode: v.union(v.literal("now"), v.literal("schedule"), v.literal("draft")),
    scheduledFor: v.optional(v.number()),
    timezone: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    postId: Id<"posts">;
    status: string;
    scheduledFor: number;
    published?: number;
    of?: number;
  }> => {
    const uid = await requireUid(ctx);

    // Default to the user's active accounts for the target platforms.
    let accountIds = args.socialAccountIds ?? [];
    if (accountIds.length === 0) {
      const accounts: any[] = await ctx.runQuery(internal.studio.activeAccounts, {
        userId: uid,
        platforms: args.platforms,
      });
      accountIds = accounts.map((a) => a._id);
    }

    const media =
      args.mediaUrl && args.mediaType
        ? [{ type: args.mediaType, url: args.mediaUrl, source: (args.mediaSource ?? "upload") as any }]
        : undefined;

    // Fail fast on platform limits before creating anything — a post that can
    // never publish shouldn't reach the queue.
    for (const p of args.platforms) {
      const provider = getProvider(p);
      if (provider.deferred) {
        throw new Error(`${provider.displayName} is not enabled: ${provider.deferred.reason}`);
      }
      if (provider.limits.requiresMedia && !media) {
        throw new Error(`${provider.displayName} requires an image or video.`);
      }
    }

    // Credits: drafts are free. Posts cost 1 i-credit, or N v-credits for video
    // uploads. Veo-generated clips were already billed at generate time.
    if (args.mode !== "draft") {
      await ctx.runMutation(internal.credits.ensure, { userId: uid });
      if (args.mediaType === "video") {
        const source = args.mediaSource ?? "upload";
        if (source !== "veo") {
          const seconds = Math.max(1, Math.ceil(args.durationSeconds ?? DEFAULT_VEO_SECONDS));
          await ctx.runMutation(internal.credits.spendV, {
            userId: uid,
            amount: seconds,
            reason: "post_video",
          });
        }
      } else {
        await ctx.runMutation(internal.credits.spendI, {
          userId: uid,
          amount: 1,
          reason: "post_image_or_text",
        });
      }
    }

    const { postId, scheduledFor, status } = await ctx.runMutation(internal.studio.insertPost, {
      userId: uid,
      caption: args.caption,
      hashtags: args.hashtags ?? [],
      platforms: args.platforms,
      socialAccountIds: accountIds,
      media,
      brief: args.brief ?? args.caption.slice(0, 120),
      brandProfileId: args.brandProfileId,
      mode: args.mode,
      scheduledFor: args.scheduledFor,
      timezone: args.timezone ?? "Asia/Kolkata",
    });

    if (args.mode === "now" && status === "scheduled") {
      const r = await ctx.runAction(internal.scheduler.publishNow, { postId });
      return { postId, status: r.status, scheduledFor, published: r.published, of: r.of };
    }

    return { postId, status, scheduledFor };
  },
});

export const activeAccounts = internalQuery({
  args: { userId: v.string(), platforms: v.array(v.string()) },
  handler: async (ctx, { userId, platforms }) => {
    const accounts = await ctx.db
      .query("socialAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return accounts.filter((a) => a.status === "active" && platforms.includes(a.platform));
  },
});

/** Reschedule or cancel from the calendar. */
export const reschedule = mutation({
  args: { postId: v.id("posts"), scheduledFor: v.number() },
  handler: async (ctx, { postId, scheduledFor }) => {
    const uid = await requireUid(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== uid) throw new Error("Post not found");
    if (post.status === "posted") throw new Error("Already published");
    await ctx.db.patch(postId, {
      scheduledFor,
      status: "scheduled",
      nextAttemptAt: undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const cancel = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const uid = await requireUid(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== uid) throw new Error("Post not found");
    if (post.status === "posted") throw new Error("Already published");
    await ctx.db.patch(postId, { status: "cancelled", updatedAt: Date.now() });
    return { success: true };
  },
});
