import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUid } from "./lib/auth";
import { geminiEmbed, geminiJson } from "./lib/gemini";
import { MODELS } from "./lib/models";
import {
  DEFAULT_SLOTS,
  localBatchDate,
  nextOpenSlot,
  type Platform,
  type Slot,
} from "./lib/bestTime";
import { aspectForPlatform } from "./media";
import {
  DEFAULT_VEO_SECONDS,
  ensureTrialBalance,
  spendICredits,
} from "./credits";
import {
  CONTENT_ENGINE_VERSION,
  auditEngineCandidate,
  buildMayaContentEngineRules,
  type ClaimSafety,
  type ContentFormatId,
  type HookFamilyId,
} from "./lib/contentEngine";

/**
 * MAYA — the autonomous daily content agent.
 *
 * Loop: every morning, ground on live trends + the brand's pillars, generate a
 * small deck of candidate posts, and let the user swipe. Right = schedule it at
 * the next best-time slot. Left = discard, and remember why.
 *
 * Three deliberate design choices:
 *  1. SMALL DECK. 5/day, not 50. The deck is only useful if a human actually
 *     reviews it; bulk generators produce slop nobody reads.
 *  2. DEDUP IS VECTOR-BASED, not string-based. Suggestions repeat *semantically*
 *     ("5 tips for X" vs "X: five things to know"), which text matching misses.
 *  3. DISCARDS ARE RETAINED. A left swipe is the only honest negative signal we
 *     get, so it lowers its pillar's weight instead of vanishing.
 */

const DEDUP_THRESHOLD = 0.85; // cosine; above this two suggestions are "the same idea"
const CANDIDATE_BUFFER = 3; // over-generate so dedup rejections don't shrink the deck

const DEFAULT_PILLARS = [
  { name: "Educational", description: "Teach one useful thing the audience can act on today." },
  { name: "Product", description: "Show the product solving a real, specific problem." },
  { name: "Social Proof", description: "Results, testimonials, case studies, before/after." },
  { name: "Behind the Scenes", description: "How the work actually gets done; the human side." },
  { name: "Trend Reaction", description: "Take on something happening in the niche right now." },
];

type DbContext = Pick<QueryCtx | MutationCtx, "db">;

async function activationForUser(ctx: DbContext, userId: string) {
  const brands = await ctx.db
    .query("brandProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const brand = brands
    .filter((candidate) => candidate.websiteUrl?.trim())
    .sort(
      (a, b) =>
        (b.updatedAt ?? b.createdAt ?? b._creationTime) -
        (a.updatedAt ?? a.createdAt ?? a._creationTime),
    )[0];
  const accounts = await ctx.db
    .query("socialAccounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const activeAccounts = accounts.filter((account) => account.status === "active");

  return {
    hasWebsite: !!brand,
    hasChannel: activeAccounts.length > 0,
    ready: !!brand && activeAccounts.length > 0,
    brand,
    activeAccounts,
  };
}

const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pillarName: { type: "string" },
          platform: {
            type: "string",
            enum: ["instagram", "facebook", "twitter", "linkedin", "youtube", "reddit"],
          },
          hook: { type: "string" },
          angle: { type: "string" },
          caption: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          mediaType: { type: "string", enum: ["none", "image", "video"] },
          mediaPrompt: { type: "string" },
          trendUsed: { type: "string" },
          formatId: {
            type: "string",
            enum: [
              "proof_demo",
              "problem_solution",
              "before_after",
              "three_beats",
              "story_turn",
              "comparison_test",
              "comment_response",
              "process_bts",
            ],
          },
          hookFamily: {
            type: "string",
            enum: [
              "pain_mirror",
              "outcome_first",
              "proof_first",
              "visual_demonstration",
              "contrarian_correction",
              "mistake_diagnosis",
              "open_loop",
              "identity_relevance",
              "sequence_preview",
              "story_in_motion",
              "comparison_test",
              "objection_test",
            ],
          },
          openingVisual: { type: "string" },
          contentBeats: { type: "array", items: { type: "string" } },
          retentionDevices: { type: "array", items: { type: "string" } },
          hookPayoff: { type: "string" },
          whyShare: { type: "string" },
          claimSafety: {
            type: "string",
            enum: [
              "verified_source",
              "brand_provided",
              "demonstration",
              "opinion",
              "no_external_claim",
              "unverified_claim",
            ],
          },
          ctaType: { type: "string" },
        },
        required: [
          "pillarName",
          "platform",
          "hook",
          "angle",
          "caption",
          "hashtags",
          "mediaType",
          "formatId",
          "hookFamily",
          "openingVisual",
          "contentBeats",
          "retentionDevices",
          "hookPayoff",
          "whyShare",
          "claimSafety",
          "ctaType",
        ],
      },
    },
  },
  required: ["suggestions"],
} as const;

