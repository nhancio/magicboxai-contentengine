import { query } from "./_generated/server";
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
