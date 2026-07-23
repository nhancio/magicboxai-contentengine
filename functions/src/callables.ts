import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { callableSecurity, db, getBucket, requireAuth, stringifyError } from "./core";
import type {
  AutomationDoc,
  AutomationScheduleDoc,
  BrandProfileDoc,
  PostDoc,
  PostMediaDoc,
  SocialPlatform,
} from "./core";
import { computeNextRunAt } from "./schedule-math";
import { generatePostAssets, generateCaptionForPlatform } from "./generation";
import { brevoApiKey } from "./brevo";
import { assertPostQuota, getPostQuota, notifyUsageLimitReached } from "./quota";
import { trustedStoragePathFromUrl } from "./publishing";
import { activePaidPostEntitlement } from "./entitlements";

const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;

const SUPPORTED_PLATFORMS = ["instagram", "linkedin", "youtube"] as const;
const MAX_POST_ATTEMPTS = 3;

function isSupportedPlatform(value: unknown): value is (typeof SUPPORTED_PLATFORMS)[number] {
  return typeof value === "string" && SUPPORTED_PLATFORMS.includes(value as never);
}

function validateResourceSelection(input: {
  platforms: unknown;
  socialAccountIds: unknown;
}): { platforms: SocialPlatform[]; socialAccountIds: string[] } {
  if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
    throw new HttpsError("invalid-argument", "Select at least one platform");
  }
  if (
    input.platforms.length > SUPPORTED_PLATFORMS.length ||
    input.platforms.some((platform) => !isSupportedPlatform(platform)) ||
    new Set(input.platforms).size !== input.platforms.length
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Platforms must be unique Instagram, LinkedIn, or YouTube values"
    );
  }
  if (!Array.isArray(input.socialAccountIds) || input.socialAccountIds.length === 0) {
    throw new HttpsError("invalid-argument", "Select at least one connected account");
  }
  if (
    input.socialAccountIds.length > 20 ||
    input.socialAccountIds.some(
      (id) => typeof id !== "string" || id.length === 0 || id.length > 300 || id.includes("/")
    ) ||
    new Set(input.socialAccountIds).size !== input.socialAccountIds.length
  ) {
    throw new HttpsError("invalid-argument", "Connected account ids must be unique and valid");
  }
  return {
    platforms: [...input.platforms] as SocialPlatform[],
    socialAccountIds: [...input.socialAccountIds] as string[],
  };
}

async function getOwnedBrandProfile(
  uid: string,
  brandProfileId?: string
): Promise<BrandProfileDoc | null> {
  if (!brandProfileId) return null;
  if (
    typeof brandProfileId !== "string" ||
    brandProfileId.length > 300 ||
    brandProfileId.includes("/")
  ) {
    throw new HttpsError("invalid-argument", "Brand profile id is invalid");
  }
  const snap = await db.collection("brandProfiles").doc(brandProfileId).get();
  if (!snap.exists || snap.data()?.userId !== uid) {
    throw new HttpsError("permission-denied", "Brand profile is unavailable");
  }
  return snap.data() as BrandProfileDoc;
}

/**
 * Tenant boundary shared by callables and the scheduler. Account ownership,
 * active state, provider/platform consistency, and brand ownership are all
 * checked server-side; caller-supplied ids are never trusted by themselves.
 */
