import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex schema for MagicBox — mirrors the current Firestore data model so the
 * Firestore -> Convex backfill (Month 3) can map 1:1.
 *
 * Conventions for the migration:
 *  - `legacyId` holds the original Firestore document id so backfill is idempotent
 *    and reversible, and so provider/webhook payloads that reference the old id
 *    still resolve during the dual-write window.
 *  - `userId` is the Firebase Auth uid (string), NOT a Convex `_id`, until auth
 *    fully cuts over. Every tenant-scoped table indexes on it so authorization
 *    checks fail closed.
 *  - Timestamps are epoch-millis numbers (Firestore Timestamp.toMillis()), not
 *    Convex `_creationTime`, so historical created/updated times survive backfill.
 *  - Large media stays in GCS/Blob; we store only URLs + storage paths here.
 */

const socialPlatform = v.union(
  v.literal("instagram"),
  v.literal("twitter"),
  v.literal("linkedin"),
  v.literal("youtube"),
);

const socialProvider = v.union(
  v.literal("instagram"),
  v.literal("linkedin"),
  v.literal("youtube"),
);

export default defineSchema({
  users: defineTable({
    legacyId: v.string(), // Firebase uid == doc id
    email: v.string(),
    displayName: v.optional(v.string()),
    photoURL: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_legacyId", ["legacyId"])
    .index("by_email", ["email"]),

  subscriptions: defineTable({
    legacyId: v.string(),
    userId: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
    status: v.optional(
      v.union(
        v.literal("inactive"),
        v.literal("active"),
        v.literal("past_due"),
        v.literal("cancelled"),
      ),
    ),
    videosUsed: v.optional(v.number()),
    videosLimit: v.optional(v.number()),
    postsUsed: v.optional(v.number()),
    postsLimit: v.optional(v.number()),
    // Dodo provider linkage (authoritative billing state).
    provider: v.optional(v.string()),
    providerCustomerId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    productId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_legacyId", ["legacyId"])
    .index("by_providerSubscriptionId", ["providerSubscriptionId"]),

  brandProfiles: defineTable({
    legacyId: v.string(),
    userId: v.string(),
    name: v.string(),
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
    bannedTopics: v.optional(v.array(v.string())),
    hashtagSets: v.optional(v.object({ default: v.array(v.string()) })),
    sampleCaptions: v.optional(v.array(v.string())),
    websiteUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]).index("by_legacyId", ["legacyId"]),

  socialAccounts: defineTable({
    legacyId: v.string(),
    userId: v.string(),
    provider: socialProvider,
    platform: socialPlatform,
    externalId: v.string(),
    username: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("disconnected"),
      v.literal("expired"),
    ),
    linkedAt: v.number(),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_legacyId", ["legacyId"])
    .index("by_externalId", ["externalId"]),

  // Secrets: OAuth tokens. Kept server-only; never exposed to public queries.
  socialTokens: defineTable({
    legacyId: v.string(),
    userId: v.string(),
    socialAccountId: v.string(),
    provider: socialProvider,
    encryptedAccessToken: v.optional(v.string()),
    encryptedRefreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_socialAccountId", ["socialAccountId"]),

  automations: defineTable({
    legacyId: v.string(),
    userId: v.string(),
    brandProfileId: v.optional(v.string()),
    name: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("draft"),
      v.literal("error"),
    ),
    brief: v.string(),
    platforms: v.array(socialPlatform),
    socialAccountIds: v.array(v.string()),
    contentTypes: v.object({
      text: v.boolean(),
      image: v.boolean(),
      video: v.boolean(),
    }),
    preset: v.string(),
    tone: v.optional(v.string()),
    schedule: v.object({
      type: v.union(v.literal("recurring"), v.literal("once")),
      cron: v.optional(v.string()),
      time: v.string(),
      daysOfWeek: v.optional(v.array(v.number())),
      timezone: v.string(),
      startAt: v.optional(v.number()),
      endAt: v.optional(v.number()),
    }),
    nextRunAt: v.number(),
    lastRunAt: v.optional(v.number()),
    runCount: v.number(),
    failureCount: v.number(),
    lastError: v.optional(v.string()),
    generateLeadMinutes: v.number(),
    requiresApproval: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_legacyId", ["legacyId"])
    // Scheduler tick queries this: active automations due to fire.
    .index("by_status_nextRunAt", ["status", "nextRunAt"]),

  posts: defineTable({
    legacyId: v.string(),
    userId: v.string(),
    automationId: v.optional(v.string()),
    brandProfileId: v.optional(v.string()),
    source: v.union(v.literal("automation"), v.literal("manual")),
    scheduledFor: v.number(),
    timezone: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending_approval"),
      v.literal("scheduled"),
      v.literal("generating"),
      v.literal("ready"),
      v.literal("posting"),
      v.literal("posted"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    brief: v.string(),
    content: v.optional(
      v.object({
        caption: v.string(),
        hashtags: v.array(v.string()),
        perPlatform: v.optional(v.any()),
      }),
    ),
    media: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("image"), v.literal("video")),
          storagePath: v.optional(v.string()),
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
    platforms: v.array(socialPlatform),
    socialAccountIds: v.array(v.string()),
    results: v.optional(v.array(v.any())),
    attempts: v.number(),
    maxAttempts: v.number(),
    nextAttemptAt: v.optional(v.number()),
    error: v.optional(v.string()),
    // `${automationId}_${slotISO}` — enforces exactly-once post creation.
    idempotencyKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_legacyId", ["legacyId"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_automationId", ["automationId"])
    // Scheduler drains due/ready posts.
    .index("by_status_scheduledFor", ["status", "scheduledFor"]),

  // Append-only ledger for Dodo webhook events (idempotency + audit).
  paymentEvents: defineTable({
    eventId: v.string(),
    userId: v.optional(v.string()),
    type: v.string(),
    providerSubscriptionId: v.optional(v.string()),
    productId: v.optional(v.string()),
    status: v.optional(v.string()),
    receivedAt: v.number(),
    payloadDigest: v.optional(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_userId", ["userId"]),

  apiLogs: defineTable({
    endpoint: v.string(),
    method: v.string(),
    userId: v.optional(v.string()),
    statusCode: v.number(),
    duration: v.number(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
});
