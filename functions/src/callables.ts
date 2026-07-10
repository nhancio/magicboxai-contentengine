import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db, requireAuth, stringifyError } from "./core";
import type { AutomationDoc, AutomationScheduleDoc, PostDoc, SocialPlatform } from "./core";
import { computeNextRunAt } from "./schedule-math";
import { generatePostAssets, generateCaptionForPlatform } from "./generation";
import { postBridgeApiKey, isDryRun, pbListAccounts } from "./postbridge";
import { assertPostQuota, getPostQuota, incrementPostUsage } from "./quota";

const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;

const SUPPORTED_PLATFORMS: SocialPlatform[] = ["instagram", "twitter", "linkedin"];

/**
 * Sync the Post Bridge workspace's linked accounts into `socialAccounts`
 * for the calling user. (Account linking itself happens in the Post Bridge
 * dashboard — concierge flow for pilot enterprises.)
 */
export const syncSocialAccounts = onCall(
  { cors: true, secrets: [postBridgeApiKey] },
  async (request: CallableRequest<Record<string, never>>) => {
    const uid = requireAuth(request);
    try {
      const accounts = await pbListAccounts();
      const relevant = accounts.filter((a) =>
        SUPPORTED_PLATFORMS.includes(a.platform as SocialPlatform)
      );

      const batch = db.batch();
      for (const account of relevant) {
        const ref = db.collection("socialAccounts").doc(`${uid}_${account.id}`);
        batch.set(
          ref,
          {
            userId: uid,
            provider: "postbridge",
            pbAccountId: account.id,
            platform: account.platform,
            username: account.username ?? "",
            displayName: account.display_name ?? account.username ?? "",
            avatarUrl: account.profile_picture_url ?? "",
            status: "active",
            linkedAt: FieldValue.serverTimestamp(),
            lastSyncedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      await batch.commit();

      return { synced: relevant.length, dryRun: isDryRun() };
    } catch (error: unknown) {
      throw new HttpsError("internal", stringifyError(error));
    }
  }
);

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
  if (!data.name?.trim()) throw new HttpsError("invalid-argument", "Name is required");
  if (!data.brief?.trim()) throw new HttpsError("invalid-argument", "A content brief is required");
  if (!data.platforms?.length) throw new HttpsError("invalid-argument", "Select at least one platform");
  if (data.platforms.some((p) => !SUPPORTED_PLATFORMS.includes(p))) {
    throw new HttpsError("invalid-argument", "Unsupported platform");
  }
  if (!data.socialAccountIds?.length) {
    throw new HttpsError("invalid-argument", "Select at least one connected account");
  }
  if (!/^\d{2}:\d{2}$/.test(data.schedule?.time ?? "")) {
    throw new HttpsError("invalid-argument", "Schedule time must be HH:mm");
  }
  if (!data.schedule?.timezone) {
    throw new HttpsError("invalid-argument", "Schedule timezone is required");
  }
}

export const createAutomation = onCall(
  { cors: true },
  async (request: CallableRequest<AutomationInput>) => {
    const uid = requireAuth(request);
    const data = request.data;
    validateAutomationInput(data);

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
      await assertPostQuota(uid);
    }

    const automation: Omit<AutomationDoc, "nextRunAt" | "lastRunAt"> & {
      nextRunAt: admin.firestore.Timestamp;
    } = {
      userId: uid,
      ...(data.brandProfileId ? { brandProfileId: data.brandProfileId } : {}),
      name: data.name.trim(),
      status,
      brief: data.brief.trim(),
      platforms: data.platforms,
      socialAccountIds: data.socialAccountIds,
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
  { cors: true },
  async (request: CallableRequest<AutomationInput & { id: string }>) => {
    const uid = requireAuth(request);
    const data = request.data;
    if (!data.id) throw new HttpsError("invalid-argument", "Automation id is required");
    validateAutomationInput(data);

    const ref = db.collection("automations").doc(data.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.userId !== uid) {
      throw new HttpsError("not-found", "Automation not found");
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
      platforms: data.platforms,
      socialAccountIds: data.socialAccountIds,
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

/**
 * Create an immediate post from an automation and generate its content now.
 * The postingTick publishes it within a minute. Primary demo/testing path.
 */
export const runAutomationNow = onCall(
  { cors: true, timeoutSeconds: 300, memory: "1GiB" },
  async (request: CallableRequest<{ automationId: string }>) => {
    const uid = requireAuth(request);
    const { automationId } = request.data;
    if (!automationId) throw new HttpsError("invalid-argument", "automationId is required");

    const snap = await db.collection("automations").doc(automationId).get();
    if (!snap.exists || snap.data()?.userId !== uid) {
      throw new HttpsError("not-found", "Automation not found");
    }
    const automation = snap.data() as AutomationDoc;

    await assertPostQuota(uid);

    const now = new Date();
    const postRef = db.collection("posts").doc();
    const post: PostDoc = {
      userId: uid,
      automationId,
      brandProfileId: automation.brandProfileId,
      source: "automation",
      scheduledFor: Timestamp.fromDate(now),
      timezone: automation.schedule.timezone,
      status: "generating",
      brief: automation.brief,
      contentTypes: automation.contentTypes,
      preset: automation.preset,
      tone: automation.tone,
      platforms: automation.platforms,
      socialAccountIds: automation.socialAccountIds,
      attempts: 0,
      maxAttempts: 3,
    };
    await postRef.set({ ...post, createdAt: FieldValue.serverTimestamp() });
    await incrementPostUsage(uid);

    try {
      const update = await generatePostAssets(postRef.id, post);
      const finalStatus = automation.requiresApproval ? "pending_approval" : "ready";
      await postRef.update({
        ...update,
        status: finalStatus,
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

/** Generate a one-off sample post (caption only) for wizard/onboarding previews. */
export const generatePreviewContent = onCall(
  { cors: true, timeoutSeconds: 120 },
  async (
    request: CallableRequest<{
      brief: string;
      platform: SocialPlatform;
      preset?: string;
      tone?: string;
      brandProfileId?: string;
    }>
  ) => {
    requireAuth(request);
    const { brief, platform, preset, tone, brandProfileId } = request.data;
    if (!brief?.trim()) throw new HttpsError("invalid-argument", "brief is required");
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      throw new HttpsError("invalid-argument", "Unsupported platform");
    }

    let brand = null;
    if (brandProfileId) {
      const snap = await db.collection("brandProfiles").doc(brandProfileId).get();
      brand = snap.exists ? (snap.data() as never) : null;
    }

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
  const ref = db.collection("posts").doc(postId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== uid) {
    throw new HttpsError("not-found", "Post not found");
  }
  return { ref, post: snap.data() as PostDoc };
}

export const approvePost = onCall(
  { cors: true },
  async (request: CallableRequest<{ postId: string }>) => {
    const uid = requireAuth(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (post.status !== "pending_approval") {
      throw new HttpsError("failed-precondition", "Post is not awaiting approval");
    }
    // Approved posts with content go straight to ready; otherwise generate first
    await ref.update({
      status: post.content?.caption ? "ready" : "scheduled",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  }
);

export const retryPost = onCall(
  { cors: true },
  async (request: CallableRequest<{ postId: string }>) => {
    const uid = requireAuth(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (post.status !== "failed") {
      throw new HttpsError("failed-precondition", "Only failed posts can be retried");
    }
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
  { cors: true },
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
  { cors: true, timeoutSeconds: 300, memory: "1GiB" },
  async (request: CallableRequest<{ postId: string }>) => {
    const uid = requireAuth(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (!["ready", "failed", "pending_approval", "scheduled", "draft"].includes(post.status)) {
      throw new HttpsError("failed-precondition", "Post content cannot be regenerated right now");
    }
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
  { cors: true },
  async (request: CallableRequest<Record<string, never>>) => {
    const uid = requireAuth(request);
    return getPostQuota(uid);
  }
);
