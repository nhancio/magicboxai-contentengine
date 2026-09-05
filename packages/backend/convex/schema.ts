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

/**
 * Every destination MagicBox can publish to. `facebook` is a first-class target
 * (a Page), distinct from `instagram` even though both authenticate through Meta.
 * `whatsapp` uses the same Meta app (`META_APP_ID`) as Facebook Pages, via
 * WhatsApp Cloud API + a WABA phone number.
 */
const socialPlatform = v.union(
  v.literal("instagram"),
  v.literal("facebook"),
  v.literal("twitter"),
  v.literal("linkedin"),
  v.literal("youtube"),
  v.literal("reddit"),
  v.literal("whatsapp"),
);

/**
 * The OAuth-connectable subset. Kept identical to `socialPlatform` so a platform
 * can never appear on a post without a way to connect it — the mismatch that
 * previously let `twitter` exist as a platform with no connect path.
 *
 * `twitter` and `reddit` are registered but deliberately DEFERRED: their provider
 * modules throw `ProviderDeferredError` until commercial API access is chosen
 * (X = metered pay-per-use; Reddit = paid commercial tier + manual approval).
 */
const socialProvider = socialPlatform;

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
    coreIdentity: v.optional(v.string()),
    productOffering: v.optional(v.string()),
    uniqueBenefits: v.optional(v.string()),
    problemSolution: v.optional(v.string()),
    mission: v.optional(v.string()),
    differentiation: v.optional(v.string()),
    ownedSpace: v.optional(v.string()),
    contentAngles: v.optional(v.array(v.string())),
    toneDos: v.optional(v.array(v.string())),
    toneDonts: v.optional(v.array(v.string())),
    customerSegments: v.optional(
      v.array(
        v.object({
          segmentName: v.string(),
          percentage: v.number(),
        })
      )
    ),
    competitors: v.optional(v.array(v.string())),
    bannedTopics: v.optional(v.array(v.string())),
    hashtagSets: v.optional(v.object({ default: v.array(v.string()) })),
    sampleCaptions: v.optional(v.array(v.string())),
    websiteUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]).index("by_legacyId", ["legacyId"]),

  socialAccounts: defineTable({
    // Optional: rows created natively by the Convex OAuth flow have no Firestore
    // ancestor. Present only on backfilled rows.
    legacyId: v.optional(v.string()),
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
    legacyId: v.optional(v.string()),
    userId: v.string(),
    socialAccountId: v.string(),
    provider: socialProvider,
    encryptedAccessToken: v.optional(v.string()),
    encryptedRefreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    // Provider-specific identifiers needed at publish time:
    //  - instagram: igUserId (Instagram User token; pageId unused for IG Login)
    //  - youtube:   channelId
    //  - facebook:  pageId
    //  - whatsapp:  phoneNumberId + wabaId (user token from META_APP_*)
    igUserId: v.optional(v.string()),
    pageId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    phoneNumberId: v.optional(v.string()),
    wabaId: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_socialAccountId", ["socialAccountId"]),

  automations: defineTable({
    // Optional: native Convex automations have no Firestore ancestor.
    legacyId: v.optional(v.string()),
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
    legacyId: v.optional(v.string()),
    userId: v.string(),
    automationId: v.optional(v.string()),
    // Set when the post originated from a Maya swipe-approval.
    suggestionId: v.optional(v.id("suggestions")),
    // Lease for the publish cron: prevents two overlapping ticks double-posting.
    claimedAt: v.optional(v.number()),
    claimToken: v.optional(v.string()),
    brandProfileId: v.optional(v.string()),
    source: v.union(v.literal("automation"), v.literal("manual")),
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

  videoJobs: defineTable({
    userId: v.string(),
    templateId: v.string(),
    status: v.union(v.literal("pending"), v.literal("rendering"), v.literal("completed"), v.literal("failed")),
    videoUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  avatars: defineTable({
    userId: v.string(),
    name: v.string(),
    personality: v.string(),
    voiceTone: v.string(),
    description: v.string(),
    sourceType: v.union(v.literal("photos"), v.literal("video_upload"), v.literal("webcam")),
    status: v.union(v.literal("processing"), v.literal("ready"), v.literal("failed")),
    videoUrl: v.optional(v.string()), // Generated preview or uploaded source
    previewStatus: v.optional(v.string()),
    previewError: v.optional(v.string()),
    storagePaths: v.optional(v.array(v.string())), // Raw images/video
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  studioVideos: defineTable({
    userId: v.string(),
    avatarId: v.id("avatars"),
    productImageUrl: v.optional(v.string()),
    productImageStoragePath: v.optional(v.string()),
    userPrompt: v.string(),
    generatedScript: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("generating_script"), v.literal("rendering"), v.literal("completed"), v.literal("failed")),
    videoUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]).index("by_avatarId", ["avatarId"]),

  myVideos: defineTable({
    userId: v.string(),
    title: v.string(),
    prompt: v.string(),
    rawVideoUrl: v.string(),
    rawStorageId: v.optional(v.id("_storage")),
    rawStoragePath: v.optional(v.string()),
    presetStyle: v.optional(v.string()),
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
    status: v.union(
      v.literal("draft"),
      v.literal("processing"),
      v.literal("editing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    transcript: v.optional(v.string()),
    takesPacked: v.optional(v.string()),
    edl: v.optional(
      v.object({
        segments: v.array(
          v.object({
            id: v.string(),
            startTime: v.number(),
            endTime: v.number(),
            speaker: v.optional(v.string()),
            text: v.string(),
            keep: v.boolean(),
            colorGrade: v.optional(v.string()),
            fadeMs: v.optional(v.number()),
            subtitles: v.optional(v.array(v.string())),
          }),
        ),
        totalDuration: v.number(),
        editedDuration: v.number(),
        colorGradePreset: v.string(),
        subtitleStyle: v.object({
          fontName: v.string(),
          fontSize: v.number(),
          bold: v.boolean(),
          uppercase: v.boolean(),
          chunkSize: v.number(),
          marginV: v.number(),
        }),
      }),
    ),
    editedVideoUrl: v.optional(v.string()),
    editedStorageId: v.optional(v.id("_storage")),
    generatedCaption: v.optional(v.string()),
    generatedHashtags: v.optional(v.array(v.string())),
    platforms: v.optional(v.array(socialPlatform)),
    postId: v.optional(v.id("posts")),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),


  /**
   * One-time OAuth state nonces. The Firebase implementation used a stateless
   * HMAC state, which is replay-able within its TTL; persisting the nonce and
   * burning it on use closes that gap (a known outstanding security item).
   */
  oauthStates: defineTable({
    nonce: v.string(),
    userId: v.string(),
    provider: socialProvider,
    returnTo: v.optional(v.string()),
    // Origin the browser started from (e.g. http://localhost:8174). Without this
    // we always bounced back to APP_BASE_URL (production), which still ran the
    // legacy Firebase OAuth path and showed cloudfunctions.net on Google's
    // "unverified app" screen.
    returnOrigin: v.optional(v.string()),
    // PKCE verifier — required by X, harmless (unused) for the others.
    codeVerifier: v.optional(v.string()),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_nonce", ["nonce"])
    .index("by_expiresAt", ["expiresAt"]),

  /**
   * Normalized trend signals powering Maya. Global (not tenant-scoped) and
   * refreshed by the daily `trends:refresh` cron. Free-first sources only:
   * YouTube Data API (chart=mostPopular, ~1 quota unit) and Gemini Google-Search
   * grounding. Paid sources (Apify TikTok, SerpApi) attach behind config flags.
   */
  trends: defineTable({
    platform: socialPlatform,
    kind: v.union(
      v.literal("topic"),
      v.literal("hashtag"),
      v.literal("sound"),
      v.literal("format"),
    ),
    value: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    // Normalized 0..1 rank within (platform, kind, region) for this batch.
    score: v.number(),
    region: v.string(),
    source: v.union(
      v.literal("youtube_api"),
      v.literal("gemini_grounding"),
      v.literal("apify_tiktok"),
      v.literal("serpapi"),
      v.literal("manual"),
    ),
    evidenceUrl: v.optional(v.string()),
    raw: v.optional(v.any()),
    batchDate: v.string(), // YYYY-MM-DD (UTC) — the daily fetch this belongs to
    fetchedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_batchDate", ["batchDate"])
    .index("by_platform_batchDate", ["platform", "batchDate"])
    .index("by_expiresAt", ["expiresAt"]),

  /**
   * Maya's daily swipe deck. This is the approval state machine:
   *   pending -> approved -> scheduled -> published
   *   pending -> discarded (terminal, but RETAINED as training signal)
   * Discarded rows are never deleted: left-swipes are the learning signal that
   * down-weights similar pillars/topics in the next batch.
   */
  suggestions: defineTable({
    userId: v.string(),
    brandProfileId: v.optional(v.string()),
    pillarId: v.optional(v.string()),
    batchDate: v.string(), // YYYY-MM-DD in the user's timezone
    // Idempotency: `${userId}_${batchDate}_${slot}` — a cron re-run never
    // double-generates a deck.
    idempotencyKey: v.string(),
    slot: v.number(), // 0..n-1 position within the day's deck
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
    platforms: v.array(socialPlatform),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("scheduled"),
      v.literal("published"),
      v.literal("discarded"),
      v.literal("failed"),
    ),
    hook: v.optional(v.string()),
    angle: v.optional(v.string()),
    caption: v.string(),
    hashtags: v.array(v.string()),
    mediaPlan: v.optional(
      v.object({
        type: v.union(v.literal("none"), v.literal("image"), v.literal("video")),
        prompt: v.optional(v.string()),
      }),
    ),
    // Versioned strategy metadata from the content engine. This makes each
    // suggestion explainable and lets later performance analytics learn which
    // hook/format mechanisms work for this user without guessing from copy.
    creativePlan: v.optional(
      v.object({
        engineVersion: v.string(),
        templateId: v.optional(v.string()),
        formatId: v.string(),
        hookFamily: v.string(),
        openingVisual: v.string(),
        contentBeats: v.array(v.string()),
        retentionDevices: v.array(v.string()),
        hookPayoff: v.string(),
        whyShare: v.string(),
        claimSafety: v.string(),
        ctaType: v.string(),
        qualityScore: v.number(),
        auditIssues: v.array(v.string()),
      }),
    ),
    media: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("image"), v.literal("video")),
          url: v.string(),
          storagePath: v.optional(v.string()),
          source: v.union(
            v.literal("imagen"),
            v.literal("veo"),
            v.literal("remotion"),
            v.literal("upload"),
          ),
        }),
      ),
    ),
    // Which trend rows grounded this suggestion (provenance for "why this?").
    trendRefs: v.optional(v.array(v.id("trends"))),
    // gemini text-embedding-004 (768d) of hook+caption — powers dedup.
    embedding: v.optional(v.array(v.float64())),
    feedback: v.optional(
      v.object({
        decision: v.union(v.literal("right"), v.literal("left")),
        reason: v.optional(v.string()),
        dwellMs: v.optional(v.number()),
        decidedAt: v.number(),
        publishMode: v.optional(
          v.union(v.literal("now"), v.literal("schedule")),
        ),
      }),
    ),
    postId: v.optional(v.id("posts")), // set once approved -> scheduled
    scheduledAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId_batchDate", ["userId", "batchDate"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_postId", ["postId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["userId"],
    }),

  /**
   * Per-user, per-platform best-time posting slots. Right-swipe binds a
   * suggestion to the next OPEN slot rather than asking for a datetime.
   * Cold start = seeded platform defaults; `source: "learned"` once recomputed
   * from the user's own engagement.
   */
  slotTemplates: defineTable({
    userId: v.string(),
    platform: socialPlatform,
    timezone: v.string(),
    slots: v.array(
      v.object({
        dayOfWeek: v.number(), // 0=Sun .. 6=Sat
        hour: v.number(),
        minute: v.number(),
      }),
    ),
    source: v.union(v.literal("seeded"), v.literal("learned")),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_platform", ["userId", "platform"]),

  /**
   * Content pillars ("buckets"). Maya rotates across these so a day's deck is a
   * balanced mix rather than five variations of one idea. Weights are nudged by
   * swipe feedback.
   */
  contentPillars: defineTable({
    userId: v.string(),
    brandProfileId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    weight: v.number(), // relative selection weight; adjusted by feedback
    active: v.boolean(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  /** Per-user Maya settings + the cron's bookkeeping. */
  mayaConfig: defineTable({
    userId: v.string(),
    enabled: v.boolean(),
    dailyCount: v.number(), // default 5
    timezone: v.string(),
    reviewHourLocal: v.number(), // deck is ready by this local hour
    platforms: v.array(socialPlatform),
    brandProfileId: v.optional(v.string()),
    socialAccountIds: v.optional(v.array(v.string())),
    autoScheduleOnApprove: v.boolean(),
    lastBatchDate: v.optional(v.string()),
    lastRunAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_enabled", ["enabled"]),

  /**
   * Durable AI-media generation jobs (Gemini image + Veo video).
   *
   * Veo is a long-running operation that can take minutes; a single action can't
   * (and shouldn't) block on it. So a job row is the durable handle: the start
   * action records `operationName`, then a scheduled `pollVeo` action resumes
   * from the row until the video is ready — surviving process restarts, which is
   * exactly the Firebase bug ("a crash mid-poll loses a paid operation").
   *
   * `target` lets a finished asset attach itself back to the suggestion (Maya
   * card preview) or post (publish-ready media) that requested it.
   */
  mediaJobs: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("image"), v.literal("video")),
    status: v.union(
      v.literal("pending"),
      v.literal("rendering"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    prompt: v.string(),
    aspectRatio: v.optional(v.string()),
    // Veo long-running operation name: "models/<model>/operations/<id>".
    operationName: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    error: v.optional(v.string()),
    attempts: v.number(),
    /** v-credits charged when the Veo job started (for refunds on failure). */
    billedSeconds: v.optional(v.number()),
    // Where to attach the finished asset (and what to flip to "scheduled").
    target: v.optional(
      v.object({
        kind: v.union(v.literal("suggestion"), v.literal("post")),
        id: v.string(),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  /**
   * A meme template adapted to one brand: the persisted output of
   * mayaTemplates.adaptTemplate. `sourceVideoUrl` is the original viral/curated
   * clip — the lip-sync leg re-syncs THAT footage to `adaptedScript`, it never
   * generates a new video by itself. See mayaVideoJobs for the render pipeline.
   */
  mayaAdaptations: defineTable({
    userId: v.string(),
    sourceTemplateId: v.string(),
    sourceVideoUrl: v.string(),
    sourceTitle: v.string(),
    brandId: v.optional(v.string()),
    brandSnapshot: v.object({
      name: v.string(),
      logoUrl: v.optional(v.string()),
      colors: v.optional(
        v.object({
          primary: v.string(),
          secondary: v.optional(v.string()),
          accent: v.optional(v.string()),
        }),
      ),
      // Captured so a later generation run can rebuild the full brand context
      // without re-reading the (possibly since-edited) brand kit. Optional so
      // rows written before these existed still validate.
      industry: v.optional(v.string()),
      audience: v.optional(v.string()),
      productOffering: v.optional(v.string()),
      toneOfVoice: v.optional(v.string()),
      targetCallToAction: v.optional(v.string()),
    }),
    // Enough of the source template to re-derive a MemeTemplate for analysis.
    sourceFormat: v.optional(v.string()),
    sourceThumbnailUrl: v.optional(v.string()),
    hookText: v.string(),
    adaptedScript: v.string(),
    textOverlays: v.array(
      v.object({
        slotId: v.string(),
        text: v.string(),
        placement: v.string(),
        color: v.string(),
        bgColor: v.optional(v.string()),
        startSec: v.optional(v.number()),
        endSec: v.optional(v.number()),
      }),
    ),
    lipSyncScript: v.array(
      v.object({
        speakerId: v.string(),
        startSec: v.number(),
        endSec: v.number(),
        spokenDialogue: v.string(),
        deliveryTone: v.string(),
        facialExpression: v.optional(v.string()),
      }),
    ),
    videoModelPrompts: v.object({
      googleVeoPrompt: v.string(),
      negativePrompt: v.string(),
    }),
    // Optional so rows written before these fields existed still validate on
    // deploy — new writes always populate them (see saveAdaptation).
    // Mute-friendly caption cards — Reels are mostly watched with sound off.
    subtitleCues: v.optional(
      v.array(
        v.object({
          startSec: v.number(),
          endSec: v.number(),
          text: v.string(),
        }),
      ),
    ),
    // Sound-effect timing cues — data only for now, not yet mixed into rendered audio.
    sfxCues: v.optional(
      v.array(
        v.object({
          timestampSec: v.number(),
          sfxName: v.string(),
          volumeMultiplier: v.optional(v.number()),
        }),
      ),
    ),
    instagramCaption: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    adaptationNote: v.optional(v.string()),
    durationSec: v.number(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  /**
   * The generation pipeline for one mayaAdaptations row: TTS -> (lip-sync onto
   * the source clip, OR a synthetic Veo render as fallback) -> Remotion
   * composite (text overlays + brand logo). Mirrors mediaJobs' durable-job
   * shape (start -> record a handle -> scheduled poller resumes from the row)
   * but split out because the multi-stage shape and source-video/audio
   * references genuinely diverge from a single Veo/image job.
   */
  mayaVideoJobs: defineTable({
    userId: v.string(),
    adaptationId: v.id("mayaAdaptations"),
    // "replicate" = reverse-engineer the reel into a sectioned production
    // prompt, generate one fresh clip per beat, stitch them into the full
    // commercial. "dub" = keep the ORIGINAL reel footage and only replace its
    // audio. "lipsync" additionally re-syncs the speaker's mouth via Fal.
    // "veo_synthetic" = one generic generated clip, no beat structure.
    mode: v.union(
      v.literal("replicate"),
      v.literal("dub"),
      v.literal("lipsync"),
      v.literal("veo_synthetic"),
    ),
    stage: v.union(
      v.literal("tts"),
      v.literal("analyze"),
      v.literal("generate"),
      v.literal("compose"),
      v.literal("done"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("rendering"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    ttsAudioStorageId: v.optional(v.id("_storage")),
    ttsAudioUrl: v.optional(v.string()),
    // Fal.ai async queue request id (lipsync mode) or Convex mediaJobs _id
    // (veo_synthetic mode, stored as a string so this table stays provider-agnostic).
    falRequestId: v.optional(v.string()),
    veoMediaJobId: v.optional(v.string()),
    // "replicate" mode: the sectioned production document (shown in the UI so
    // it can be pasted into Omni/Higgsfield manually) and one tracked clip per
    // beat. Optional so rows written before this mode existed still validate.
    fullPrompt: v.optional(v.string()),
    beatClips: v.optional(
      v.array(
        v.object({
          index: v.number(),
          description: v.string(),
          /** mediaJobs _id as a string, so this table stays provider-agnostic. */
          mediaJobId: v.string(),
          url: v.optional(v.string()),
          failed: v.optional(v.boolean()),
          /** Why this beat failed, verbatim from the generator. Shown in the UI. */
          error: v.optional(v.string()),
          /** The prompt actually sent, so a safety-blocked beat can be retried softened. */
          prompt: v.optional(v.string()),
          /** Retries already spent on this beat (safety blocks are stochastic). */
          retries: v.optional(v.number()),
        }),
      ),
    ),
    /**
     * Stills handed to the video model on every beat — the brand asset plus a
     * frame of the source reel — so the product and the render style stay
     * identical across independently-generated shots.
     */
    referenceImageUrls: v.optional(v.array(v.string())),
    generatedVideoStorageId: v.optional(v.id("_storage")),
    generatedVideoUrl: v.optional(v.string()),
    finalVideoStorageId: v.optional(v.id("_storage")),
    finalVideoUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    attempts: v.number(),
    /** v-credits charged for this job (for refunds on failure). */
    billedSeconds: v.optional(v.number()),
    target: v.optional(v.object({ kind: v.literal("post"), id: v.string() })),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  /**
   * Spendable credit balances. Free trial seeds 50 i-credits + 100 v-credits once,
   * spendable for 7 days from trialGrantedAt (then frozen until upgrade).
   *   i-credit → 1 text / image / text+image post (or 1 AI image generation)
   *   v-credit → 1 second of video (Veo / uploaded video posts)
   */
  creditBalances: defineTable({
    userId: v.string(),
    iCredits: v.number(),
    vCredits: v.number(),
    trialGrantedAt: v.optional(v.number()),
    // Calendar-month publishing quota (UTC), reserved when a non-draft post is created.
    usageMonth: v.optional(v.string()),
    postsThisMonth: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  /** Append-only ledger for audits / support. */
  creditLedger: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("i"), v.literal("v")),
    delta: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
    balanceAfter: v.number(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  apiLogs: defineTable({
    endpoint: v.string(),
    method: v.string(),
    userId: v.optional(v.string()),
    statusCode: v.number(),
    duration: v.number(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  warmedAccountListings: defineTable({
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
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_platform", ["platform"]),
});
