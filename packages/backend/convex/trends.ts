import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { geminiGrounded, geminiJson } from "./lib/gemini";
import { MODELS } from "./lib/models";

/**
 * Maya's trend ingestion layer.
 *
 * FREE-FIRST BY DESIGN. Two sources, and the expensive ones are deliberately absent:
 *   1. Gemini + Google Search grounding — works today, covers every platform, and
 *      returns real citation URLs so a suggestion can show *why* it's on-trend.
 *   2. YouTube Data API v3 (`chart=mostPopular`, 1 quota unit/call against a free
 *      10k/day quota) — OPTIONAL enrichment. Skipped silently unless
 *      YOUTUBE_API_KEY is set AND the API is enabled on the project.
 *
 * Explicitly NOT used: the X/Twitter trends endpoint (~$0.010/request, no free
 * tier since Feb 2026) and TikTok Creative Center (no official API). TikTok/X
 * signal comes from grounding instead. Paid sources (Apify TikTok, SerpApi) can
 * attach later as additional `source` values without touching consumers.
 */

const REGIONS = ["US", "IN"];
const TREND_TTL_MS = 36 * 60 * 60 * 1000; // survive one missed daily run

type NormalizedTrend = {
  platform: "instagram" | "facebook" | "twitter" | "linkedin" | "youtube" | "reddit";
  kind: "topic" | "hashtag" | "sound" | "format";
  value: string;
  title?: string;
  description?: string;
  score: number;
  evidenceUrl?: string;
};

const TREND_SCHEMA = {
  type: "object",
  properties: {
    trends: {
      type: "array",
      items: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["instagram", "facebook", "twitter", "linkedin", "youtube", "reddit"],
          },
          kind: { type: "string", enum: ["topic", "hashtag", "sound", "format"] },
          value: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          score: { type: "number" },
        },
        required: ["platform", "kind", "value", "score"],
      },
    },
  },
  required: ["trends"],
} as const;

export function utcBatchDate(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Optional YouTube enrichment. Returns [] on any failure — never blocks a run. */
async function fetchYouTubeTrending(region: string): Promise<NormalizedTrend[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular` +
      `&regionCode=${encodeURIComponent(region)}&maxResults=20&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[trends] youtube ${region} -> ${res.status}; skipping enrichment`);
      return [];
    }
    const data = await res.json();
    const items: any[] = data?.items ?? [];

    return items.map((it, i) => ({
      platform: "youtube" as const,
      kind: "topic" as const,
      value: it?.snippet?.title ?? "",
      title: it?.snippet?.title,
      description: (it?.snippet?.description ?? "").slice(0, 300),
      // Rank -> normalized 0..1 so YouTube scores are comparable to grounded ones.
      score: items.length > 1 ? 1 - i / (items.length - 1) : 1,
      evidenceUrl: it?.id ? `https://www.youtube.com/watch?v=${it.id}` : undefined,
    })).filter((t) => !!t.value);
  } catch (e) {
    console.warn("[trends] youtube enrichment failed; continuing", e);
    return [];
  }
}

/** Grounded trend discovery — the source that works with zero extra setup. */
async function fetchGroundedTrends(region: string): Promise<NormalizedTrend[]> {
  const today = utcBatchDate();

  // Step 1: let the model search the live web.
  const { text, sources } = await geminiGrounded({
    prompt:
      `Today is ${today}. Search the web for what is ACTUALLY trending RIGHT NOW on social media in ${region}.\n` +
      `Cover: Instagram Reels, TikTok-style short video, X/Twitter, LinkedIn, YouTube.\n` +
      `For each, list concrete trending topics, hashtags, audio/sounds, and content FORMATS ` +
      `(e.g. "POV skit", "day-in-the-life", "green-screen react").\n` +
      `Only report things you found evidence for. Prefer the last 7 days.`,
    system:
      "You are a social media trend researcher. Report only what your search results support. Never invent a trend.",
  });

  // Step 2: structure it. Grounding and responseSchema can't be combined in one
  // call, so we ground first, then normalize the findings in a second pass.
  const structured = await geminiJson<{ trends: NormalizedTrend[] }>({
    prompt:
      `Convert this trend research into structured rows.\n\n${text}\n\n` +
      `Rules:\n` +
      `- score = 0..1 confidence x momentum (be honest; weak signal = low score).\n` +
      `- hashtags: value MUST start with '#'.\n` +
      `- Map TikTok-style findings to platform "instagram" (Reels is our closest destination).\n` +
      `- Skip anything with no real supporting evidence.`,
    schema: TREND_SCHEMA as unknown as Record<string, unknown>,
    model: MODELS.text,
    temperature: 0.2,
  });

  const evidence = sources[0]?.url;
  return (structured.trends ?? []).map((t) => ({
    ...t,
    score: Math.max(0, Math.min(1, t.score)),
    evidenceUrl: t.evidenceUrl ?? evidence,
  }));
}

