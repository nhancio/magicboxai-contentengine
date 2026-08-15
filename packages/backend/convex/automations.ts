import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { requireUid } from "./lib/auth";
import { computeNextRunAt } from "./lib/automationSchedule";
import { geminiJson } from "./lib/gemini";
import { MODELS } from "./lib/models";
import { aspectForPlatform } from "./media";
import { DEFAULT_VEO_SECONDS, assertPublishingEntitlement } from "./credits";

const platformValidator = v.union(
  v.literal("instagram"),
  v.literal("facebook"),
  v.literal("twitter"),
  v.literal("linkedin"),
  v.literal("youtube"),
  v.literal("reddit"),
  v.literal("whatsapp"),
);

const scheduleValidator = v.object({
  type: v.union(v.literal("recurring"), v.literal("once")),
  time: v.string(),
  daysOfWeek: v.optional(v.array(v.number())),
  timezone: v.string(),
  endAt: v.optional(v.number()),
});

const contentTypesValidator = v.object({
  text: v.boolean(),
  image: v.boolean(),
  video: v.boolean(),
});

const COPY_SCHEMA = {
  type: "object",
  properties: {
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    mediaPrompt: { type: "string" },
  },
  required: ["caption", "hashtags"],
} as const;

const MAX_BRIEF = 4_000;
const MAX_NAME = 120;
const HORIZON_MS = 120 * 60_000;
const BATCH = 20;

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

function slotIso(ms: number): string {
  return new Date(ms).toISOString().replace(/[:.]/g, "-");
}

async function loadBrand(ctx: DbCtx, userId: string, brandProfileId?: string) {
  if (!brandProfileId) return null;
  const asId = ctx.db.normalizeId("brandProfiles", brandProfileId);
  if (asId) {
    const row = await ctx.db.get(asId);
    if (row && row.userId === userId) return row;
  }
  const byLegacy = await ctx.db
    .query("brandProfiles")
    .withIndex("by_legacyId", (q) => q.eq("legacyId", brandProfileId))
    .unique();
  if (byLegacy && byLegacy.userId === userId) return byLegacy;
  throw new Error("Brand profile is unavailable");
}

async function assertOwnedAccounts(
  ctx: DbCtx,
  userId: string,
  accountIds: string[],
  platforms: string[],
): Promise<string[]> {
  if (accountIds.length === 0 || accountIds.length > 20 || new Set(accountIds).size !== accountIds.length) {
    throw new Error("Select at least one connected account");
  }
  if (platforms.length === 0 || new Set(platforms).size !== platforms.length) {
    throw new Error("Select one or more unique platforms");
  }
  const accounts = await ctx.db
    .query("socialAccounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const byId = new Map(accounts.map((account) => [String(account._id), account]));
  const seenPlatforms = new Set<string>();
  for (const id of accountIds) {
    const account = byId.get(id);
    if (!account || account.status !== "active" || !platforms.includes(account.platform)) {
      throw new Error("One or more connected accounts is unavailable");
    }
    seenPlatforms.add(account.platform);
  }
  for (const platform of platforms) {
    if (!seenPlatforms.has(platform)) {
      throw new Error("Every selected platform needs a connected account");
    }
  }
  return accountIds;
}

function validateSchedule(schedule: {
  type: "recurring" | "once";
  time: string;
  daysOfWeek?: number[];
  timezone: string;
  endAt?: number;
}): number {
  if (schedule.daysOfWeek?.some((d) => d < 0 || d > 6)) {
    throw new Error("daysOfWeek must be 0–6");
  }
  const next = computeNextRunAt(schedule, Date.now());
  if (next === null) throw new Error("Schedule never fires");
  return next;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    const rows = await ctx.db
      .query("automations")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { automationId: v.string() },
  handler: async (ctx, { automationId }) => {
    const uid = await requireUid(ctx);
    const id = ctx.db.normalizeId("automations", automationId);
    if (!id) return null;
    const row = await ctx.db.get(id);
    if (!row || row.userId !== uid) return null;
    return row;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    brief: v.string(),
    brandProfileId: v.optional(v.string()),
    platforms: v.array(platformValidator),
    socialAccountIds: v.array(v.string()),
    contentTypes: contentTypesValidator,
    preset: v.string(),
    tone: v.optional(v.string()),
    schedule: scheduleValidator,
    requiresApproval: v.boolean(),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("draft"))),
  },
  returns: v.object({ id: v.id("automations"), nextRunAt: v.number() }),
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    if (!args.name.trim() || args.name.length > MAX_NAME) {
      throw new Error(`Name must be between 1 and ${MAX_NAME} characters`);
    }
    if (args.brief.trim().length < 10 || args.brief.length > MAX_BRIEF) {
      throw new Error("Brief must be between 10 and 4,000 characters");
    }
    await loadBrand(ctx, uid, args.brandProfileId);
    await assertOwnedAccounts(ctx, uid, args.socialAccountIds, args.platforms);
    const nextRunAt = validateSchedule(args.schedule);
    const status = args.status ?? "active";
    if (status === "active") {
      await assertPublishingEntitlement(ctx, uid);
    }
    const now = Date.now();
    const id = await ctx.db.insert("automations", {
      userId: uid,
      brandProfileId: args.brandProfileId,
      name: args.name.trim(),
      status,
      brief: args.brief.trim(),
      platforms: args.platforms,
      socialAccountIds: args.socialAccountIds,
      contentTypes: { text: true, image: !!args.contentTypes.image, video: !!args.contentTypes.video },
      preset: args.preset || "custom",
      tone: args.tone ?? "",
      schedule: args.schedule,
      nextRunAt,
      runCount: 0,
      failureCount: 0,
      generateLeadMinutes: args.contentTypes.video ? 120 : 30,
      requiresApproval: args.requiresApproval,
      createdAt: now,
    });
    return { id, nextRunAt };
  },
});