export async function assertOwnedPublishingResources(
  uid: string,
  input: {
    brandProfileId?: string;
    platforms: unknown;
    socialAccountIds: unknown;
  }
): Promise<{ platforms: SocialPlatform[]; socialAccountIds: string[]; brand: BrandProfileDoc | null }> {
  const selection = validateResourceSelection(input);
  const [brand, accountSnaps] = await Promise.all([
    getOwnedBrandProfile(uid, input.brandProfileId),
    Promise.all(
      selection.socialAccountIds.map((id) => db.collection("socialAccounts").doc(id).get())
    ),
  ]);

  const accountPlatforms = new Set<SocialPlatform>();
  for (const snap of accountSnaps) {
    const account = snap.data() as
      | {
          userId?: unknown;
          status?: unknown;
          provider?: unknown;
          platform?: unknown;
        }
      | undefined;
    if (
      !snap.exists ||
      account?.userId !== uid ||
      account.status !== "active" ||
      !isSupportedPlatform(account.platform) ||
      account.provider !== account.platform
    ) {
      throw new HttpsError(
        "permission-denied",
        "One or more connected accounts is unavailable"
      );
    }
    accountPlatforms.add(account.platform);
  }

  const selectedPlatforms = new Set(selection.platforms);
  if (
    [...accountPlatforms].some((platform) => !selectedPlatforms.has(platform)) ||
    selection.platforms.some((platform) => !accountPlatforms.has(platform))
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Selected platforms must exactly match the connected accounts"
    );
  }

  return { ...selection, brand };
}

type AutomationInput = {
  id?: string;
  name: string;
  brief: string;
  brandProfileId?: string;
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  contentTypes: { text: boolean; image: boolean; video: boolean };
  preset: string;
  tone: string;
  schedule: {
    type: "recurring" | "once";
    time: string;
    daysOfWeek?: number[];
    timezone: string;
  };
  requiresApproval?: boolean;
  status?: "active" | "paused" | "draft";
};

function validateAutomationInput(data: AutomationInput): void {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Automation data is required");
  }
  if (!data.name?.trim() || data.name.trim().length > 120) {
    throw new HttpsError("invalid-argument", "Name is required and must be at most 120 characters");
  }
  if (!data.brief?.trim() || data.brief.trim().length > 4_000) {
    throw new HttpsError(
      "invalid-argument",
      "A content brief is required and must be at most 4,000 characters"
    );
  }
  if (
    data.status !== undefined &&
    data.status !== "active" &&
    data.status !== "paused" &&
    data.status !== "draft"
  ) {
    throw new HttpsError("invalid-argument", "Automation status is invalid");
  }
  if (
    typeof data.preset !== "string" ||
    data.preset.length > 100 ||
    typeof data.tone !== "string" ||
    data.tone.length > 500
  ) {
    throw new HttpsError("invalid-argument", "Automation preset or tone is invalid");
  }
  validateResourceSelection(data);
  const timeMatch = data.schedule?.time?.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) {
    throw new HttpsError("invalid-argument", "Schedule time must be HH:mm");
  }
  if (data.schedule.type !== "recurring" && data.schedule.type !== "once") {
    throw new HttpsError("invalid-argument", "Schedule type is invalid");
  }
  if (
    data.schedule.daysOfWeek &&
    (!Array.isArray(data.schedule.daysOfWeek) ||
      new Set(data.schedule.daysOfWeek).size !== data.schedule.daysOfWeek.length ||
      data.schedule.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
  ) {
    throw new HttpsError("invalid-argument", "Schedule days must be unique values from 0 to 6");
  }
  if (!data.schedule?.timezone || data.schedule.timezone.length > 100) {
    throw new HttpsError("invalid-argument", "Schedule timezone is required");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: data.schedule.timezone }).format();
  } catch {
    throw new HttpsError("invalid-argument", "Schedule timezone must be a valid IANA timezone");
  }
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function assertActiveAutomationAccess(uid: string): Promise<void> {
  const snap = await db.collection("subscriptions").doc(uid).get();
  if (!snap.exists || activePaidPostEntitlement(snap.data()) === null) {
    throw new HttpsError(
      "permission-denied",
      "An active, unexpired paid subscription is required"
    );
  }
  await assertPostQuota(uid);
}

function isSameReservedPost(existing: unknown, uid: string, post: PostDoc): boolean {
  const data = existing as Partial<PostDoc> | undefined;
  return (
    data?.userId === uid &&
    data.source === post.source &&
    (post.idempotencyKey === undefined || data.idempotencyKey === post.idempotencyKey)
  );
}

/**
 * Atomically create a post and reserve one monthly quota unit. Returning false
 * means this exact idempotent post already exists and was previously reserved.
 */