type Candidate = {
  pillarName: string;
  platform: Platform;
  hook: string;
  angle: string;
  caption: string;
  hashtags: string[];
  mediaType: "none" | "image" | "video";
  mediaPrompt?: string;
  trendUsed?: string;
  formatId: ContentFormatId;
  hookFamily: HookFamilyId;
  openingVisual: string;
  contentBeats: string[];
  retentionDevices: string[];
  hookPayoff: string;
  whyShare: string;
  claimSafety: ClaimSafety;
  ctaType: string;
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Idempotent per-user bootstrap: config + default pillars + seeded slot
 * templates.
 *
 * Plain helper rather than a mutation so both the authed `ensureConfig` and the
 * internal `bootstrapUser` (ops/seeding) share one implementation — Convex
 * mutations can't call each other.
 */
async function bootstrapUserInner(
  ctx: MutationCtx,
  uid: string,
  timezone: string,
  platforms: Platform[],
) {
  {
    const now = Date.now();

    let config = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();

    if (!config) {
      const brand = await ctx.db
        .query("brandProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", uid))
        .first();

      const id = await ctx.db.insert("mayaConfig", {
        userId: uid,
        enabled: true,
        dailyCount: 5,
        timezone,
        reviewHourLocal: 9,
        platforms,
        brandProfileId: brand?._id,
        autoScheduleOnApprove: true,
        createdAt: now,
      });
      config = await ctx.db.get(id);
    }

    const existingPillars = await ctx.db
      .query("contentPillars")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();

    if (existingPillars.length === 0) {
      for (const p of DEFAULT_PILLARS) {
        await ctx.db.insert("contentPillars", {
          userId: uid,
          name: p.name,
          description: p.description,
          weight: 1,
          active: true,
          createdAt: now,
        });
      }
    }

    for (const platform of platforms) {
      const existing = await ctx.db
        .query("slotTemplates")
        .withIndex("by_userId_platform", (q) => q.eq("userId", uid).eq("platform", platform))
        .unique();
      if (!existing) {
        await ctx.db.insert("slotTemplates", {
          userId: uid,
          platform,
          timezone,
          slots: DEFAULT_SLOTS[platform] ?? [],
          source: "seeded",
          updatedAt: now,
        });
      }
    }

    return config;
  }
}

/** Called by the UI on load. Safe to call repeatedly. */
export const ensureConfig = mutation({
  args: {
    timezone: v.optional(v.string()),
    platforms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const activation = await activationForUser(ctx, uid);
    if (!activation.hasWebsite) {
      throw new Error("Add a website before activating Maya");
    }
    if (!activation.hasChannel) {
      throw new Error("Connect at least one social channel before activating Maya");
    }
    return await bootstrapUserInner(
      ctx,
      uid,
      args.timezone ?? "Asia/Kolkata",
      (args.platforms as Platform[] | undefined) ?? ["instagram", "linkedin"],
    );
  },
});

