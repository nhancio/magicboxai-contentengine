import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
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

/**
 * Dual-write a website-derived brand kit during the Firebase → Convex migration.
 *
 * Maya reads its grounding data from Convex, so saving only the legacy
 * Firestore document would make a completed website step look missing here.
 */
export const upsertFromWebsite = mutation({
  args: {
    legacyId: v.string(),
    name: v.string(),
    websiteUrl: v.string(),
    logoUrl: v.optional(v.string()),
    colors: v.optional(
      v.object({
        primary: v.string(),
        secondary: v.optional(v.string()),
        accent: v.optional(v.string()),
      }),
    ),
    industry: v.optional(v.string()),
    toneOfVoice: v.optional(v.string()),
    audience: v.optional(v.string()),
    hashtagSets: v.optional(v.object({ default: v.array(v.string()) })),
    sampleCaptions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const url = new URL(args.websiteUrl);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
      throw new Error("Website must be a valid http or https URL");
    }
    if (!args.legacyId.trim() || !args.name.trim()) {
      throw new Error("Brand id and name are required");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("brandProfiles")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", args.legacyId))
      .unique();

    const values = {
      name: args.name.trim().slice(0, 160),
      websiteUrl: url.toString(),
      ...(args.logoUrl ? { logoUrl: args.logoUrl } : {}),
      ...(args.colors ? { colors: args.colors } : {}),
      ...(args.industry ? { industry: args.industry } : {}),
      ...(args.toneOfVoice ? { toneOfVoice: args.toneOfVoice } : {}),
      ...(args.audience ? { audience: args.audience } : {}),
      ...(args.hashtagSets ? { hashtagSets: args.hashtagSets } : {}),
      ...(args.sampleCaptions ? { sampleCaptions: args.sampleCaptions } : {}),
      updatedAt: now,
    };

    let brandProfileId;
    if (existing) {
      if (existing.userId !== uid) throw new Error("Brand profile not found");
      await ctx.db.patch(existing._id, values);
      brandProfileId = existing._id;
    } else {
      brandProfileId = await ctx.db.insert("brandProfiles", {
        legacyId: args.legacyId,
        userId: uid,
        ...values,
        createdAt: now,
      });
    }

    const config = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    if (config && !config.brandProfileId) {
      await ctx.db.patch(config._id, { brandProfileId, updatedAt: now });
    }

    return { brandProfileId };
  },
});

/** Remove the Convex mirror when a legacy website kit is deleted. */
export const removeByLegacyId = mutation({
  args: { legacyId: v.string() },
  handler: async (ctx, { legacyId }) => {
    const uid = await requireUid(ctx);
    const existing = await ctx.db
      .query("brandProfiles")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyId))
      .unique();
    if (!existing || existing.userId !== uid) return { removed: false };

    const alternatives = await ctx.db
      .query("brandProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
    const replacement = alternatives.find(
      (brand) => brand._id !== existing._id && brand.websiteUrl?.trim(),
    );
    const config = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();

    await ctx.db.delete(existing._id);
    if (config?.brandProfileId === existing._id) {
      await ctx.db.patch(config._id, {
        brandProfileId: replacement?._id,
        enabled: !!replacement,
        updatedAt: Date.now(),
      });
    }
    return { removed: true };
  },
});
