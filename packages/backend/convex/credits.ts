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
 * Free trial (once per user): 50 i + 100 v, usable for FREE_TRIAL_DAYS only.
 * After the window ends, remaining trial credits freeze until the user upgrades.
 *
 * Gemini API cost reference (paid tier, ~2026):
 *   Nano Banana 2 (gemini-3.1-flash-image) ≈ $0.045–$0.067 / image (0.5K–1K)
 *   Veo 3.1 Fast 720p ≈ $0.10 / sec · Standard ≈ $0.40 / sec · Lite ≈ $0.05 / sec
 * Free-trial COGS ballpark at Fast rates: 50×$0.067 + 100×$0.10 ≈ $13.35
 */

export const FREE_TRIAL_I = 50;
export const FREE_TRIAL_V = 100;
/** How long free-trial credits stay spendable. */
export const FREE_TRIAL_DAYS = 7;
export const FREE_TRIAL_MS = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
/** Veo clips are typically 8s when duration isn't specified. */
export const DEFAULT_VEO_SECONDS = 8;

/** Same catalogue Firebase `entitlements.ts` / landing copy enforce. */
export const PAID_POST_LIMITS = {
  pro: 60,
  max: 300,
} as const;

export type PaidPlan = keyof typeof PAID_POST_LIMITS;

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

export class TrialExpiredError extends Error {
  constructor() {
    super(
      `Your ${FREE_TRIAL_DAYS}-day free trial has ended. Upgrade a plan to keep creating.`,
    );
    this.name = "TrialExpiredError";
  }
}

export class PublishingRequiredError extends Error {
  constructor() {
    super("Publishing requires a paid plan. Upgrade to Pro or Max to schedule or publish posts.");
    this.name = "PublishingRequiredError";
  }
}

export class MonthlyPostQuotaError extends Error {
  constructor(plan: PaidPlan, limit: number) {
    super(
      `Monthly post limit reached (${limit}/month on ${plan === "pro" ? "Pro" : "Max"}). Upgrade or wait until next month.`,
    );
    this.name = "MonthlyPostQuotaError";
  }
}

function trialExpiresAt(grantedAt: number): number {
  return grantedAt + FREE_TRIAL_MS;
}

type BillingIdentity = {
  magicboxPlan?: unknown;
  magicboxSubscriptionStatus?: unknown;
};

/** Firebase signs these claims from the Firestore/Dodo entitlement record. */
function identityBilling(identity: unknown): BillingIdentity | null {
  if (!identity || typeof identity !== "object") return null;
  return identity as BillingIdentity;
}

function identityHasPaidPlan(identity: unknown): boolean {
  const claims = identityBilling(identity);
  return (
    (claims?.magicboxPlan === "pro" || claims?.magicboxPlan === "max") &&
    claims?.magicboxSubscriptionStatus === "active"
  );
}

function identityPaidPlan(identity: unknown): PaidPlan | null {
  const claims = identityBilling(identity);
  if (claims?.magicboxSubscriptionStatus !== "active") return null;
  if (claims.magicboxPlan === "pro" || claims.magicboxPlan === "max") return claims.magicboxPlan;
  return null;
}

