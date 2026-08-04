import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUid } from "./lib/auth";

export const listingValidator = v.object({
  _id: v.id("warmedAccountListings"),
  _creationTime: v.number(),
  userId: v.string(),
  platform: v.union(v.literal("instagram"), v.literal("youtube")),
  title: v.string(),
  handleOrUrl: v.string(),
  followerCount: v.number(),
  followerCountLabel: v.optional(v.string()),
  avgViews: v.optional(v.number()),
  avgLikes: v.optional(v.number()),
  engagementRate: v.optional(v.string()),
  accountAgeMonths: v.number(),
  niche: v.string(),
  askingPrice: v.number(),
  contactEmail: v.string(),
  transferNotes: v.optional(v.string()),
  status: v.union(
    v.literal("under_review"),
    v.literal("verified"),
    v.literal("rejected"),
    v.literal("sold"),
  ),
  rejectionReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
});

/**
 * List account listings.
 * Supports filtering by mySubmissionsOnly, status, and platform.
 */
export const listListings = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("under_review"),
        v.literal("verified"),
        v.literal("rejected"),
        v.literal("sold"),
        v.literal("all"),
      ),
    ),
    platform: v.optional(
      v.union(v.literal("instagram"), v.literal("youtube"), v.literal("all")),
    ),
    mySubmissionsOnly: v.optional(v.boolean()),
  },
  returns: v.array(listingValidator),
  handler: async (ctx, args) => {
    let items;

    if (args.mySubmissionsOnly) {
      const uid = await requireUid(ctx);
      items = await ctx.db
        .query("warmedAccountListings")
        .withIndex("by_userId", (q) => q.eq("userId", uid))
        .collect();
    } else if (args.status && args.status !== "all") {
      items = await ctx.db
        .query("warmedAccountListings")
        .withIndex("by_status", (q) =>
          q.eq("status", args.status as "under_review" | "verified" | "rejected" | "sold"),
        )
        .collect();
    } else {
      items = await ctx.db.query("warmedAccountListings").collect();
    }

    // Filter by platform if specified
    if (args.platform && args.platform !== "all") {
      items = items.filter((item) => item.platform === args.platform);
    }

    // Filter by status if mySubmissionsOnly was set along with a status filter
    if (args.mySubmissionsOnly && args.status && args.status !== "all") {
      items = items.filter((item) => item.status === args.status);
    }

    // Default to verified if not mySubmissionsOnly and status not explicitly provided
    if (!args.mySubmissionsOnly && (!args.status || args.status === undefined)) {
      items = items.filter((item) => item.status === "verified" || item.status === "under_review");
    }

    // Sort newest first
    return items.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Submit a new Instagram/YouTube account listing for sale/verification.
 */
export const submitListing = mutation({
  args: {
    platform: v.union(v.literal("instagram"), v.literal("youtube")),
    title: v.string(),
    handleOrUrl: v.string(),
    followerCount: v.number(),
    followerCountLabel: v.optional(v.string()),
    avgViews: v.optional(v.number()),
    avgLikes: v.optional(v.number()),
    engagementRate: v.optional(v.string()),
    accountAgeMonths: v.number(),
    niche: v.string(),
    askingPrice: v.number(),
    contactEmail: v.string(),
    transferNotes: v.optional(v.string()),
  },
  returns: v.id("warmedAccountListings"),
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const now = Date.now();

    if (!args.title.trim()) throw new Error("Account title is required");
    if (!args.handleOrUrl.trim()) throw new Error("Handle or Channel URL is required");
    if (!args.niche.trim()) throw new Error("Niche/Category is required");
    if (!args.contactEmail.trim()) throw new Error("Contact email is required");

    return await ctx.db.insert("warmedAccountListings", {
      userId: uid,
      platform: args.platform,
      title: args.title.trim(),
      handleOrUrl: args.handleOrUrl.trim(),
      followerCount: Math.max(0, args.followerCount),
      followerCountLabel: args.followerCountLabel || `${args.followerCount.toLocaleString()}`,
      avgViews: args.avgViews !== undefined ? Math.max(0, args.avgViews) : undefined,
      avgLikes: args.avgLikes !== undefined ? Math.max(0, args.avgLikes) : undefined,
      engagementRate: args.engagementRate,
      accountAgeMonths: Math.max(1, args.accountAgeMonths),
      niche: args.niche.trim(),
      askingPrice: Math.max(0, args.askingPrice),
      contactEmail: args.contactEmail.trim(),
      transferNotes: args.transferNotes ? args.transferNotes.trim() : undefined,
      status: "under_review",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update listing status (under_review, verified, rejected, sold).
 */
export const updateListingStatus = mutation({
  args: {
    id: v.id("warmedAccountListings"),
    status: v.union(
      v.literal("under_review"),
      v.literal("verified"),
      v.literal("rejected"),
      v.literal("sold"),
    ),
    rejectionReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const listing = await ctx.db.get(args.id);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Owner or admin check
    if (listing.userId !== uid) {
      // Allow owner or logged-in user to mark sold/status if it's their listing
      throw new Error("Unauthorized: Only the account owner or admin can update listing status");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      rejectionReason: args.rejectionReason,
      updatedAt: Date.now(),
    });

    return null;
  },
});