/** Ops/seeding entry point (no auth context — takes an explicit uid). */
export const bootstrapUser = internalMutation({
  args: {
    userId: v.string(),
    timezone: v.optional(v.string()),
    platforms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await bootstrapUserInner(
      ctx,
      args.userId,
      args.timezone ?? "Asia/Kolkata",
      (args.platforms as Platform[] | undefined) ?? ["instagram", "linkedin"],
    );
  },
});

export const config = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    return await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
  },
});

/** Website + channel prerequisites that control every Maya entry point. */
export const activation = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    const state = await activationForUser(ctx, uid);
    return {
      hasWebsite: state.hasWebsite,
      hasChannel: state.hasChannel,
      ready: state.ready,
      websiteUrl: state.brand?.websiteUrl,
      brandName: state.brand?.name,
      activePlatforms: state.activeAccounts.map((account) => account.platform),
      channelCount: state.activeAccounts.length,
    };
  },
});

// ---------------------------------------------------------------------------
// Deck + swipe (what the UI talks to)
// ---------------------------------------------------------------------------

/** Today's undecided deck, in slot order. */
export const deck = query({
  args: { batchDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const activation = await activationForUser(ctx, uid);
    const cfg = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();

    const batchDate = args.batchDate ?? localBatchDate(Date.now(), cfg?.timezone ?? "Asia/Kolkata");

    const rows = await ctx.db
      .query("suggestions")
      .withIndex("by_userId_batchDate", (q) => q.eq("userId", uid).eq("batchDate", batchDate))
      .collect();

    return {
      batchDate,
      locked: !activation.ready,
      // Strip the 768-float embedding — it's dedup-only server state and just
      // bloats every card's payload to the browser.
      pending: (activation.ready ? rows : [])
        .filter((r) => r.status === "pending")
        .sort((a, b) => a.slot - b.slot)
        .map(({ embedding, ...r }) => r),
      decided: activation.ready ? rows.filter((r) => r.status !== "pending").length : 0,
      total: activation.ready ? rows.length : 0,
    };
  },
});

/** Recently scheduled/published suggestions — the "what Maya did" trail. */
export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const uid = await requireUid(ctx);
    const rows = await ctx.db
      .query("suggestions")
      .withIndex("by_userId_status", (q) => q.eq("userId", uid).eq("status", "scheduled"))
      .order("desc")
      .take(limit ?? 20);
    return rows;
  },
});

/**
 * The swipe / decide.
 *
 * RIGHT (or publishMode "schedule") -> next best-time slot.
 * publishMode "now" -> post immediately (scheduler fires publishNow).
 * LEFT -> discard + learn.
 */
