import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireUid } from "./lib/auth";
import { geminiJson } from "./lib/gemini";
import { MODELS } from "./lib/models";
import type { Doc } from "./_generated/dataModel";

/** List the calling user's posts, newest scheduled first (read-only prototype). */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const uid = await requireUid(ctx);
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .order("desc")
      .take(limit ?? 50);
    return posts;
  },
});

/**
 * Calendar range query — used by Schedule.tsx so Maya / Studio posts (Convex)
 * show up alongside any legacy Firebase rows the UI still merges client-side.
 */
export const listInRange = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, { startMs, endMs }) => {
    const uid = await requireUid(ctx);
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
    return posts
      .filter(
        (p) =>
          p.scheduledFor >= startMs &&
          p.scheduledFor <= endMs &&
          p.status !== "cancelled",
      )
      .sort((a, b) => a.scheduledFor - b.scheduledFor);
  },
});

/** Cancel a Maya/Studio post that lives in Convex. */
export const cancel = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const uid = await requireUid(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== uid) throw new Error("Post not found");
    if (post.status === "posted" || post.status === "posting") {
      throw new Error("Can't cancel a post that's already publishing or live");
    }
    await ctx.db.patch(postId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/**
 * Approve a Convex `pending_approval` post into the publish queue.
 * Due posts publish immediately via the same engine the cron uses.
 */
export const approve = mutation({
  args: { postId: v.id("posts") },
  returns: v.object({ ok: v.literal(true), status: v.string() }),
  handler: async (ctx, { postId }) => {
    const uid = await requireUid(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== uid) throw new Error("Post not found");
    if (post.status !== "pending_approval") {
      throw new Error("Post is not awaiting approval");
    }
    if (!post.content?.caption) {
      throw new Error("Approve after the post has copy — try Rewrite first");
    }
    const now = Date.now();
    await ctx.db.patch(postId, {
      status: "scheduled",
      error: undefined,
      updatedAt: now,
    });
    if (post.scheduledFor <= now && post.socialAccountIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.scheduler.publishNow, { postId });
    }
    return { ok: true as const, status: "scheduled" };
  },
});

/** Re-queue a failed Convex post. Due posts publish immediately. */
export const retry = mutation({
  args: { postId: v.id("posts") },
  returns: v.object({ ok: v.literal(true), status: v.string() }),
  handler: async (ctx, { postId }) => {
    const uid = await requireUid(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== uid) throw new Error("Post not found");
    if (post.status !== "failed") {
      throw new Error("Only failed posts can be retried");
    }
    const now = Date.now();
    const due = post.scheduledFor <= now;
    await ctx.db.patch(postId, {
      status: "scheduled",
      attempts: 0,
      error: undefined,
      nextAttemptAt: undefined,
      claimedAt: undefined,
      claimToken: undefined,
      updatedAt: now,
    });
    if (due && post.socialAccountIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.scheduler.publishNow, { postId });
    }
    return { ok: true as const, status: "scheduled" };
  },
});

const REWRITE_SCHEMA = {
  type: "object",
  properties: {
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: ["caption", "hashtags"],
} as const;

/** Rewrite caption/hashtags for a Convex post that is not already live. */
export const rewrite = action({
  args: { postId: v.id("posts") },
  returns: v.object({
    ok: v.literal(true),
    caption: v.string(),
    hashtags: v.array(v.string()),
  }),
  handler: async (
    ctx,
    { postId },
  ): Promise<{ ok: true; caption: string; hashtags: string[] }> => {
    const uid = await requireUid(ctx);
    const post = await ctx.runQuery(internal.posts.getOwned, { postId, userId: uid });
    if (!post) throw new Error("Post not found");
    const rewritable = [
      "draft",
      "pending_approval",
      "scheduled",
      "failed",
      "ready",
      "generating",
    ];
    if (!rewritable.includes(post.status)) {
      throw new Error("Post content cannot be rewritten right now");
    }

    const result = await geminiJson<{ caption: string; hashtags: string[] }>({
      model: MODELS.text,
      temperature: 0.85,
      system:
        "You rewrite social posts. Keep every factual claim. Never invent stats, " +
        "testimonials, or urgency. Return a ready-to-publish caption and 3-8 hashtags.",
      prompt:
        `Rewrite this ${post.platforms[0] ?? "social"} post. Same idea, fresher wording.\n\n` +
        `## Brief\n${post.brief || "(none)"}\n\n` +
        `## Current caption\n${post.content?.caption || post.brief}\n\n` +
        `## Current hashtags\n${(post.content?.hashtags ?? []).join(" ") || "(none)"}`,
      schema: REWRITE_SCHEMA as unknown as Record<string, unknown>,
    });

    const caption = result.caption.trim();
    const hashtags = (result.hashtags ?? [])
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter((tag) => tag.length > 0 && tag.length <= 100)
      .slice(0, 12);
    if (!caption) throw new Error("Rewrite produced an empty caption");

    await ctx.runMutation(internal.posts.patchContent, {
      postId,
      userId: uid,
      caption,
      hashtags,
    });
    return { ok: true as const, caption, hashtags };
  },
});

export const getOwned = internalQuery({
  args: { postId: v.id("posts"), userId: v.string() },
  handler: async (ctx, { postId, userId }): Promise<Doc<"posts"> | null> => {
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== userId) return null;
    return post;
  },
});

export const patchContent = internalMutation({
  args: {
    postId: v.id("posts"),
    userId: v.string(),
    caption: v.string(),
    hashtags: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { postId, userId, caption, hashtags }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== userId) throw new Error("Post not found");
    await ctx.db.patch(postId, {
      content: {
        caption,
        hashtags,
        ...(post.content?.perPlatform ? { perPlatform: post.content.perPlatform } : {}),
      },
      updatedAt: Date.now(),
    });
    return null;
  },
});
