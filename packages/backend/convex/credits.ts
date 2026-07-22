import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { requireUid } from "./lib/auth";

/**
 * MagicBox credits
 *
 *   1 i-credit  = 1 text / image / text+image post, or 1 AI image generation
 *   1 v-credit  = 1 second of video (Veo generate or uploaded video post)
 *
 * Free trial (once per user): 50 i + 100 v.
 *
 * Gemini API cost reference (paid tier, ~2026):
 *   Nano Banana 2 (gemini-3.1-flash-image) ≈ $0.045–$0.067 / image (0.5K–1K)
 *   Veo 3.1 Fast 720p ≈ $0.10 / sec · Standard ≈ $0.40 / sec · Lite ≈ $0.05 / sec
 * Free-trial COGS ballpark at Fast rates: 50×$0.067 + 100×$0.10 ≈ $13.35
 */

export const FREE_TRIAL_I = 50;
export const FREE_TRIAL_V = 100;
/** Veo clips are typically 8s when duration isn't specified. */
export const DEFAULT_VEO_SECONDS = 8;

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly kind: "i" | "v",
    public readonly need: number,
    public readonly have: number,
  ) {
    super(
      kind === "i"
        ? `Not enough i-credits (need ${need}, have ${have}). Upgrade or wait for a top-up.`
        : `Not enough v-credits (need ${need}s of video, have ${have}). Upgrade or wait for a top-up.`,
    );
    this.name = "InsufficientCreditsError";
  }
}

