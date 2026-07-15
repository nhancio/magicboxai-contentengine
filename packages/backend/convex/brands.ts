import { query } from "./_generated/server";
import { requireUid } from "./lib/auth";

/** List the calling user's brand profiles (read-only prototype). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    return await ctx.db
      .query("brandProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
  },
});