export const swipe = mutation({
  args: {
    suggestionId: v.id("suggestions"),
    decision: v.union(v.literal("right"), v.literal("left")),
    /** When approving (right): post immediately or queue at next best time. */
    publishMode: v.optional(v.union(v.literal("now"), v.literal("schedule"))),
    reason: v.optional(v.string()),
    dwellMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const activation = await activationForUser(ctx, uid);
    if (!activation.hasWebsite) throw new Error("Add a website before using Maya");
    if (!activation.hasChannel) throw new Error("Connect a social channel before using Maya");
    const now = Date.now();
    const publishMode = args.publishMode ?? "schedule";

    const s = await ctx.db.get(args.suggestionId);
    // Not-found (rather than permission-denied) so we don't leak existence.
    if (!s || s.userId !== uid) throw new Error("Suggestion not found");
    if (s.status !== "pending") {
      // Idempotent: a double-tap / re-sent swipe is a no-op, not an error.
      return {
        status: s.status,
        postId: s.postId ?? null,
        scheduledAt: s.scheduledAt ?? null,
        publishMode,
      };
    }

    // Convex values cannot contain undefined properties. Build the optional
    // feedback fields only when the caller actually supplied them; otherwise
    // both left (Skip) and right (Post) swipes fail at the final db.patch.
    const feedback: {
      decision: "right" | "left";
      reason?: string;
      dwellMs?: number;
      decidedAt: number;
      publishMode?: "now" | "schedule";
    } = { decision: args.decision, decidedAt: now };
    if (args.reason !== undefined) feedback.reason = args.reason;
    if (args.dwellMs !== undefined) feedback.dwellMs = args.dwellMs;
    if (args.decision === "right") feedback.publishMode = publishMode;

    // --- LEFT: discard + learn -------------------------------------------
    if (args.decision === "left") {
      await ctx.db.patch(args.suggestionId, {
        status: "discarded",
        feedback,
        updatedAt: now,
      });
      if (s.pillarId) {
        const pillar = await ctx.db.get(s.pillarId as Id<"contentPillars">);
        if (pillar && pillar.userId === uid) {
          // Decay, floored — a rejected pillar should surface less, never vanish
          // entirely (tastes change, and a zero weight is unrecoverable).
          await ctx.db.patch(pillar._id, {
            weight: Math.max(0.2, pillar.weight * 0.85),
            updatedAt: now,
          });
        }
      }
      return { status: "discarded" as const, postId: null, scheduledAt: null, publishMode };
    }

    // --- RIGHT: approve + post now OR next best time ---------------------
    const cfg = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    const timezone = cfg?.timezone ?? "Asia/Kolkata";
    const platform = (s.platforms[0] ?? "instagram") as Platform;

    const tpl = await ctx.db
      .query("slotTemplates")
      .withIndex("by_userId_platform", (q) => q.eq("userId", uid).eq("platform", platform))
      .unique();
    const slots: Slot[] = tpl?.slots ?? DEFAULT_SLOTS[platform] ?? [];

    // Don't double-book: collect times already claimed by this user's queue.
    const upcoming = await ctx.db
      .query("posts")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
    const taken = upcoming
      .filter((p) => p.scheduledFor > now && p.status !== "cancelled" && p.status !== "failed")
      .map((p) => p.scheduledFor);

    const scheduledFor =
      publishMode === "now"
        ? now
        : nextOpenSlot({
            slots,
            timeZone: tpl?.timezone ?? timezone,
            from: now,
            taken,
          });

    // Resolve destination accounts: prefer explicit config, else the user's
    // active accounts for this platform.
    let socialAccountIds = cfg?.socialAccountIds ?? [];
    if (socialAccountIds.length === 0) {
      const accounts = await ctx.db
        .query("socialAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", uid))
        .collect();
      socialAccountIds = accounts
        .filter((a) => a.status === "active" && a.platform === platform)
        .map((a) => a._id);
    }

    const hasChannel = socialAccountIds.length > 0;
    const wantsVideo = s.mediaPlan?.type === "video";
    // A video approval must actually render before it can publish. Hold it as
    // "generating" (the scheduler ignores that status) and let the Veo job flip
    // it to "scheduled" once the media is attached. No channel yet -> draft.
    const status = !hasChannel ? "draft" : wantsVideo ? "generating" : "scheduled";

    // Credits (drafts free). Image/text = 1 i. Video render bills v at Veo start.
    if (hasChannel) {
      await ensureTrialBalance(ctx, uid);
      if (!wantsVideo) {
        await spendICredits(ctx, uid, 1, "maya_post", String(s._id));
      }
      // video: charged inside media.renderVideo
    }

    const postId = await ctx.db.insert("posts", {
      userId: uid,
      suggestionId: s._id,
      brandProfileId: s.brandProfileId,
      source: "manual",
      scheduledFor,
      timezone: tpl?.timezone ?? timezone,
      status,
      brief: s.angle ?? s.hook ?? "Maya suggestion",
      content: { caption: s.caption, hashtags: s.hashtags },
      // Video posts carry the rendered Veo clip (attached async); image/text
      // posts reuse the suggestion's already-rendered poster.
      media: wantsVideo ? undefined : s.media,
      platforms: s.platforms,
      socialAccountIds,
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: `maya_${s._id}`,
      createdAt: now,
    });

    // Kick off the Veo render only when it can actually be published — no point
    // spending a paid render on a draft with nowhere to post.
    if (wantsVideo && hasChannel) {
      await ctx.scheduler.runAfter(0, internal.media.renderVideo, {
        userId: uid,
        prompt: s.mediaPlan?.prompt ?? s.hook ?? s.caption.slice(0, 200),
        aspectRatio: aspectForPlatform(platform),
        target: { kind: "post", id: postId },
        durationSeconds: DEFAULT_VEO_SECONDS,
      });
    } else if (publishMode === "now" && hasChannel && !wantsVideo) {
      // Fire the same publish engine Studio uses — don't wait for the 1-min cron.
      await ctx.scheduler.runAfter(0, internal.scheduler.publishNow, { postId });
    }

    await ctx.db.patch(args.suggestionId, {
      status: "scheduled",
      feedback,
      postId,
      scheduledAt: scheduledFor,
      updatedAt: now,
    });

    if (s.pillarId) {
      const pillar = await ctx.db.get(s.pillarId as Id<"contentPillars">);
      if (pillar && pillar.userId === uid) {
        await ctx.db.patch(pillar._id, {
          weight: Math.min(3, pillar.weight * 1.1),
          lastUsedAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      status,
      postId,
      scheduledAt: scheduledFor,
      needsChannel: !hasChannel,
      renderingVideo: wantsVideo && hasChannel,
      publishMode,
    };
  },
});

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export const loadGenerationContext = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const activation = await activationForUser(ctx, userId);
    const cfg = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const pillars = await ctx.db
      .query("contentPillars")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const brand = cfg?.brandProfileId
      ? await ctx.db.get(cfg.brandProfileId as Id<"brandProfiles">)
      : await ctx.db
          .query("brandProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .first();
    return { cfg, pillars: pillars.filter((p) => p.active), brand, activation };
  },
});