export async function createPostWithQuotaReservation(
  uid: string,
  ref: admin.firestore.DocumentReference,
  post: PostDoc
): Promise<boolean> {
  // Avoid blocking recovery after a scheduler crash that created the post but
  // did not yet advance the automation. The transaction repeats this check to
  // close the race with another tick.
  const existing = await ref.get();
  if (existing.exists) {
    if (!isSameReservedPost(existing.data(), uid, post)) {
      throw new HttpsError("already-exists", "Post reservation id is already in use");
    }
    return false;
  }

  const month = currentMonthKey();
  try {
    return await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const subscriptionRef = db.collection("subscriptions").doc(uid);
      const [postSnap, subscriptionSnap, userSnap] = await Promise.all([
        tx.get(ref),
        tx.get(subscriptionRef),
        tx.get(userRef),
      ]);

      if (postSnap.exists) {
        if (!isSameReservedPost(postSnap.data(), uid, post)) {
          throw new HttpsError("already-exists", "Post reservation id is already in use");
        }
        return false;
      }

      const entitlement = activePaidPostEntitlement(subscriptionSnap.data());
      if (!entitlement) {
        throw new HttpsError(
          "permission-denied",
          "An active, unexpired paid subscription is required"
        );
      }

      const usage = userSnap.data()?.usage as
        | { month?: unknown; postsThisMonth?: unknown }
        | undefined;
      const rawUsed = usage?.month === month ? usage.postsThisMonth : 0;
      if (
        rawUsed !== undefined &&
        (typeof rawUsed !== "number" || !Number.isFinite(rawUsed) || rawUsed < 0)
      ) {
        throw new HttpsError("failed-precondition", "Monthly usage record is invalid");
      }
      const used = rawUsed === undefined ? 0 : Math.floor(rawUsed);
      if (used >= entitlement.limit) {
        throw new HttpsError("resource-exhausted", "Monthly post limit reached");
      }

      tx.create(ref, { ...post, createdAt: FieldValue.serverTimestamp() });
      tx.set(
        userRef,
        {
          usage: {
            month,
            postsThisMonth: used + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      return true;
    });
  } catch (error: unknown) {
    if ((error as { code?: unknown })?.code === "resource-exhausted") {
      await notifyUsageLimitReached(uid);
    }
    throw error;
  }
}

type ManualPostInput = {
  scheduledFor: string;
  timezone: string;
  brief: string;
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  brandProfileId?: string;
  content?: {
    caption?: unknown;
    hashtags?: unknown;
    perPlatform?: unknown;
  };
  media?: Array<{
    type?: unknown;
    storagePath?: unknown;
    url?: unknown;
    source?: unknown;
  }>;
};

function normalizeManualContent(
  value: ManualPostInput["content"],
  platforms: SocialPlatform[]
): NonNullable<PostDoc["content"]> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    throw new HttpsError("invalid-argument", "Post content is invalid");
  }
  if (typeof value.caption !== "string" || !value.caption.trim() || value.caption.length > 10_000) {
    throw new HttpsError(
      "invalid-argument",
      "A non-empty caption of at most 10,000 characters is required"
    );
  }
  if (
    value.hashtags !== undefined &&
    (!Array.isArray(value.hashtags) ||
      value.hashtags.length > 30 ||
      value.hashtags.some(
        (tag) => typeof tag !== "string" || tag.length === 0 || tag.length > 100
      ))
  ) {
    throw new HttpsError("invalid-argument", "Hashtags are invalid");
  }

  const perPlatform: Partial<Record<SocialPlatform, { caption: string }>> = {};
  if (value.perPlatform !== undefined) {
    if (!value.perPlatform || typeof value.perPlatform !== "object" || Array.isArray(value.perPlatform)) {
      throw new HttpsError("invalid-argument", "Per-platform content is invalid");
    }
    const selected = new Set(platforms);
    for (const [platform, entry] of Object.entries(value.perPlatform)) {
      const caption = (entry as { caption?: unknown } | null)?.caption;
      if (
        !isSupportedPlatform(platform) ||
        !selected.has(platform) ||
        typeof caption !== "string" ||
        !caption.trim() ||
        caption.length > 10_000
      ) {
        throw new HttpsError("invalid-argument", "Per-platform content is invalid");
      }
      perPlatform[platform] = { caption: caption.trim() };
    }
  }

  return {
    caption: value.caption.trim(),
    hashtags: Array.isArray(value.hashtags) ? [...value.hashtags] : [],
    ...(Object.keys(perPlatform).length ? { perPlatform } : {}),
  };
}