export const insertBatch = internalMutation({
  args: {
    batchDate: v.string(),
    region: v.string(),
    source: v.union(
      v.literal("youtube_api"),
      v.literal("gemini_grounding"),
      v.literal("apify_tiktok"),
      v.literal("serpapi"),
      v.literal("manual"),
    ),
    rows: v.array(v.any()),
  },
  handler: async (ctx, { batchDate, region, source, rows }): Promise<number> => {
    const now = Date.now();
    for (const r of rows as NormalizedTrend[]) {
      await ctx.db.insert("trends", {
        platform: r.platform,
        kind: r.kind,
        value: r.value,
        title: r.title,
        description: r.description,
        score: r.score,
        region,
        source,
        evidenceUrl: r.evidenceUrl,
        batchDate,
        fetchedAt: now,
        expiresAt: now + TREND_TTL_MS,
      });
    }
    return rows.length;
  },
});

/** Drop expired rows so the table stays a rolling window, not an archive. */
export const pruneExpired = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const now = Date.now();
    const stale = await ctx.db
      .query("trends")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(500);
    for (const row of stale) await ctx.db.delete(row._id);
    return stale.length;
  },
});

/**
 * Top trends for a set of platforms, best-scoring first. Consumed by Maya's
 * generator to ground a day's deck.
 */
export const brief = internalQuery({
  args: {
    platforms: v.array(v.string()),
    limitPerPlatform: v.optional(v.number()),
  },
  handler: async (ctx, { platforms, limitPerPlatform }) => {
    const batchDate = utcBatchDate();
    const out: Record<string, any[]> = {};

    for (const platform of platforms) {
      let rows = await ctx.db
        .query("trends")
        .withIndex("by_platform_batchDate", (q) =>
          q.eq("platform", platform as any).eq("batchDate", batchDate),
        )
        .collect();

      // Tolerate a missed/late cron: fall back to the most recent unexpired rows
      // rather than generating a deck with no trend grounding at all.
      if (rows.length === 0) {
        const recent = await ctx.db
          .query("trends")
          .withIndex("by_expiresAt", (q) => q.gt("expiresAt", Date.now()))
          .collect();
        rows = recent.filter((r) => r.platform === (platform as any));
      }

      out[platform] = rows
        .sort((a, b) => b.score - a.score)
        .slice(0, limitPerPlatform ?? 8)
        .map((r) => ({
          _id: r._id,
          kind: r.kind,
          value: r.value,
          title: r.title,
          score: r.score,
          evidenceUrl: r.evidenceUrl,
        }));
    }
    return out;
  },
});

/**
 * Daily trend refresh. Wired to a cron in `crons.ts`.
 * Idempotent-ish by design: a same-day re-run adds fresher rows and the pruner
 * clears expired ones; `brief` always reads best-score-first for the day.
 */
export const refresh = internalAction({
  args: {},
  // Explicit return type: this action calls `internal.trends.*` from inside the
  // same file, so inference would be circular (TS7022/TS7023).
  handler: async (ctx): Promise<{ batchDate: string; inserted: number; pruned: number }> => {
    const batchDate = utcBatchDate();
    let total = 0;

    for (const region of REGIONS) {
      try {
        const grounded = await fetchGroundedTrends(region);
        if (grounded.length) {
          total += await ctx.runMutation(internal.trends.insertBatch, {
            batchDate,
            region,
            source: "gemini_grounding",
            rows: grounded,
          });
        }
      } catch (e) {
        // One region failing must not abort the others.
        console.error(`[trends] grounded fetch failed for ${region}`, e);
      }

      const yt = await fetchYouTubeTrending(region);
      if (yt.length) {
        total += await ctx.runMutation(internal.trends.insertBatch, {
          batchDate,
          region,
          source: "youtube_api",
          rows: yt,
        });
      }
    }

    const pruned = await ctx.runMutation(internal.trends.pruneExpired, {});
    console.log(`[trends] batch ${batchDate}: +${total} rows, -${pruned} expired`);
    return { batchDate, inserted: total, pruned };
  },
});