export const update = mutation({
  args: {
    automationId: v.string(),
    name: v.string(),
    brief: v.string(),
    brandProfileId: v.optional(v.string()),
    platforms: v.array(platformValidator),
    socialAccountIds: v.array(v.string()),
    contentTypes: contentTypesValidator,
    preset: v.string(),
    tone: v.optional(v.string()),
    schedule: scheduleValidator,
    requiresApproval: v.boolean(),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("draft"))),
  },
  returns: v.object({ id: v.id("automations"), nextRunAt: v.number() }),
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const id = ctx.db.normalizeId("automations", args.automationId);
    if (!id) throw new Error("Automation not found");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== uid) throw new Error("Automation not found");
    if (!args.name.trim() || args.name.length > MAX_NAME) {
      throw new Error(`Name must be between 1 and ${MAX_NAME} characters`);
    }
    if (args.brief.trim().length < 10 || args.brief.length > MAX_BRIEF) {
      throw new Error("Brief must be between 10 and 4,000 characters");
    }
    await loadBrand(ctx, uid, args.brandProfileId);
    await assertOwnedAccounts(ctx, uid, args.socialAccountIds, args.platforms);
    const nextRunAt = validateSchedule(args.schedule);
    const status = args.status ?? existing.status;
    if (status === "active") {
      await assertPublishingEntitlement(ctx, uid);
    }
    await ctx.db.patch(id, {
      name: args.name.trim(),
      brief: args.brief.trim(),
      brandProfileId: args.brandProfileId,
      platforms: args.platforms,
      socialAccountIds: args.socialAccountIds,
      contentTypes: { text: true, image: !!args.contentTypes.image, video: !!args.contentTypes.video },
      preset: args.preset || "custom",
      tone: args.tone ?? "",
      schedule: args.schedule,
      nextRunAt,
      generateLeadMinutes: args.contentTypes.video ? 120 : 30,
      requiresApproval: args.requiresApproval,
      ...(args.status ? { status: args.status } : {}),
      updatedAt: Date.now(),
    });
    return { id, nextRunAt };
  },
});

export const setStatus = mutation({
  args: {
    automationId: v.string(),
    status: v.union(v.literal("active"), v.literal("paused")),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, { automationId, status }) => {
    const uid = await requireUid(ctx);
    const id = ctx.db.normalizeId("automations", automationId);
    if (!id) throw new Error("Automation not found");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== uid) throw new Error("Automation not found");
    if (status === "active") {
      await assertOwnedAccounts(ctx, uid, existing.socialAccountIds, existing.platforms);
      await assertPublishingEntitlement(ctx, uid);
    }
    await ctx.db.patch(id, {
      status,
      ...(status === "active" ? { failureCount: 0, lastError: undefined } : {}),
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const remove = mutation({
  args: { automationId: v.string() },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, { automationId }) => {
    const uid = await requireUid(ctx);
    const id = ctx.db.normalizeId("automations", automationId);
    if (!id) throw new Error("Automation not found");
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== uid) throw new Error("Automation not found");
    await ctx.db.delete(id);
    return { ok: true as const };
  },
});

export const loadForRun = internalQuery({
  args: { automationId: v.id("automations") },
  handler: async (ctx, { automationId }) => ctx.db.get(automationId),
});

export const findByIdempotency = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("posts")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", key))
      .unique();
  },
});