async function normalizeManualMedia(
  uid: string,
  value: ManualPostInput["media"]
): Promise<PostMediaDoc[]> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) {
    throw new HttpsError("invalid-argument", "At most 10 media items are allowed");
  }

  return Promise.all(
    value.map(async (item): Promise<PostMediaDoc> => {
      if (item?.type !== "image" && item?.type !== "video") {
        throw new HttpsError("invalid-argument", "Media type must be image or video");
      }
      if (typeof item.url !== "string") {
        throw new HttpsError("invalid-argument", "Media URL is required");
      }
      const storagePath = trustedStoragePathFromUrl(item.url);
      if (
        !storagePath ||
        !storagePath.startsWith(`users/${uid}/`) ||
        (item.storagePath !== undefined && item.storagePath !== storagePath)
      ) {
        throw new HttpsError(
          "permission-denied",
          "Media must be an upload owned by the signed-in user"
        );
      }

      let metadata: { contentType?: string; size?: string | number };
      try {
        [metadata] = await getBucket().file(storagePath).getMetadata();
      } catch {
        throw new HttpsError("invalid-argument", "Media object does not exist");
      }
      const expectedPrefix = item.type === "image" ? "image/" : "video/";
      if (!metadata.contentType?.startsWith(expectedPrefix)) {
        throw new HttpsError("invalid-argument", "Media type does not match the stored object");
      }
      const size = Number(metadata.size ?? 0);
      const maxSize = item.type === "image" ? 10 * 1024 * 1024 : 250 * 1024 * 1024;
      if (!Number.isFinite(size) || size <= 0 || size > maxSize) {
        throw new HttpsError("invalid-argument", "Media object size is not allowed");
      }

      return {
        type: item.type,
        storagePath,
        url: new URL(item.url).toString(),
        // The caller cannot claim server-only generation provenance.
        source: "upload",
      };
    })
  );
}

function parseManualSchedule(value: unknown): Date {
  if (typeof value !== "string" || value.length > 100) {
    throw new HttpsError("invalid-argument", "scheduledFor must be an ISO timestamp");
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new HttpsError("invalid-argument", "scheduledFor must be an ISO timestamp");
  }
  const now = Date.now();
  if (date.getTime() < now - 5 * 60_000 || date.getTime() > now + 366 * 24 * 60 * 60_000) {
    throw new HttpsError(
      "invalid-argument",
      "scheduledFor must be between now and one year from now"
    );
  }
  return date;
}