/**
 * Ops/debug view of a user's deck. Strips the 768-dim embedding, which is
 * useless to a human and makes any dump unreadable.
 */
export const adminDeck = internalQuery({
  args: { userId: v.string(), batchDate: v.optional(v.string()) },
  handler: async (ctx, { userId, batchDate }) => {
    const cfg = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const day = batchDate ?? localBatchDate(Date.now(), cfg?.timezone ?? "Asia/Kolkata");
    const rows = await ctx.db
      .query("suggestions")
      .withIndex("by_userId_batchDate", (q) => q.eq("userId", userId).eq("batchDate", day))
      .collect();
    return rows
      .sort((a, b) => a.slot - b.slot)
      .map(({ embedding, ...r }) => ({ ...r, hasEmbedding: !!embedding }));
  },
});

export const countBatch = internalQuery({
  args: { userId: v.string(), batchDate: v.string() },
  handler: async (ctx, { userId, batchDate }) => {
    const rows = await ctx.db
      .query("suggestions")
      .withIndex("by_userId_batchDate", (q) => q.eq("userId", userId).eq("batchDate", batchDate))
      .collect();
    return rows.length;
  },
});

export const insertSuggestion = internalMutation({
  args: {
    userId: v.string(),
    brandProfileId: v.optional(v.string()),
    pillarId: v.optional(v.string()),
    batchDate: v.string(),
    slot: v.number(),
    platforms: v.array(v.string()),
    hook: v.optional(v.string()),
    angle: v.optional(v.string()),
    caption: v.string(),
    hashtags: v.array(v.string()),
    mediaPlan: v.optional(v.any()),
    creativePlan: v.optional(v.any()),
    trendRefs: v.optional(v.array(v.id("trends"))),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const idempotencyKey = `${args.userId}_${args.batchDate}_${args.slot}`;

    // Exactly-once per (user, day, slot) even if the cron double-fires.
    const existing = await ctx.db
      .query("suggestions")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("suggestions", {
      userId: args.userId,
      brandProfileId: args.brandProfileId,
      pillarId: args.pillarId,
      batchDate: args.batchDate,
      idempotencyKey,
      slot: args.slot,
      platforms: args.platforms as any,
      status: "pending",
      hook: args.hook,
      angle: args.angle,
      caption: args.caption,
      hashtags: args.hashtags,
      mediaPlan: args.mediaPlan,
      creativePlan: args.creativePlan,
      trendRefs: args.trendRefs,
      embedding: args.embedding,
      createdAt: now,
    });
  },
});

