import { internalQuery } from "./_generated/server";

/** TEMPORARY diagnostic: why did the recent Veo beat renders fail? */
export const recentVideoJobs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("mediaJobs").order("desc").take(30);
    return rows
      .filter((r) => r.kind === "video")
      .map((r) => ({
        status: r.status,
        error: r.error ?? null,
        attempts: r.attempts,
        promptLen: r.prompt?.length ?? 0,
        promptHead: (r.prompt ?? "").slice(0, 90),
        createdAt: r.createdAt,
      }));
  },
});