function utcMonthKey(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function hasActivePaidPlan(
  ctx: MutationCtx | { db: MutationCtx["db"]; auth?: MutationCtx["auth"] },
  userId: string,
): Promise<boolean> {
  return (await resolvePaidPlan(ctx, userId)) !== null;
}

/**
 * Paid publishing entitlement: Firebase JWT claims (signed from Dodo/Firestore)
 * and/or a Convex subscriptions row mirrored from those claims.
 */
async function resolvePaidPlan(
  ctx: MutationCtx | { db: MutationCtx["db"]; auth?: MutationCtx["auth"] },
  userId: string,
  nowMs = Date.now(),
): Promise<{ plan: PaidPlan; limit: number } | null> {
  let plan: PaidPlan | null = null;
  if (ctx.auth) {
    plan = identityPaidPlan(await ctx.auth.getUserIdentity());
  }
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (sub && (sub.plan === "pro" || sub.plan === "max") && (sub.status === "active" || sub.status === undefined)) {
    if (sub.currentPeriodEnd === undefined || sub.currentPeriodEnd > nowMs) {
      plan = sub.plan;
    }
  }
  if (!plan) return null;
  return { plan, limit: PAID_POST_LIMITS[plan] };
}

async function upsertSubscriptionFromIdentity(
  ctx: MutationCtx,
  userId: string,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  const claims = identityBilling(identity);
  const plan =
    claims?.magicboxPlan === "pro" || claims?.magicboxPlan === "max" || claims?.magicboxPlan === "free"
      ? claims.magicboxPlan
      : undefined;
  const status =
    claims?.magicboxSubscriptionStatus === "active" ||
    claims?.magicboxSubscriptionStatus === "past_due" ||
    claims?.magicboxSubscriptionStatus === "cancelled" ||
    claims?.magicboxSubscriptionStatus === "inactive"
      ? claims.magicboxSubscriptionStatus
      : undefined;
  if (!plan && !status) return;

  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const now = Date.now();
  const nextPlan = plan ?? existing?.plan ?? "free";
  const nextStatus = status ?? existing?.status ?? "inactive";
  if (existing) {
    await ctx.db.patch(existing._id, {
      plan: nextPlan,
      status: nextStatus,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("subscriptions", {
    legacyId: userId,
    userId,
    plan: nextPlan,
    status: nextStatus,
    updatedAt: now,
  });
}

/** True when the user may spend credits right now. */
async function assertCanSpend(ctx: MutationCtx, userId: string): Promise<void> {
  if (await hasActivePaidPlan(ctx, userId)) return;
  const row = await getRow(ctx, userId);
  if (!row?.trialGrantedAt) return;
  if (Date.now() >= trialExpiresAt(row.trialGrantedAt)) {
    throw new TrialExpiredError();
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
    // Backfill trial clock for rows created before trialGrantedAt existed.
    if (!existing.trialGrantedAt) {
      await ctx.db.patch(existing._id, {
        trialGrantedAt: existing.updatedAt || now,
        updatedAt: now,
      });
    }
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
  await assertCanSpend(ctx, args.userId);
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

export async function assertPublishingEntitlement(
  ctx: MutationCtx,
  userId: string,
): Promise<{ plan: PaidPlan; limit: number }> {
  await upsertSubscriptionFromIdentity(ctx, userId);
  const paid = await resolvePaidPlan(ctx, userId);
  if (!paid) throw new PublishingRequiredError();
  return paid;
}

/**
 * Atomically reserve one calendar-month post. Drafts must not call this.
 * Mirrors Firebase `createPostWithQuotaReservation`.
 */
export async function reserveMonthlyPostQuota(
  ctx: MutationCtx,
  userId: string,
): Promise<{ plan: PaidPlan; used: number; limit: number; remaining: number }> {
  await ensureTrialBalance(ctx, userId);
  const paid = await assertPublishingEntitlement(ctx, userId);
  const row = await getRow(ctx, userId);
  if (!row) throw new Error("credit balance missing after ensure");
  const month = utcMonthKey(Date.now());
  const used = row.usageMonth === month ? row.postsThisMonth ?? 0 : 0;
  if (used >= paid.limit) {
    throw new MonthlyPostQuotaError(paid.plan, paid.limit);
  }
  const next = used + 1;
  await ctx.db.patch(row._id, {
    usageMonth: month,
    postsThisMonth: next,
    updatedAt: Date.now(),
  });
  return { plan: paid.plan, used: next, limit: paid.limit, remaining: paid.limit - next };
}

export async function releaseMonthlyPostQuota(ctx: MutationCtx, userId: string): Promise<void> {
  const row = await getRow(ctx, userId);
  if (!row) return;
  const month = utcMonthKey(Date.now());
  if (row.usageMonth !== month) return;
  const used = row.postsThisMonth ?? 0;
  if (used <= 0) return;
  await ctx.db.patch(row._id, {
    postsThisMonth: used - 1,
    updatedAt: Date.now(),
  });
}

function publishLimitFrom(identity: unknown, plan: unknown): number {
  const fromClaims = identityPaidPlan(identity);
  if (fromClaims) return PAID_POST_LIMITS[fromClaims];
  if (plan === "pro" || plan === "max") return PAID_POST_LIMITS[plan];
  return 0;
}

// ---- public ------------------------------------------------------------

const TRIAL_REFRESH_ALLOWED_EMAILS = new Set([
  "compilelater@gmail.com",
  "nithindidigam@nhancio.com",
]);

async function isTrialRefreshAllowed(
  ctx: { auth: { getUserIdentity: () => Promise<any> }; db: any },
  userId: string,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  const identityEmail = typeof identity?.email === "string" ? identity.email.toLowerCase() : null;
  if (identityEmail && TRIAL_REFRESH_ALLOWED_EMAILS.has(identityEmail)) {
    return true;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_legacyId", (q: any) => q.eq("legacyId", userId))
    .unique();
  const dbEmail = user?.email?.toLowerCase();
  return !!(dbEmail && TRIAL_REFRESH_ALLOWED_EMAILS.has(dbEmail));
}

/** Client: current balance (auto-grants free trial once). */
export const balance = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const identityPaid = identityHasPaidPlan(identity);
    const row = await ctx.db
      .query("creditBalances")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    const paid =
      !!sub &&
      (sub.plan === "pro" || sub.plan === "max") &&
      (sub.status === "active" || sub.status === undefined);
    const hasPaidPlan = paid || identityPaid;
    const publishLimit = publishLimitFrom(identity, sub?.plan);
    const canRefreshTrial = await isTrialRefreshAllowed(ctx, uid);

    if (!row) {
      // Queries can't write — client should call `claimTrial` once.
      // Do not use Date.now() here — client computes remaining days from expiresAt.
      return {
        iCredits: 0,
        vCredits: 0,
        trialGranted: false,
        trialGrantedAt: null as number | null,
        trialExpiresAt: null as number | null,
        trialDurationDays: FREE_TRIAL_DAYS,
        needsTrialClaim: true,
        hasPaidPlan,
        canRefreshTrial,
        usageMonth: null as string | null,
        postsThisMonth: 0,
        publishLimit,
        freeTrial: { i: FREE_TRIAL_I, v: FREE_TRIAL_V, days: FREE_TRIAL_DAYS },
      };
    }

    const grantedAt = row.trialGrantedAt ?? row.updatedAt ?? null;
    return {
      iCredits: row.iCredits,
      vCredits: row.vCredits,
      trialGranted: true,
      trialGrantedAt: grantedAt,
      trialExpiresAt: grantedAt ? trialExpiresAt(grantedAt) : null,
      trialDurationDays: FREE_TRIAL_DAYS,
      needsTrialClaim: false,
      hasPaidPlan,
      canRefreshTrial,
      usageMonth: row.usageMonth ?? null,
      postsThisMonth: row.postsThisMonth ?? 0,
      publishLimit,
      freeTrial: { i: FREE_TRIAL_I, v: FREE_TRIAL_V, days: FREE_TRIAL_DAYS },
    };
  },
});

/** Idempotent free-trial grant (safe to call from Dashboard on load). */
export const claimTrial = mutation({
  args: {},
  returns: v.object({
    iCredits: v.number(),
    vCredits: v.number(),
    trialGranted: v.boolean(),
  }),
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    return await ensureTrialBalance(ctx, uid);
  },
});

/** Reset free-trial clock & replenish credits for the calling user. Only admin/authorized emails allowed. */
export const resetTrial = mutation({
  args: {},
  returns: v.object({
    iCredits: v.number(),
    vCredits: v.number(),
    trialGranted: v.boolean(),
  }),
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    const allowed = await isTrialRefreshAllowed(ctx, uid);
    if (!allowed) {
      throw new Error("Unauthorized: Trial reset is restricted to administrators.");
    }
    const existing = await getRow(ctx, uid);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        trialGrantedAt: now,
        iCredits: FREE_TRIAL_I,
        vCredits: FREE_TRIAL_V,
        updatedAt: now,
      });
      await ctx.db.insert("creditLedger", {
        userId: uid,
        kind: "i",
        delta: FREE_TRIAL_I,
        reason: "trial_reset",
        balanceAfter: FREE_TRIAL_I,
        createdAt: now,
      });
      await ctx.db.insert("creditLedger", {
        userId: uid,
        kind: "v",
        delta: FREE_TRIAL_V,
        reason: "trial_reset",
        balanceAfter: FREE_TRIAL_V,
        createdAt: now,
      });
      return { iCredits: FREE_TRIAL_I, vCredits: FREE_TRIAL_V, trialGranted: true };
    }
    return await ensureTrialBalance(ctx, uid);
  },
});