export const markConfigRun = internalMutation({
  args: { userId: v.string(), batchDate: v.string(), error: v.optional(v.string()) },
  handler: async (ctx, { userId, batchDate, error }) => {
    const cfg = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!cfg) return;
    await ctx.db.patch(cfg._id, {
      lastBatchDate: batchDate,
      lastRunAt: Date.now(),
      lastError: error,
      updatedAt: Date.now(),
    });
  },
});

/** Weighted, least-recently-used pillar rotation so a deck is a balanced mix. */
function pickPillars<T extends { _id: string; name: string; weight: number; lastUsedAt?: number }>(
  pillars: T[],
  count: number,
): T[] {
  if (pillars.length === 0) return [];
  const sorted = [...pillars].sort((a, b) => {
    const scoreA = a.weight / (1 + (a.lastUsedAt ?? 0) / 1e13);
    const scoreB = b.weight / (1 + (b.lastUsedAt ?? 0) / 1e13);
    return scoreB - scoreA;
  });
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(sorted[i % sorted.length]);
  return out;
}

/**
 * Generate one user's deck for one day. Idempotent on (userId, batchDate).
 */
export const generateForUser = internalAction({
  args: { userId: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, { userId, force }): Promise<{ created: number; reason?: string }> => {
    const { cfg, pillars, brand, activation } = await ctx.runQuery(internal.maya.loadGenerationContext, {
      userId,
    });
    if (!activation.hasWebsite) return { created: 0, reason: "website_required" };
    if (!activation.hasChannel) return { created: 0, reason: "social_channel_required" };
    if (!cfg) return { created: 0, reason: "no_config" };
    if (!cfg.enabled && !force) return { created: 0, reason: "disabled" };

    const batchDate = localBatchDate(Date.now(), cfg.timezone);

    if (!force) {
      const existing = await ctx.runQuery(internal.maya.countBatch, { userId, batchDate });
      if (existing > 0) return { created: 0, reason: "already_generated" };
    }

    const platforms = (cfg.platforms as Platform[]) ?? ["instagram"];
    const want = cfg.dailyCount ?? 5;

    const trendBrief: Record<string, any[]> = await ctx.runQuery(internal.trends.brief, {
      platforms,
      limitPerPlatform: 6,
    });

    const chosen = pickPillars(pillars as any[], want);

    const brandBlock = brand
      ? [
          `Brand: ${brand.name}`,
          brand.industry ? `Industry: ${brand.industry}` : "",
          brand.audience ? `Audience: ${brand.audience}` : "",
          brand.toneOfVoice ? `Tone: ${brand.toneOfVoice}` : "",
          brand.websiteUrl ? `Website: ${brand.websiteUrl}` : "",
          brand.bannedTopics?.length ? `NEVER mention: ${brand.bannedTopics.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "Brand: (not configured — keep copy generic and professional)";

    const trendBlock = Object.entries(trendBrief)
      .map(([p, rows]) =>
        rows.length
          ? `${p}:\n${rows.map((r) => `  - [${r.kind}] ${r.value} (${r.score.toFixed(2)})`).join("\n")}`
          : "",
      )
      .filter(Boolean)
      .join("\n");

    const contentEngineRules = buildMayaContentEngineRules(platforms);
    const result = await geminiJson<{ suggestions: Candidate[] }>({
      model: MODELS.text,
      temperature: 0.82,
      system:
        "You are Maya, MagicBox's evidence-led social content strategist. Write like a specific " +
        "human practitioner, never like an AI or a press release. Optimize for audience relevance, " +
        "hook/payoff continuity, useful or emotional sharing value, and truthful proof. Virality is " +
        "probabilistic: never guarantee it and never invent statistics, testimonials, urgency, or results.",
      prompt:
        `Create exactly ${want + CANDIDATE_BUFFER} distinct post suggestions for today (${batchDate}).\n\n` +
        `## Brand\n${brandBlock}\n\n` +
        `## Content pillars to cover (one per suggestion, in order; extras may reuse)\n` +
        chosen.map((p, i) => `${i + 1}. ${p.name} — ${p.description ?? ""}`).join("\n") +
        `\n\n## Live trends (real, from web search today)\n${trendBlock || "(none available)"}\n\n` +
        `## Target platforms\n${platforms.join(", ")}\n\n` +
        `${contentEngineRules}\n\n` +
        `## Rules\n` +
        `- Each suggestion targets ONE platform from the list, and the copy must be native to it ` +
        `(LinkedIn = professional insight; Instagram = punchy + visual; X = short and sharp).\n` +
        `- Ground each in a specific trend above where it genuinely fits. Set trendUsed to the trend value. ` +
        `Do NOT force an irrelevant trend — if none fits the pillar, write an evergreen post and leave trendUsed empty.\n` +
        `- hook: the scroll-stopping first line (<12 words).\n` +
        `- caption: the full post copy, ready to publish. No placeholders like [insert X].\n` +
        `- hashtags: 3-8, relevant, no generic spam walls.\n` +
        `- mediaType: "video" for short-form-first platforms, "image" where a visual helps, "none" for text-first.\n` +
        `- mediaPrompt: if mediaType isn't "none", a concrete visual description for an image/video generator.\n` +
        `- All ${want + CANDIDATE_BUFFER} must be genuinely DIFFERENT ideas — not rewordings of each other.\n` +
        `- Before returning, silently test at least two hook mechanisms for each idea and return only the ` +
        `stronger truthful version. Never mention this internal comparison in the output.`,
      schema: SUGGESTION_SCHEMA as unknown as Record<string, unknown>,
    });

    const candidates = (result.suggestions ?? [])
      .filter((c) => c.caption?.trim() && platforms.includes(c.platform))
      .map((candidate) => ({ candidate, audit: auditEngineCandidate(candidate) }))
      .filter(({ audit }) => !audit.blocked)
      .sort((a, b) => b.audit.score - a.audit.score);

    let created = 0;
    for (const { candidate: c, audit } of candidates) {
      if (created >= want) break;

      // Semantic dedup against this user's recent decks. Vector search catches
      // "same idea, different words", which string matching never would.
      let embedding: number[] | undefined;
      try {
        embedding = await geminiEmbed(`${c.hook}\n${c.caption}`);
        const similar = await ctx.vectorSearch("suggestions", "by_embedding", {
          vector: embedding,
          limit: 3,
          filter: (q) => q.eq("userId", userId),
        });
        if (similar.length > 0 && similar[0]._score >= DEDUP_THRESHOLD) {
          console.log(
            `[maya] skip near-duplicate (score ${similar[0]._score.toFixed(3)}): ${c.hook?.slice(0, 60)}`,
          );
          continue;
        }
      } catch (e) {
        // Embedding is an optimization, not a gate — a deck without dedup beats
        // no deck at all.
        console.warn("[maya] embedding/dedup failed; inserting without it", e);
      }

      const pillar = chosen.find((p) => p.name === c.pillarName) ?? chosen[created];
      const trendRefs = (trendBrief[c.platform] ?? [])
        .filter((t) => c.trendUsed && t.value === c.trendUsed)
        .map((t) => t._id as Id<"trends">);

      const suggestionId = await ctx.runMutation(internal.maya.insertSuggestion, {
        userId,
        brandProfileId: brand?._id,
        pillarId: pillar?._id,
        batchDate,
        slot: created,
        platforms: [c.platform],
        hook: c.hook,
        angle: c.angle,
        caption: c.caption,
        hashtags: c.hashtags ?? [],
        mediaPlan:
          c.mediaType && c.mediaType !== "none"
            ? { type: c.mediaType, prompt: c.mediaPrompt }
            : { type: "none" },
        creativePlan: {
          engineVersion: CONTENT_ENGINE_VERSION,
          formatId: c.formatId,
          hookFamily: c.hookFamily,
          openingVisual: c.openingVisual,
          contentBeats: c.contentBeats,
          retentionDevices: c.retentionDevices,
          hookPayoff: c.hookPayoff,
          whyShare: c.whyShare,
          claimSafety: c.claimSafety,
          ctaType: c.ctaType,
          qualityScore: audit.score,
          auditIssues: audit.issues,
        },
        trendRefs: trendRefs.length ? trendRefs : undefined,
        embedding,
      });
      created++;

      // Render a poster image for the swipe card (cheap + fast). Even a
      // video-type suggestion gets an image preview here; the full Veo video is
      // rendered only if the user actually approves it (see `swipe`). The deck
      // query is reactive, so the card fills in the image the moment it lands.
      if (c.mediaType && c.mediaType !== "none" && c.mediaPrompt) {
        await ctx.scheduler.runAfter(0, internal.media.renderImageForSuggestion, {
          suggestionId,
          prompt: c.mediaPrompt,
          aspectRatio: aspectForPlatform(c.platform),
        });
      }
    }

    await ctx.runMutation(internal.maya.markConfigRun, { userId, batchDate });
    console.log(`[maya] ${userId} ${batchDate}: created ${created}/${want}`);
    return { created };
  },
});

