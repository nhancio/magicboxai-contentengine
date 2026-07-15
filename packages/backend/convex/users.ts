import { query } from "./_generated/server";
import { requireUid } from "./lib/auth";

/**
 * Read-only prototype (Month 2/3): return the calling user's own profile.
 * Authorization fails closed — a caller only ever sees their own uid's record.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", uid))
      .unique();
    if (!user) return null;
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    return { user, subscription };
  },
});