export const createAutomation = onCall(
  { ...callableSecurity, secrets: [brevoApiKey] },
  async (request: CallableRequest<AutomationInput>) => {
    const uid = requireAuth(request);
    const data = request.data;
    validateAutomationInput(data);
    const resources = await assertOwnedPublishingResources(uid, data);

    const schedule: AutomationScheduleDoc = {
      type: data.schedule.type ?? "recurring",
      time: data.schedule.time,
      ...(data.schedule.daysOfWeek?.length ? { daysOfWeek: data.schedule.daysOfWeek } : {}),
      timezone: data.schedule.timezone,
    };

    let nextRunAt: Date | null;
    try {
      nextRunAt = computeNextRunAt(schedule);
    } catch (error: unknown) {
      throw new HttpsError("invalid-argument", stringifyError(error));
    }
    if (!nextRunAt) {
      throw new HttpsError("invalid-argument", "Schedule never fires");
    }

    const status = data.status ?? "active";
    if (status === "active") {
      await assertActiveAutomationAccess(uid);
    }

    const automation: Omit<AutomationDoc, "nextRunAt" | "lastRunAt"> & {
      nextRunAt: admin.firestore.Timestamp;
    } = {
      userId: uid,
      ...(data.brandProfileId ? { brandProfileId: data.brandProfileId } : {}),
      name: data.name.trim(),
      status,
      brief: data.brief.trim(),
      platforms: resources.platforms,
      socialAccountIds: resources.socialAccountIds,
      contentTypes: {
        text: true,
        image: !!data.contentTypes?.image,
        video: !!data.contentTypes?.video,
      },
      preset: data.preset || "custom",
      tone: data.tone || "",
      schedule,
      nextRunAt: Timestamp.fromDate(nextRunAt),
      runCount: 0,
      failureCount: 0,
      generateLeadMinutes: data.contentTypes?.video ? 120 : 30,
      requiresApproval: !!data.requiresApproval,
    };

    const ref = await db.collection("automations").add({
      ...automation,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { id: ref.id, nextRunAt: nextRunAt.toISOString() };
  }
);

export const updateAutomation = onCall(
  { ...callableSecurity, secrets: [brevoApiKey] },
  async (request: CallableRequest<AutomationInput & { id: string }>) => {
    const uid = requireAuth(request);
    const data = request.data;
    if (!data.id || data.id.includes("/")) {
      throw new HttpsError("invalid-argument", "Automation id is required");
    }
    validateAutomationInput(data);

    const ref = db.collection("automations").doc(data.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.userId !== uid) {
      throw new HttpsError("not-found", "Automation not found");
    }
    const resources = await assertOwnedPublishingResources(uid, data);
    const resultingStatus = data.status ?? (snap.data()?.status as AutomationDoc["status"]);
    if (resultingStatus === "active") {
      await assertActiveAutomationAccess(uid);
    }

    const schedule: AutomationScheduleDoc = {
      type: data.schedule.type ?? "recurring",
      time: data.schedule.time,
      ...(data.schedule.daysOfWeek?.length ? { daysOfWeek: data.schedule.daysOfWeek } : {}),
      timezone: data.schedule.timezone,
    };
    const nextRunAt = computeNextRunAt(schedule);
    if (!nextRunAt) throw new HttpsError("invalid-argument", "Schedule never fires");

    await ref.update({
      name: data.name.trim(),
      brief: data.brief.trim(),
      brandProfileId: data.brandProfileId ?? FieldValue.delete(),
      platforms: resources.platforms,
      socialAccountIds: resources.socialAccountIds,
      contentTypes: {
        text: true,
        image: !!data.contentTypes?.image,
        video: !!data.contentTypes?.video,
      },
      preset: data.preset || "custom",
      tone: data.tone || "",
      schedule,
      nextRunAt: Timestamp.fromDate(nextRunAt),
      generateLeadMinutes: data.contentTypes?.video ? 120 : 30,
      requiresApproval: !!data.requiresApproval,
      ...(data.status ? { status: data.status } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { id: data.id, nextRunAt: nextRunAt.toISOString() };
  }
);

/** Pause or safely resume an automation without exposing lifecycle writes. */
export const setAutomationStatus = onCall(
  { ...callableSecurity, secrets: [brevoApiKey] },
  async (request: CallableRequest<{ id: string; status: "active" | "paused" }>) => {
    const uid = requireAuth(request);
    const { id, status } = request.data ?? {};
    if (!id || id.includes("/") || (status !== "active" && status !== "paused")) {
      throw new HttpsError("invalid-argument", "Automation id and status are required");
    }

    const ref = db.collection("automations").doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.userId !== uid) {
      throw new HttpsError("not-found", "Automation not found");
    }
    if (status === "active") {
      const automation = snap.data() as AutomationDoc;
      await assertOwnedPublishingResources(uid, automation);
      await assertActiveAutomationAccess(uid);
    }

    await ref.update({
      status,
      ...(status === "active"
        ? { failureCount: 0, lastError: FieldValue.delete() }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  }
);

/**
 * Create an immediate post from an automation and generate its content now.
 * The postingTick publishes it within a minute. Primary demo/testing path.
 */
export const runAutomationNow = onCall(
  { ...callableSecurity, timeoutSeconds: 300, memory: "1GiB", secrets: [brevoApiKey] },
  async (request: CallableRequest<{ automationId: string }>) => {
    const uid = requireAuth(request);
    const { automationId } = request.data;
    if (!automationId || automationId.includes("/")) {
      throw new HttpsError("invalid-argument", "automationId is required");
    }

    const snap = await db.collection("automations").doc(automationId).get();
    if (!snap.exists || snap.data()?.userId !== uid) {
      throw new HttpsError("not-found", "Automation not found");
    }
    const automation = snap.data() as AutomationDoc;
    const resources = await assertOwnedPublishingResources(uid, automation);

    const now = new Date();
    const postRef = db.collection("posts").doc();
    const post: PostDoc = {
      userId: uid,
      automationId,
      ...(automation.brandProfileId ? { brandProfileId: automation.brandProfileId } : {}),
      source: "automation",
      scheduledFor: Timestamp.fromDate(now),
      timezone: automation.schedule.timezone,
      status: "generating",
      brief: automation.brief,
      contentTypes: automation.contentTypes,
      preset: automation.preset,
      tone: automation.tone,
      platforms: resources.platforms,
      socialAccountIds: resources.socialAccountIds,
      attempts: 1,
      maxAttempts: MAX_POST_ATTEMPTS,
    };
    await createPostWithQuotaReservation(uid, postRef, post);

    try {
      const update = await generatePostAssets(postRef.id, post);
      const finalStatus = automation.requiresApproval ? "pending_approval" : "ready";
      await postRef.update({
        ...update,
        status: finalStatus,
        attempts: 0,
        error: FieldValue.delete(),
        nextAttemptAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { postId: postRef.id, status: finalStatus };
    } catch (error: unknown) {
      await postRef.update({
        status: "failed",
        error: stringifyError(error),
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError("internal", stringifyError(error));
    }
  }
);

/** Create a quota-reserved manual post without granting the client pipeline writes. */
export const createManualPost = onCall(
  { ...callableSecurity, secrets: [brevoApiKey] },
  async (request: CallableRequest<ManualPostInput>) => {
    const uid = requireAuth(request);
    const data = request.data;
    if (!data || typeof data !== "object") {
      throw new HttpsError("invalid-argument", "Post data is required");
    }
    if (!data.brief?.trim() || data.brief.trim().length > 4_000) {
      throw new HttpsError(
        "invalid-argument",
        "A brief is required and must be at most 4,000 characters"
      );
    }
    if (!data.timezone || data.timezone.length > 100) {
      throw new HttpsError("invalid-argument", "A valid timezone is required");
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: data.timezone }).format();
    } catch {
      throw new HttpsError("invalid-argument", "A valid IANA timezone is required");
    }

    const scheduledFor = parseManualSchedule(data.scheduledFor);
    const resources = await assertOwnedPublishingResources(uid, data);
    const content = normalizeManualContent(data.content, resources.platforms);
    const media = await normalizeManualMedia(uid, data.media);

    if (resources.platforms.includes("instagram") && media.length === 0) {
      throw new HttpsError("invalid-argument", "Instagram posts require an image or video");
    }
    if (
      resources.platforms.includes("youtube") &&
      !media.some((item) => item.type === "video")
    ) {
      throw new HttpsError("invalid-argument", "YouTube posts require a video");
    }

    const postRef = db.collection("posts").doc();
    const status: PostDoc["status"] = content ? "ready" : "scheduled";
    const post: PostDoc = {
      userId: uid,
      ...(data.brandProfileId ? { brandProfileId: data.brandProfileId } : {}),
      source: "manual",
      scheduledFor: Timestamp.fromDate(scheduledFor),
      timezone: data.timezone,
      status,
      brief: data.brief.trim(),
      ...(content ? { content } : {}),
      ...(media.length ? { media } : {}),
      contentTypes: { text: true, image: false, video: false },
      platforms: resources.platforms,
      socialAccountIds: resources.socialAccountIds,
      attempts: 0,
      maxAttempts: MAX_POST_ATTEMPTS,
    };
    await createPostWithQuotaReservation(uid, postRef, post);
    return { id: postRef.id, status };
  }
);

/** Generate a one-off sample post (caption only) for wizard/onboarding previews. */
export const generatePreviewContent = onCall(
  { ...callableSecurity, timeoutSeconds: 120 },
  async (
    request: CallableRequest<{
      brief: string;
      platform: SocialPlatform;
      preset?: string;
      tone?: string;
      brandProfileId?: string;
    }>
  ) => {
    const uid = requireAuth(request);
    const { brief, platform, preset, tone, brandProfileId } = request.data;
    if (!brief?.trim() || brief.trim().length > 4_000) {
      throw new HttpsError("invalid-argument", "brief is required and must be at most 4,000 characters");
    }
    if (!isSupportedPlatform(platform)) {
      throw new HttpsError("invalid-argument", "Unsupported platform");
    }

    const brand = await getOwnedBrandProfile(uid, brandProfileId);

    try {
      const result = await generateCaptionForPlatform({
        brand,
        brief,
        preset: preset || "custom",
        tone: tone || "",
        platform,
      });
      return result;
    } catch (error: unknown) {
      throw new HttpsError("internal", stringifyError(error));
    }
  }
);

async function getOwnedPost(uid: string, postId: string) {
  if (!postId || typeof postId !== "string" || postId.includes("/")) {
    throw new HttpsError("invalid-argument", "Post id is required");
  }
  const ref = db.collection("posts").doc(postId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== uid) {
    throw new HttpsError("not-found", "Post not found");
  }
  return { ref, post: snap.data() as PostDoc };
}

export const approvePost = onCall(
  { ...callableSecurity },
  async (request: CallableRequest<{ postId: string }>) => {
    const uid = requireAuth(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (post.status !== "pending_approval") {
      throw new HttpsError("failed-precondition", "Post is not awaiting approval");
    }
    await assertOwnedPublishingResources(uid, post);
    // Approved posts with content go straight to ready; otherwise generate first
    await ref.update({
      status: post.content?.caption ? "ready" : "scheduled",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  }
);

export const retryPost = onCall(
  { ...callableSecurity },
  async (request: CallableRequest<{ postId: string }>) => {
    const uid = requireAuth(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (post.status !== "failed") {
      throw new HttpsError("failed-precondition", "Only failed posts can be retried");
    }
    await assertOwnedPublishingResources(uid, post);
    await ref.update({
      status: post.content?.caption ? "ready" : "scheduled",
      attempts: 0,
      error: FieldValue.delete(),
      nextAttemptAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  }
);

export const cancelPost = onCall(
  { ...callableSecurity },
  async (request: CallableRequest<{ postId: string }>) => {
    const uid = requireAuth(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (["posted", "posting"].includes(post.status)) {
      throw new HttpsError("failed-precondition", "Post is already publishing or published");
    }
    await ref.update({ status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
  }
);

export const regeneratePostContent = onCall(
  { ...callableSecurity, timeoutSeconds: 300, memory: "1GiB" },
  async (request: CallableRequest<{ postId: string }>) => {
    const uid = requireAuth(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (!["ready", "failed", "pending_approval", "scheduled", "draft"].includes(post.status)) {
      throw new HttpsError("failed-precondition", "Post content cannot be regenerated right now");
    }
    await assertOwnedPublishingResources(uid, post);
    try {
      const update = await generatePostAssets(request.data.postId, post);
      await ref.update({
        ...update,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { success: true, content: update.content };
    } catch (error: unknown) {
      throw new HttpsError("internal", stringifyError(error));
    }
  }
);

export const getQuota = onCall(
  { ...callableSecurity },
  async (request: CallableRequest<Record<string, never>>) => {
    const uid = requireAuth(request);
    return getPostQuota(uid);
  }
);