/** Manual trigger — "Generate today's deck" in the UI. */
export const generateNow = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }): Promise<{ created: number; reason?: string }> => {
    const uid = await requireUid(ctx);
    return await ctx.runAction(internal.maya.generateForUser, { userId: uid, force: force ?? true });
  },
});

export const listEnabledUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("mayaConfig")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    return rows.map((r) => ({ userId: r.userId, timezone: r.timezone, reviewHourLocal: r.reviewHourLocal }));
  },
});

/**
 * Daily fan-out. Runs hourly and generates only for users whose local time has
 * just reached their review hour — that's how one UTC cron serves every timezone.
 */
export const generateDaily = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ran: number }> => {
    const users = await ctx.runQuery(internal.maya.listEnabledUsers, {});
    const now = Date.now();
    let ran = 0;

    for (const u of users) {
      let localHour: number;
      try {
        localHour = Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: u.timezone,
            hour: "2-digit",
            hour12: false,
          }).format(new Date(now)),
        ) % 24;
      } catch {
        continue; // bad timezone string — skip rather than crash the whole run
      }

      // Generate a couple of hours before review so media has time to render.
      const target = Math.max(0, (u.reviewHourLocal ?? 9) - 2);
      if (localHour !== target) continue;

      try {
        const r = await ctx.runAction(internal.maya.generateForUser, { userId: u.userId });
        if (r.created > 0) ran++;
      } catch (e) {
        console.error(`[maya] generation failed for ${u.userId}`, e);
        await ctx.runMutation(internal.maya.markConfigRun, {
          userId: u.userId,
          batchDate: localBatchDate(now, u.timezone),
          error: String(e).slice(0, 300),
        });
      }
    }
    return { ran };
  },
});
