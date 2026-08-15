import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUid } from "./lib/auth";
import { geminiJson } from "./lib/gemini";
import { MODELS } from "./lib/models";
import { getPreset, rankPresetsForTrends } from "./lib/presets";
import { DEFAULT_SLOTS, nextOpenSlot, type Platform, type Slot } from "./lib/bestTime";
import { getProvider } from "./lib/providers/registry";
import { DEFAULT_VEO_SECONDS } from "./credits";
import { buildStaticCreativeRules } from "./lib/contentEngine";

/**
 * STUDIO — preset-driven creation, and the bridge into publishing.
 *
 * The bridge is the point. Today VideoCreator generates a real Veo video and
 * then... offers "Download". There is no path from a finished asset into the
 * posting pipeline (`createManualPost` exists in Firebase but nothing calls it).
 * `createPost` + `postNow` close that loop.
 */

const COPY_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string" },
    caption: { type: "string" },
    hashtags: {
      type: "array",
      items: { type: "string" },
      description: "3-8 relevant hashtags, each MUST start with #",
    },
    mediaPrompt: { type: "string" },
    hookFamily: { type: "string" },
    trendUsed: { type: "string" },
    whyShare: { type: "string" },
    altText: { type: "string" },
  },
  required: ["hook", "caption", "hashtags"],
} as const;

const MAX_CAPTION_LENGTH = 10_000;
const MAX_URL_LENGTH = 4_096;
const MAX_VIDEO_SECONDS = 30;

/**
 * Media is later fetched by publishing providers. Restrict it to Convex's own
 * storage URLs so a user cannot coerce those server-side provider flows into
 * fetching arbitrary internal URLs (SSRF).
 */
function trustedMediaUrl(raw: string): string {
  if (raw.length === 0 || raw.length > MAX_URL_LENGTH) {
    throw new Error("Media URL is invalid");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Media URL is invalid");
  }
  // Convex storage: match the deployment's own origin so this works on both the
  // cloud product (*.convex.cloud) and a self-hosted backend (which may be
  // http://host:port). CONVEX_CLOUD_URL / CONVEX_SITE_URL are injected by the
  // backend at runtime and point at this deployment.
  const deploymentOrigins = [process.env.CONVEX_CLOUD_URL, process.env.CONVEX_SITE_URL]
    .filter((o): o is string => Boolean(o))
    .map((o) => {
      try {
        return new URL(o).origin;
      } catch {
        return undefined;
      }
    })
    .filter((o): o is string => Boolean(o));
  const convexStorage =
    (url.hostname.endsWith(".convex.cloud") || deploymentOrigins.includes(url.origin)) &&
    url.pathname.startsWith("/api/storage/");
  const firebaseBrandCreative =
    url.hostname === "firebasestorage.googleapis.com" &&
    /^\/v0\/b\/magicboxai-50927\.(?:firebasestorage\.app|appspot\.com)\/o\/users%2F[^/]+%2Fbrand-creatives%2F/i.test(
      url.pathname,
    ) &&
    url.searchParams.get("alt") === "media" &&
    Boolean(url.searchParams.get("token"));
  if (url.username || url.password) {
    throw new Error("Media must be uploaded to MagicBox storage");
  }
  // Convex storage is pinned to this deployment's exact origin above, so a
  // self-hosted http origin with a port is acceptable. Any other (Firebase)
  // source must still be plain https with no port.
  if (convexStorage) {
    return url.toString();
  }
  if (firebaseBrandCreative && url.protocol === "https:" && !url.port) {
    return url.toString();
  }
  throw new Error("Media must be uploaded to MagicBox storage");
}

function assertTextLength(value: string | undefined, label: string, maxLength: number): void {
  if (value !== undefined && value.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }
}

