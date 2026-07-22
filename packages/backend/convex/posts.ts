import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUid } from "./lib/auth";

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