async function getRow(ctx: MutationCtx, userId: string) {
  return await ctx.db
    .query("creditBalances")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/** Create balance + grant free trial if this user has never been seeded. */
export async function ensureTrialBalance(
  ctx: MutationCtx,
  userId: string,
): Promise<{ iCredits: number; vCredits: number; trialGranted: boolean }> {
  const existing = await getRow(ctx, userId);
  const now = Date.now();
  if (existing) {
    return {
      iCredits: existing.iCredits,
      vCredits: existing.vCredits,
      trialGranted: false,
    };
  }

  const id = await ctx.db.insert("creditBalances", {
    userId,
    iCredits: FREE_TRIAL_I,
    vCredits: FREE_TRIAL_V,
    trialGrantedAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("creditLedger", {
    userId,
    kind: "i",
    delta: FREE_TRIAL_I,
    reason: "free_trial",
    balanceAfter: FREE_TRIAL_I,
    createdAt: now,
  });
  await ctx.db.insert("creditLedger", {
    userId,
    kind: "v",
    delta: FREE_TRIAL_V,
    reason: "free_trial",
    balanceAfter: FREE_TRIAL_V,
    createdAt: now,
  });
  void id;
  return { iCredits: FREE_TRIAL_I, vCredits: FREE_TRIAL_V, trialGranted: true };
}

async function spend(
  ctx: MutationCtx,
  args: {
    userId: string;
    kind: "i" | "v";
    amount: number;
    reason: string;
    refId?: string;
  },
): Promise<{ iCredits: number; vCredits: number }> {
  if (args.amount <= 0) {
    const bal = await ensureTrialBalance(ctx, args.userId);
    return { iCredits: bal.iCredits, vCredits: bal.vCredits };
  }

  await ensureTrialBalance(ctx, args.userId);
  const row = await getRow(ctx, args.userId);
  if (!row) throw new Error("credit balance missing after ensure");

  const have = args.kind === "i" ? row.iCredits : row.vCredits;
  if (have < args.amount) {
    throw new InsufficientCreditsError(args.kind, args.amount, have);
  }

  const nextI = args.kind === "i" ? row.iCredits - args.amount : row.iCredits;
  const nextV = args.kind === "v" ? row.vCredits - args.amount : row.vCredits;
  const now = Date.now();
  await ctx.db.patch(row._id, { iCredits: nextI, vCredits: nextV, updatedAt: now });
  await ctx.db.insert("creditLedger", {
    userId: args.userId,
    kind: args.kind,
    delta: -args.amount,
    reason: args.reason,
    refId: args.refId,
    balanceAfter: args.kind === "i" ? nextI : nextV,
    createdAt: now,
  });
  return { iCredits: nextI, vCredits: nextV };
}

async function credit(
  ctx: MutationCtx,
  args: {
    userId: string;
    kind: "i" | "v";
    amount: number;
    reason: string;
    refId?: string;
  },
): Promise<{ iCredits: number; vCredits: number }> {
  if (args.amount <= 0) {
    const bal = await ensureTrialBalance(ctx, args.userId);
    return { iCredits: bal.iCredits, vCredits: bal.vCredits };
  }
  await ensureTrialBalance(ctx, args.userId);
  const row = await getRow(ctx, args.userId);
  if (!row) throw new Error("credit balance missing after ensure");
  const nextI = args.kind === "i" ? row.iCredits + args.amount : row.iCredits;
  const nextV = args.kind === "v" ? row.vCredits + args.amount : row.vCredits;
  const now = Date.now();
  await ctx.db.patch(row._id, { iCredits: nextI, vCredits: nextV, updatedAt: now });
  await ctx.db.insert("creditLedger", {
    userId: args.userId,
    kind: args.kind,
    delta: args.amount,
    reason: args.reason,
    refId: args.refId,
    balanceAfter: args.kind === "i" ? nextI : nextV,
    createdAt: now,
  });
  return { iCredits: nextI, vCredits: nextV };
}

export async function spendICredits(
  ctx: MutationCtx,
  userId: string,
  amount: number,
  reason: string,
  refId?: string,
) {
  return spend(ctx, { userId, kind: "i", amount, reason, refId });
}

export async function spendVCredits(
  ctx: MutationCtx,
  userId: string,
  amount: number,
  reason: string,
  refId?: string,
) {
  return spend(ctx, { userId, kind: "v", amount, reason, refId });
}

export async function refundVCredits(
  ctx: MutationCtx,
  userId: string,
  amount: number,
  reason: string,
  refId?: string,
) {
  return credit(ctx, { userId, kind: "v", amount, reason, refId });
}

export async function refundICredits(
  ctx: MutationCtx,
  userId: string,
  amount: number,
  reason: string,
  refId?: string,
) {
  return credit(ctx, { userId, kind: "i", amount, reason, refId });
}

// ---- public ------------------------------------------------------------

/** Client: current balance (auto-grants free trial once). */
export const balance = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    const row = await ctx.db
      .query("creditBalances")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    if (!row) {
      // Queries can't write — client should call `claimTrial` once.
      return {
        iCredits: 0,
        vCredits: 0,
        trialGranted: false,
        needsTrialClaim: true,
        freeTrial: { i: FREE_TRIAL_I, v: FREE_TRIAL_V },
      };
    }
    return {
      iCredits: row.iCredits,
      vCredits: row.vCredits,
      trialGranted: !!row.trialGrantedAt,
      needsTrialClaim: false,
      freeTrial: { i: FREE_TRIAL_I, v: FREE_TRIAL_V },
    };
  },
});

/** Idempotent free-trial grant (safe to call from Dashboard on load). */
export const claimTrial = mutation({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    return await ensureTrialBalance(ctx, uid);
  },
});

// ---- internal (called from Studio / Maya / media) ----------------------

export const ensure = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => ensureTrialBalance(ctx, userId),
});

export const get = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query("creditBalances")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return row
      ? { iCredits: row.iCredits, vCredits: row.vCredits }
      : { iCredits: 0, vCredits: 0 };
  },
});

export const spendI = internalMutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => spend(ctx, { ...args, kind: "i" }),
});

export const spendV = internalMutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => spend(ctx, { ...args, kind: "v" }),
});

export const refundI = internalMutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => credit(ctx, { ...args, kind: "i" }),
});

export const refundV = internalMutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, args) => credit(ctx, { ...args, kind: "v" }),
});