/** The preset catalogue for the Studio picker. */
export const presets = query({
  args: {
    platform: v.optional(v.string()),
    mediaType: v.optional(
      v.union(v.literal("video"), v.literal("image"), v.literal("none")),
    ),
  },
  handler: async (ctx, args) => {
    await requireUid(ctx);
    const platforms = args.platform ? [args.platform] : [];
    let trendRows: Array<{
      platform?: string;
      kind: string;
      value: string;
      title?: string;
      score: number;
    }> = [];

    if (args.platform && args.platform !== "whatsapp") {
      const batchDate = new Date().toISOString().slice(0, 10);
      trendRows = await ctx.db
        .query("trends")
        .withIndex("by_platform_batchDate", (q) =>
          q.eq("platform", args.platform as any).eq("batchDate", batchDate),
        )
        .collect();

      if (trendRows.length === 0) {
        const recent = await ctx.db
          .query("trends")
          .withIndex("by_expiresAt", (q) => q.gt("expiresAt", Date.now()))
          .collect();
        trendRows = recent.filter((row) => row.platform === (args.platform as any));
      }
    }

    return rankPresetsForTrends({
      trends: trendRows.map((row) => ({
        platform: row.platform ?? args.platform,
        kind: row.kind,
        value: row.value,
        title: row.title,
        score: row.score,
      })),
      platforms,
      mediaType: args.mediaType,
    });
  },
});

/**
 * Direct upload support: the Studio lets a user post their OWN image/video
 * (or a reference), not only AI-generated media. The client PUTs the file to
 * this short-lived URL, then calls `resolveUpload` to turn the storage id into a
 * servable URL for `createPost`.
 */
export const uploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireUid(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const resolveUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<{ url: string; storageId: string }> => {
    await requireUid(ctx);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Uploaded file not found");
    return { url, storageId };
  },
});

/**
 * Generate the copy (and a media prompt) for a preset + the user's inputs.
 * Media rendering is a separate step so the user can approve copy first.
 */
export const generateCopy = action({
  args: {
    presetId: v.string(),
    platform: v.string(),
    postFormat: v.optional(v.string()),
    prompt: v.optional(v.string()),
    context: v.optional(v.string()),
    productName: v.optional(v.string()),
    brandProfileId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    hook: string;
    caption: string;
    hashtags: string[];
    mediaPrompt?: string;
    hookFamily?: string;
    trendUsed?: string;
    whyShare?: string;
    altText?: string;
  }> => {
    await requireUid(ctx);
    const preset = getPreset(args.presetId);
    const provider = getProvider(args.platform);
    if (args.postFormat) {
      const normalized = args.postFormat === "text_post" ? "post" : args.postFormat;
      if (
        provider.limits.supportedFormats &&
        !provider.limits.supportedFormats.includes(normalized as any) &&
        !provider.limits.supportedFormats.includes(args.postFormat as any)
      ) {
        throw new Error(
          `${provider.displayName} does not support '${args.postFormat}' format. Supported formats: ${provider.limits.supportedFormats.join(", ")}`,
        );
      }
    }
    const brief = args.prompt?.trim() || preset.starterPrompt?.trim();
    let trendRows: Array<{
      kind: string;
      value: string;
      title?: string;
      score: number;
    }> = [];
    try {
      const trends = await ctx.runQuery(internal.trends.brief, {
        platforms: [args.platform],
        limitPerPlatform: 6,
      });
      trendRows = trends[args.platform] ?? [];
    } catch (error) {
      console.warn("[studio] live trend brief unavailable; using evergreen engine", error);
    }
    const trendBlock = trendRows.length
      ? trendRows
          .map(
            (trend) =>
              `- [${trend.kind}] ${trend.value}${trend.title ? ` — ${trend.title}` : ""} (${trend.score.toFixed(2)})`,
          )
          .join("\n")
      : "(No supported live trend fits yet. Prefer an evergreen audience need.)";
    const staticRules = buildStaticCreativeRules([args.platform]);

    const result = await geminiJson<{
      hook: string;
      caption: string;
      hashtags: string[];
      mediaPrompt?: string;
      hookFamily?: string;
      trendUsed?: string;
      whyShare?: string;
      altText?: string;
    }>({
      model: MODELS.text,
      temperature: 0.82,
      system:
        "You are MagicBox's evidence-led static-content creative director. Write like a specific " +
        "human practitioner, never like an AI or a press release. Never invent statistics, " +
        "testimonials, urgency, product capabilities, or results.",
      prompt:
        `Write a ${preset.name} post for ${provider.displayName}.\n\n` +
        `## Structure to follow\n${preset.structure}\n\n` +
        `## Production direction\n${preset.direction || "Use the smallest native format that delivers the idea."}\n\n` +
        (preset.rightsNote ? `## Rights constraint\n${preset.rightsNote}\n\n` : "") +
        (args.productName ? `## Product\n${args.productName}\n\n` : "") +
        (brief ? `## The brief\n${brief}\n\n` : "") +
        (args.context ? `## Website and brand evidence\n${args.context}\n\n` : "") +
        `## Current trend evidence\n${trendBlock}\n\n` +
        `${staticRules}\n\n` +
        `## Hard limits\n` +
        `- Silently test at least two hook mechanisms and return the stronger truthful hook.\n` +
        `- caption's first line MUST be the hook, then begin the payoff immediately.\n` +
        `- caption MUST be under ${provider.limits.maxCaptionLength} characters.\n` +
        `- Ready to publish. No placeholders like [insert X].\n` +
        `- 3-8 relevant hashtags, each MUST start with '#' (e.g. #DigitalMarketing), no spam walls.\n` +
        `- hookFamily: the selected hook mechanism id.\n` +
        `- trendUsed: the exact trend value above, or an empty string when no trend genuinely fits.\n` +
        `- whyShare: one short sentence naming why a specific reader would pass this on.\n` +
        `- altText: concise accessible description of the intended finished visual.\n` +
        (preset.mediaType !== "none"
          ? `- mediaPrompt: a production-ready ${preset.mediaType} description. Directing notes: ${preset.direction}\n`
          : `- No media; omit mediaPrompt.\n`),
      schema: COPY_SCHEMA as unknown as Record<string, unknown>,
    });

    if (result.hashtags && Array.isArray(result.hashtags)) {
      result.hashtags = result.hashtags
        .map((h) => (h.startsWith("#") ? h : `#${h.replace(/^[#\s]+/, "")}`))
        .filter(Boolean);
    }

    // Enforce the platform limit rather than trusting the model to obey it.
    if (result.caption.length > provider.limits.maxCaptionLength) {
      result.caption = result.caption.slice(0, provider.limits.maxCaptionLength - 1).trimEnd() + "…";
    }
    return result;
  },
});