export const insertGeneratedPost = internalMutation({
  args: {
    userId: v.string(),
    automationId: v.id("automations"),
    brandProfileId: v.optional(v.string()),
    scheduledFor: v.number(),
    timezone: v.string(),
    status: v.union(
      v.literal("pending_approval"),
      v.literal("scheduled"),
      v.literal("generating"),
    ),
    brief: v.string(),
    caption: v.string(),
    hashtags: v.array(v.string()),
    media: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("image"), v.literal("video")),
          url: v.string(),
          source: v.union(
            v.literal("imagen"),
            v.literal("veo"),
            v.literal("remotion"),
            v.literal("upload"),
          ),
        }),
      ),
    ),
    platforms: v.array(platformValidator),
    socialAccountIds: v.array(v.string()),
    idempotencyKey: v.string(),
  },
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("posts", {
      userId: args.userId,
      automationId: args.automationId,
      brandProfileId: args.brandProfileId,
      source: "automation",
      scheduledFor: args.scheduledFor,
      timezone: args.timezone,
      status: args.status,
      brief: args.brief,
      content: { caption: args.caption, hashtags: args.hashtags },
      media: args.media,
      platforms: args.platforms,
      socialAccountIds: args.socialAccountIds,
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: args.idempotencyKey,
      createdAt: Date.now(),
    });
  },
});

export const advanceAfterRun = internalMutation({
  args: {
    automationId: v.id("automations"),
    slotMs: v.number(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { automationId, slotMs, error }) => {
    const row = await ctx.db.get(automationId);
    if (!row) return null;
    const now = Date.now();
    if (error) {
      const failureCount = (row.failureCount ?? 0) + 1;
      await ctx.db.patch(automationId, {
        lastError: error.slice(0, 300),
        failureCount,
        status: failureCount >= 3 ? "error" : row.status,
        updatedAt: now,
      });
      return null;
    }
    const next =
      row.schedule.type === "once" ? null : computeNextRunAt(row.schedule, slotMs);
    await ctx.db.patch(automationId, {
      lastRunAt: slotMs,
      runCount: row.runCount + 1,
      failureCount: 0,
      lastError: undefined,
      updatedAt: now,
      ...(next ? { nextRunAt: next } : { status: "paused" as const }),
    });
    return null;
  },
});

export const dueActive = internalQuery({
  args: { horizonMs: v.number() },
  handler: async (ctx, { horizonMs }) => {
    return await ctx.db
      .query("automations")
      .withIndex("by_status_nextRunAt", (q) =>
        q.eq("status", "active").lte("nextRunAt", horizonMs),
      )
      .take(BATCH);
  },
});

async function generateAutomationCopy(args: {
  brief: string;
  preset: string;
  tone: string;
  platform: string;
  brandName?: string;
}): Promise<{ caption: string; hashtags: string[]; mediaPrompt?: string }> {
  return await geminiJson({
    model: MODELS.text,
    temperature: 0.82,
    system:
      "You write ready-to-publish social posts for a brand. Never invent statistics, " +
      "testimonials, or urgency. Caption first line is the hook.",
    prompt:
      `Write a ${args.preset || "custom"} post for ${args.platform}.\n` +
      (args.brandName ? `Brand: ${args.brandName}\n` : "") +
      (args.tone ? `Tone: ${args.tone}\n` : "") +
      `Brief:\n${args.brief}\n\n` +
      `Return caption, 3-8 hashtags, and a short mediaPrompt for an accompanying image or video.`,
    schema: COPY_SCHEMA as unknown as Record<string, unknown>,
  });
}

async function materializeRun(
  ctx: ActionCtx,
  args: {
    automationId: Id<"automations">;
    scheduledFor: number;
    immediate: boolean;
  },
): Promise<{ postId: Id<"posts">; status: string }> {
  const automation = await ctx.runQuery(internal.automations.loadForRun, {
    automationId: args.automationId,
  });
  if (!automation) throw new Error("Automation not found");

  const idempotencyKey = args.immediate
    ? `auto_${automation._id}_now_${args.scheduledFor}`
    : `${automation._id}_${slotIso(args.scheduledFor)}`;
  const existing = await ctx.runQuery(internal.automations.findByIdempotency, {
    key: idempotencyKey,
  });
  if (existing) {
    return { postId: existing._id, status: existing.status };
  }

  await ctx.runQuery(internal.studio.assertOwnedActiveAccounts, {
    userId: automation.userId,
    accountIds: automation.socialAccountIds,
    platforms: automation.platforms,
  });

  await ctx.runMutation(internal.credits.reservePublish, { userId: automation.userId });

  try {
    const brand = automation.brandProfileId
      ? await ctx.runQuery(internal.automations.loadBrandForUser, {
          userId: automation.userId,
          brandProfileId: automation.brandProfileId,
        })
      : null;
    const platform = automation.platforms[0] ?? "instagram";
    const copy = await generateAutomationCopy({
      brief: automation.brief,
      preset: automation.preset,
      tone: automation.tone ?? "",
      platform,
      brandName: brand?.name,
    });
    const caption = copy.caption.trim();
    const hashtags = (copy.hashtags ?? [])
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 12);
    if (!caption) throw new Error("Automation generated an empty caption");

    const wantsVideo = !!automation.contentTypes.video;
    const wantsImage = !!automation.contentTypes.image && !wantsVideo;
    let media:
      | Array<{ type: "image" | "video"; url: string; source: "imagen" | "veo" | "upload" }>
      | undefined;
    if (wantsImage) {
      const rendered = await ctx.runAction(internal.media.renderImageOnce, {
        prompt: (copy.mediaPrompt || caption).slice(0, 2000),
        aspectRatio: aspectForPlatform(platform) === "9:16" ? "9:16" : "1:1",
      });
      media = [{ type: "image", url: rendered.url, source: "imagen" }];
    }

    const status = wantsVideo
      ? "generating"
      : automation.requiresApproval
        ? "pending_approval"
        : "scheduled";

    const postId = await ctx.runMutation(internal.automations.insertGeneratedPost, {
      userId: automation.userId,
      automationId: automation._id,
      brandProfileId: automation.brandProfileId,
      scheduledFor: args.scheduledFor,
      timezone: automation.schedule.timezone,
      status,
      brief: automation.brief,
      caption,
      hashtags,
      media,
      platforms: automation.platforms,
      socialAccountIds: automation.socialAccountIds,
      idempotencyKey,
    });

    if (wantsVideo) {
      await ctx.scheduler.runAfter(0, internal.media.renderVideo, {
        userId: automation.userId,
        prompt: (copy.mediaPrompt || caption).slice(0, 2000),
        aspectRatio: aspectForPlatform(platform),
        target: { kind: "post", id: postId },
        durationSeconds: DEFAULT_VEO_SECONDS,
      });
    } else if (status === "scheduled" && args.immediate) {
      await ctx.scheduler.runAfter(0, internal.scheduler.publishNow, { postId });
    }

    await ctx.runMutation(internal.automations.advanceAfterRun, {
      automationId: automation._id,
      slotMs: args.scheduledFor,
    });
    return { postId, status };
  } catch (error) {
    await ctx.runMutation(internal.credits.releasePublish, { userId: automation.userId });
    const message = error instanceof Error ? error.message : String(error);
    await ctx.runMutation(internal.automations.advanceAfterRun, {
      automationId: automation._id,
      slotMs: args.scheduledFor,
      error: message,
    });
    throw error;
  }
}