/**
 * Mirror Firebase billing claims into Convex `subscriptions` so the publish
 * cron (which has no user JWT) can re-check entitlement.
 */
export const syncPlan = mutation({
  args: {},
  returns: v.object({
    hasPaidPlan: v.boolean(),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
  }),
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    await upsertSubscriptionFromIdentity(ctx, uid);
    const paid = await resolvePaidPlan(ctx, uid);
    return {
      hasPaidPlan: paid !== null,
      plan: paid === null ? ("free" as const) : paid.plan,
    };
  },
});

/**
 * Client-charged video credits for flows that render video OUTSIDE Convex
 * (e.g. the Firebase avatar/Veo callable). The authenticated client calls this
 * before kicking off generation, and `refundVideo` if generation then fails.
 * Charging here — authed by the caller's own Firebase token — keeps a single
 * v-credit ledger without a cross-backend service secret. Throws
 * InsufficientCreditsError / TrialExpiredError, surfaced to the client.
 */
export const spendVideo = mutation({
  args: { seconds: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, { seconds, reason }) => {
    const uid = await requireUid(ctx);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120) {
      throw new Error("Video seconds must be between 1 and 120");
    }
    const amount = Math.max(1, Math.ceil(seconds));
    return await spend(ctx, { userId: uid, kind: "v", amount, reason: reason ?? "avatar_video" });
  },
});

/** Refund a client-charged video reservation when generation fails. */
export const refundVideo = mutation({
  args: { seconds: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, { seconds, reason }) => {
    const uid = await requireUid(ctx);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120) {
      throw new Error("Video seconds must be between 1 and 120");
    }
    const amount = Math.max(1, Math.ceil(seconds));
    return await credit(ctx, {
      userId: uid,
      kind: "v",
      amount,
      reason: reason ?? "avatar_video_refund",
    });
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

export const reservePublish = internalMutation({
  args: { userId: v.string() },
  returns: v.object({
    plan: v.union(v.literal("pro"), v.literal("max")),
    used: v.number(),
    limit: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, { userId }) => reserveMonthlyPostQuota(ctx, userId),
});

export const releasePublish = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await releaseMonthlyPostQuota(ctx, userId);
    return null;
  },
});

export const assertPublishEntitlement = internalMutation({
  args: { userId: v.string() },
  returns: v.object({
    plan: v.union(v.literal("pro"), v.literal("max")),
    limit: v.number(),
  }),
  handler: async (ctx, { userId }) => assertPublishingEntitlement(ctx, userId),
});