export const insertPost = internalMutation({
  args: {
    userId: v.string(),
    caption: v.string(),
    hashtags: v.array(v.string()),
    postFormat: v.optional(
      v.union(
        v.literal("image"),
        v.literal("carousel"),
        v.literal("reel"),
        v.literal("video"),
        v.literal("post"),
        v.literal("text_post"),
      ),
    ),
    platforms: v.array(v.string()),
    socialAccountIds: v.array(v.string()),
    media: v.optional(v.array(v.any())),
    brief: v.string(),
    brandProfileId: v.optional(v.string()),
    mode: v.union(v.literal("now"), v.literal("schedule"), v.literal("draft")),
    scheduledFor: v.optional(v.number()),
    timezone: v.string(),
    /** WhatsApp A2P: opted-in E.164 recipients (+ optional approved template). */
    whatsapp: v.optional(
      v.object({
        recipients: v.array(v.string()),
        templateName: v.optional(v.string()),
        templateLanguage: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ postId: Id<"posts">; scheduledFor: number; status: string }> => {
    const now = Date.now();
    const platform = (args.platforms[0] ?? "instagram") as Platform;

    // Resolve WHEN. "now" publishes immediately; "schedule" without an explicit
    // time falls back to the same best-time queue Maya uses, so Studio and Maya
    // never fight over slots.
    let scheduledFor = args.scheduledFor ?? now;
    if (args.mode === "schedule" && !args.scheduledFor) {
      const tpl = await ctx.db
        .query("slotTemplates")
        .withIndex("by_userId_platform", (q) =>
          q.eq("userId", args.userId).eq("platform", platform),
        )
        .unique();
      const slots: Slot[] = tpl?.slots ?? DEFAULT_SLOTS[platform] ?? [];
      const upcoming = await ctx.db
        .query("posts")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
      const taken = upcoming
        .filter((p) => p.scheduledFor > now && p.status !== "cancelled" && p.status !== "failed")
        .map((p) => p.scheduledFor);
      scheduledFor = nextOpenSlot({
        slots,
        timeZone: tpl?.timezone ?? args.timezone,
        from: now,
        taken,
      });
    }

    const status =
      args.mode === "draft" || args.socialAccountIds.length === 0 ? "draft" : "scheduled";

    const perPlatform =
      args.whatsapp && args.platforms.includes("whatsapp")
        ? {
            whatsapp: {
              recipients: args.whatsapp.recipients,
              templateName: args.whatsapp.templateName,
              templateLanguage: args.whatsapp.templateLanguage,
            },
          }
        : undefined;

    const postId = await ctx.db.insert("posts", {
      userId: args.userId,
      brandProfileId: args.brandProfileId,
      source: "manual",
      postFormat: args.postFormat,
      scheduledFor,
      timezone: args.timezone,
      status: status as any,
      brief: args.brief,
      content: {
        caption: args.caption,
        hashtags: args.hashtags,
        ...(perPlatform ? { perPlatform } : {}),
      },
      media: args.media,
      platforms: args.platforms as any,
      socialAccountIds: args.socialAccountIds,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
    });

    return { postId, scheduledFor, status };
  },
});

/**
 * THE BRIDGE: take a finished Studio asset and post it now, schedule it, or save
 * it as a draft.
 *
 * `mode: "now"` publishes immediately via the same engine the cron uses — one
 * publish path, so "post now" and "scheduled" can never diverge in behaviour.
 */
export const createPost = action({
  args: {
    caption: v.string(),
    hashtags: v.optional(v.array(v.string())),
    postFormat: v.optional(
      v.union(
        v.literal("image"),
        v.literal("carousel"),
        v.literal("reel"),
        v.literal("video"),
        v.literal("post"),
        v.literal("text_post"),
      ),
    ),
    platforms: v.array(v.string()),
    socialAccountIds: v.optional(v.array(v.string())),
    mediaUrl: v.optional(v.string()),
    /** Multiple image URLs form an Instagram carousel / LinkedIn multi-image post. */
    mediaUrls: v.optional(v.array(v.string())),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
    mediaSource: v.optional(v.string()),
    /** For video uploads: seconds to bill as v-credits. Defaults to 8. */
    durationSeconds: v.optional(v.number()),
    brief: v.optional(v.string()),
    brandProfileId: v.optional(v.string()),
    mode: v.union(v.literal("now"), v.literal("schedule"), v.literal("draft")),
    scheduledFor: v.optional(v.number()),
    timezone: v.optional(v.string()),
    whatsappRecipients: v.optional(v.array(v.string())),
    whatsappTemplateName: v.optional(v.string()),
    whatsappTemplateLanguage: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    postId: Id<"posts">;
    status: string;
    scheduledFor: number;
    published?: number;
    of?: number;
  }> => {
    const uid = await requireUid(ctx);
    if (!args.caption.trim() || args.caption.length > MAX_CAPTION_LENGTH) {
      throw new Error(`Caption must be between 1 and ${MAX_CAPTION_LENGTH} characters`);
    }
    if (!args.platforms.length || args.platforms.length > 7 || new Set(args.platforms).size !== args.platforms.length) {
      throw new Error("Select one or more unique platforms");
    }
    if ((args.hashtags?.length ?? 0) > 12 || args.hashtags?.some((tag) => !tag.trim() || tag.length > 100)) {
      throw new Error("Use at most 12 hashtags of 100 characters or fewer");
    }
    assertTextLength(args.brief, "Brief", 4_000);
    assertTextLength(args.brandProfileId, "Brand profile id", 256);
    if (args.mediaUrl !== undefined && args.mediaUrls !== undefined) {
      throw new Error("Use mediaUrl or mediaUrls, not both");
    }
    const mediaInputs =
      args.mediaUrls !== undefined
        ? args.mediaUrls
        : args.mediaUrl !== undefined
          ? [args.mediaUrl]
          : [];
    if (
      mediaInputs.length > 20 ||
      new Set(mediaInputs).size !== mediaInputs.length ||
      mediaInputs.some((url) => !url.trim())
    ) {
      throw new Error("Use at most 20 unique media files");
    }
    if (mediaInputs.length > 0 && !args.mediaType) {
      throw new Error("Media type is required when a media URL is provided");
    }
    if (args.mediaType && mediaInputs.length === 0) {
      throw new Error("Media URL is required when a media type is provided");
    }
    if (args.mediaType === "video" && mediaInputs.length > 1) {
      throw new Error("Only one video can be attached to a post");
    }
    if (
      args.mediaSource !== undefined &&
      !["upload", "imagen", "veo", "remotion"].includes(args.mediaSource)
    ) {
      throw new Error("Media source is invalid");
    }
    if (
      args.durationSeconds !== undefined &&
      (!Number.isFinite(args.durationSeconds) || args.durationSeconds < 1 || args.durationSeconds > MAX_VIDEO_SECONDS)
    ) {
      throw new Error(`Video duration must be between 1 and ${MAX_VIDEO_SECONDS} seconds`);
    }
    if (
      args.scheduledFor !== undefined &&
      (!Number.isFinite(args.scheduledFor) ||
        args.scheduledFor < Date.now() - 5 * 60_000 ||
        args.scheduledFor > Date.now() + 366 * 24 * 60 * 60_000)
    ) {
      throw new Error("Scheduled time must be between now and one year from now");
    }
    const timezone = args.timezone ?? "Asia/Kolkata";
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      throw new Error("Timezone must be a valid IANA timezone");
    }

    // Default to the user's active accounts for the target platforms.
    let accountIds = args.socialAccountIds ?? [];
    if (accountIds.length === 0) {
      const accounts: any[] = await ctx.runQuery(internal.studio.activeAccounts, {
        userId: uid,
        platforms: args.platforms,
      });
      accountIds = accounts.map((a) => a._id);
    } else {
      accountIds = await ctx.runQuery(internal.studio.assertOwnedActiveAccounts, {
        userId: uid,
        accountIds,
        platforms: args.platforms,
      });
    }

    const media =
      mediaInputs.length > 0 && args.mediaType
        ? mediaInputs.map((url) => ({
            type: args.mediaType!,
            url: trustedMediaUrl(url),
            source: (args.mediaSource ?? "upload") as any,
          }))
        : undefined;

    // Fail fast on platform limits before creating anything — a post that can
    // never publish shouldn't reach the queue.
    for (const p of args.platforms) {
      const provider = getProvider(p);
      if (provider.deferred) {
        throw new Error(`${provider.displayName} is not enabled: ${provider.deferred.reason}`);
      }
      if (args.postFormat) {
        const normalized = args.postFormat === "text_post" ? "post" : args.postFormat;
        if (
          provider.limits.supportedFormats &&
          !provider.limits.supportedFormats.includes(normalized as any) &&
          !provider.limits.supportedFormats.includes(args.postFormat as any)
        ) {
          throw new Error(
            `${provider.displayName} does not support '${args.postFormat}' format. Supported formats: ${provider.limits.supportedFormats.join(", ")}`,
          );
        }
      }
      if (provider.limits.requiresMedia && !media) {
        throw new Error(`${provider.displayName} requires an image or video.`);
      }
      const imageCount = media?.filter((item) => item.type === "image").length ?? 0;
      const videoCount = media?.filter((item) => item.type === "video").length ?? 0;
      if (imageCount > provider.limits.maxImages) {
        throw new Error(
          `${provider.displayName} accepts at most ${provider.limits.maxImages} image${provider.limits.maxImages === 1 ? "" : "s"} per post.`,
        );
      }
      if (videoCount > provider.limits.maxVideos) {
        throw new Error(
          `${provider.displayName} accepts at most ${provider.limits.maxVideos} video${provider.limits.maxVideos === 1 ? "" : "s"} per post.`,
        );
      }
    }

    if (args.platforms.includes("whatsapp") && args.mode !== "draft") {
      const recipients = (args.whatsappRecipients ?? [])
        .map((n) => n.replace(/[^\d]/g, ""))
        .filter((n) => n.length >= 8);
      if (recipients.length === 0) {
        throw new Error(
          "WhatsApp needs at least one opted-in recipient phone (E.164, digits only).",
        );
      }
    }

    // Paid entitlement + monthly post quota first. Drafts stay free.
    // Credits: 1 i-credit, or N v-credits for video uploads. Veo clips were
    // already billed at generate time.
    if (args.mode !== "draft") {
      await ctx.runMutation(internal.credits.ensure, { userId: uid });
      await ctx.runMutation(internal.credits.reservePublish, { userId: uid });
      try {
        if (args.mediaType === "video") {
          const source = args.mediaSource ?? "upload";
          const isOwnedVeoMedia =
            source === "veo" && media?.[0]?.url
              ? await ctx.runQuery(internal.media.isOwnedCompletedVideo, {
                  userId: uid,
                  url: media[0].url,
                })
              : false;
          if (!isOwnedVeoMedia) {
            const seconds = Math.max(1, Math.ceil(args.durationSeconds ?? DEFAULT_VEO_SECONDS));
            await ctx.runMutation(internal.credits.spendV, {
              userId: uid,
              amount: seconds,
              reason: "post_video",
            });
          }
        } else {
          await ctx.runMutation(internal.credits.spendI, {
            userId: uid,
            amount: 1,
            reason: "post_image_or_text",
          });
        }
      } catch (error) {
        await ctx.runMutation(internal.credits.releasePublish, { userId: uid });
        throw error;
      }
    }

    const { postId, scheduledFor, status } = await ctx.runMutation(internal.studio.insertPost, {
      userId: uid,
      caption: args.caption,
      hashtags: args.hashtags ?? [],
      postFormat: args.postFormat,
      platforms: args.platforms,
      socialAccountIds: accountIds,
      media,
      brief: args.brief ?? args.caption.slice(0, 120),
      brandProfileId: args.brandProfileId,
      mode: args.mode,
      scheduledFor: args.scheduledFor,
      timezone,
      whatsapp: args.platforms.includes("whatsapp")
        ? {
            recipients: (args.whatsappRecipients ?? [])
              .map((n) => n.replace(/[^\d]/g, ""))
              .filter((n) => n.length >= 8),
            templateName: args.whatsappTemplateName,
            templateLanguage: args.whatsappTemplateLanguage,
          }
        : undefined,
    });

    if (args.mode === "now" && status === "scheduled") {
      const r = await ctx.runAction(internal.scheduler.publishNow, { postId });
      return { postId, status: r.status, scheduledFor, published: r.published, of: r.of };
    }

    return { postId, status, scheduledFor };
  },
});

export const activeAccounts = internalQuery({
  args: { userId: v.string(), platforms: v.array(v.string()) },
  handler: async (ctx, { userId, platforms }) => {
    const accounts = await ctx.db
      .query("socialAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return accounts.filter((a) => a.status === "active" && platforms.includes(a.platform));
  },
});

/** Verify caller-supplied account ids before a post can ever reach a provider. */
export const assertOwnedActiveAccounts = internalQuery({
  args: { userId: v.string(), accountIds: v.array(v.string()), platforms: v.array(v.string()) },
  handler: async (ctx, { userId, accountIds, platforms }) => {
    if (accountIds.length === 0 || accountIds.length > 20 || new Set(accountIds).size !== accountIds.length) {
      throw new Error("Connected account selection is invalid");
    }
    const accounts = await ctx.db
      .query("socialAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const byId = new Map(accounts.map((account) => [account._id, account]));
    for (const id of accountIds) {
      const account = byId.get(id as Id<"socialAccounts">);
      if (!account || account.status !== "active" || !platforms.includes(account.platform)) {
        throw new Error("One or more connected accounts is unavailable");
      }
    }
    return accountIds;
  },
});

/** Reschedule or cancel from the calendar. */
export const reschedule = mutation({
  args: { postId: v.id("posts"), scheduledFor: v.number() },
  handler: async (ctx, { postId, scheduledFor }) => {
    const uid = await requireUid(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== uid) throw new Error("Post not found");
    if (post.status === "posted") throw new Error("Already published");
    await ctx.db.patch(postId, {
      scheduledFor,
      status: "scheduled",
      nextAttemptAt: undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const cancel = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const uid = await requireUid(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.userId !== uid) throw new Error("Post not found");
    if (post.status === "posted") throw new Error("Already published");
    await ctx.db.patch(postId, { status: "cancelled", updatedAt: Date.now() });
    return { success: true };
  },
});