export const loadBrandForUser = internalQuery({
  args: { userId: v.string(), brandProfileId: v.string() },
  handler: async (ctx, { userId, brandProfileId }) => {
    try {
      return await loadBrand(ctx, userId, brandProfileId);
    } catch {
      return null;
    }
  },
});

export const runNow = action({
  args: { automationId: v.string() },
  returns: v.object({ postId: v.id("posts"), status: v.string() }),
  handler: async (
    ctx,
    { automationId },
  ): Promise<{ postId: Id<"posts">; status: string }> => {
    const uid = await requireUid(ctx);
    const id = await ctx.runQuery(internal.automations.parseOwnedId, {
      automationId,
      userId: uid,
    });
    if (!id) throw new Error("Automation not found");
    const automation = await ctx.runQuery(internal.automations.loadForRun, { automationId: id });
    if (!automation || automation.userId !== uid) throw new Error("Automation not found");
    await ctx.runMutation(internal.credits.assertPublishEntitlement, { userId: uid });
    return await materializeRun(ctx, {
      automationId: id,
      scheduledFor: Date.now(),
      immediate: true,
    });
  },
});

export const parseOwnedId = internalQuery({
  args: { automationId: v.string(), userId: v.string() },
  handler: async (ctx, { automationId, userId }): Promise<Id<"automations"> | null> => {
    const id = ctx.db.normalizeId("automations", automationId);
    if (!id) return null;
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) return null;
    return id;
  },
});

export const tick = internalAction({
  args: {},
  returns: v.object({ ran: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.runQuery(internal.automations.dueActive, { horizonMs: now + HORIZON_MS });
    let ran = 0;
    for (const automation of due) {
      const lead = (automation.generateLeadMinutes ?? 30) * 60_000;
      if (automation.nextRunAt - now > lead) continue;
      try {
        await materializeRun(ctx, {
          automationId: automation._id,
          scheduledFor: automation.nextRunAt,
          immediate: automation.nextRunAt <= now,
        });
        ran += 1;
      } catch (error) {
        console.error(`[automations] tick failed for ${automation._id}`, error);
      }
    }
    return { ran };
  },
});
