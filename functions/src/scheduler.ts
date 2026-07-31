// The automation engine: three scheduled ticks moving posts through
// scheduled -> generating -> ready -> posting -> posted/failed.

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { db, stringifyError } from "./core";
import type { AutomationDoc, PostDoc } from "./core";
import { computeNextRunAt } from "./schedule-math";
import { generatePostAssets } from "./generation";
import { publishPost } from "./publishing";
import { brevoApiKey } from "./brevo";
import { googleOAuthClientId, googleOAuthClientSecret } from "./social";
import {
  assertOwnedPublishingResources,
  createPostWithQuotaReservation,
} from "./callables";

const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;

const RETRY_DELAYS_MINUTES = [2, 10];
const MAX_CONSECUTIVE_AUTOMATION_FAILURES = 3;
const MAX_POST_ATTEMPTS = 3;

function minutesFromNow(minutes: number): admin.firestore.Timestamp {
  return Timestamp.fromMillis(Date.now() + minutes * 60_000);
}

function boundedAttempts(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_POST_ATTEMPTS, Math.floor(value)))
    : 0;
}

/** Atomically claim one bounded attempt and return the fresh post snapshot. */
async function claimPostAttempt(
  ref: admin.firestore.DocumentReference,
  expectedStatus: "scheduled" | "ready",
  claimedStatus: "generating" | "posting"
): Promise<PostDoc | null> {
  const result = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists || fresh.data()?.status !== expectedStatus) return null;
    const post = fresh.data() as PostDoc;
    if (post.nextAttemptAt && post.nextAttemptAt.toMillis() > Date.now()) return null;

    const attempts = boundedAttempts(post.attempts);
    if (attempts >= MAX_POST_ATTEMPTS) {
      tx.update(ref, {
        status: "failed",
        attempts: MAX_POST_ATTEMPTS,
        maxAttempts: MAX_POST_ATTEMPTS,
        error: `Post exceeded the ${MAX_POST_ATTEMPTS}-attempt retry limit`,
        nextAttemptAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { exhausted: true as const, post: { ...post, attempts: MAX_POST_ATTEMPTS } };
    }

    const claimedPost: PostDoc = {
      ...post,
      attempts: attempts + 1,
      maxAttempts: MAX_POST_ATTEMPTS,
      status: claimedStatus,
    };
    tx.update(ref, {
      status: claimedStatus,
      attempts: claimedPost.attempts,
      maxAttempts: MAX_POST_ATTEMPTS,
      nextAttemptAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { exhausted: false as const, post: claimedPost };
  });

  if (!result) return null;
  if (result.exhausted) {
    await handlePostFailure(
      ref,
      result.post,
      `Post exceeded the ${MAX_POST_ATTEMPTS}-attempt retry limit`,
      expectedStatus
    );
    return null;
  }
  return result.post;
}

/**
 * Create post docs for automations whose next slot is inside the generation
 * lead window, and advance their nextRunAt.
 */
export const automationTick = onSchedule(
  { schedule: "every 5 minutes", timeoutSeconds: 300, memory: "512MiB", secrets: [brevoApiKey] },
  async () => {
    // Look ahead by the largest lead window (video = 120 min)
    const horizon = minutesFromNow(120);
    const snap = await db
      .collection("automations")
      .where("status", "==", "active")
      .where("nextRunAt", "<=", horizon)
      .limit(50)
      .get();

    for (const docSnap of snap.docs) {
      const automation = docSnap.data() as AutomationDoc;
      const lead = automation.generateLeadMinutes ?? 30;
      const slot = automation.nextRunAt.toDate();

      // Only act once the slot is within this automation's own lead window.
      if (slot.getTime() - Date.now() > lead * 60_000) continue;

      try {
        // Revalidate legacy/stored automations before copying tenant-scoped
        // brand and account ids into a post.
        const resources = await assertOwnedPublishingResources(automation.userId, automation);
        const slotISO = slot.toISOString().replace(/[:.]/g, "-");
        const idempotencyKey = `${docSnap.id}_${slotISO}`;
        const postRef = db.collection("posts").doc(idempotencyKey);

        const post: PostDoc = {
          userId: automation.userId,
          automationId: docSnap.id,
          ...(automation.brandProfileId ? { brandProfileId: automation.brandProfileId } : {}),
          source: "automation",
          scheduledFor: Timestamp.fromDate(slot),
          timezone: automation.schedule.timezone,
          status: automation.requiresApproval ? "pending_approval" : "scheduled",
          brief: automation.brief,
          contentTypes: automation.contentTypes,
          preset: automation.preset,
          tone: automation.tone,
          platforms: resources.platforms,
          socialAccountIds: resources.socialAccountIds,
          attempts: 0,
          maxAttempts: MAX_POST_ATTEMPTS,
          idempotencyKey,
        };

        try {
          await createPostWithQuotaReservation(automation.userId, postRef, post);
        } catch (reservationError: unknown) {
          const code = (reservationError as { code?: unknown })?.code;
          if (code === "permission-denied" || code === "resource-exhausted") {
            await docSnap.ref.update({
              status: "paused",
              lastError: stringifyError(reservationError),
              updatedAt: FieldValue.serverTimestamp(),
            });
            continue;
          }
          throw reservationError;
        }

        const next =
          automation.schedule.type === "once"
            ? null
            : computeNextRunAt(automation.schedule, slot);

        await docSnap.ref.update({
          lastRunAt: Timestamp.fromDate(slot),
          runCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
          ...(next
            ? { nextRunAt: Timestamp.fromDate(next) }
            : { status: "paused" }),
        });
      } catch (error: unknown) {
        console.error(`[automationTick] ${docSnap.id} failed:`, stringifyError(error));
        await docSnap.ref.update({
          lastError: stringifyError(error),
          failureCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  }
);

/** Generate content for scheduled posts entering their lead window. */
export const generationTick = onSchedule(
  { schedule: "every 5 minutes", timeoutSeconds: 540, memory: "1GiB" },
  async () => {
    const horizon = minutesFromNow(120);
    const snap = await db
      .collection("posts")
      .where("status", "==", "scheduled")
      .where("scheduledFor", "<=", horizon)
      .limit(10)
      .get();

    for (const docSnap of snap.docs) {
      const post = docSnap.data() as PostDoc;

      // Honor retry backoff
      if (post.nextAttemptAt && post.nextAttemptAt.toMillis() > Date.now()) continue;

      // Skip manual posts that already carry content
      if (post.content?.caption) {
        await docSnap.ref.update({
          status: "ready",
          attempts: 0,
          maxAttempts: MAX_POST_ATTEMPTS,
          error: FieldValue.delete(),
          nextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        continue;
      }

      const claimedPost = await claimPostAttempt(docSnap.ref, "scheduled", "generating");
      if (!claimedPost) continue;

      try {
        await assertOwnedPublishingResources(claimedPost.userId, claimedPost);
        const update = await generatePostAssets(docSnap.id, claimedPost);
        // Publishing begins with its own bounded three-attempt budget.
        await docSnap.ref.update({
          ...update,
          status: "ready",
          attempts: 0,
          maxAttempts: MAX_POST_ATTEMPTS,
          error: FieldValue.delete(),
          nextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (error: unknown) {
        console.error(`[generationTick] ${docSnap.id} failed:`, stringifyError(error));
        await handlePostFailure(docSnap.ref, claimedPost, stringifyError(error), "scheduled");
      }
    }
  }
);

/** Publish ready posts that are due, straight to Instagram / LinkedIn / YouTube. */
export const postingTick = onSchedule(
  {
    schedule: "every 1 minutes",
    timeoutSeconds: 540,
    // YouTube uploads buffer the whole video in memory
    memory: "1GiB",
    secrets: [googleOAuthClientId, googleOAuthClientSecret],
  },
  async () => {
    const now = Timestamp.now();

    const readySnap = await db
      .collection("posts")
      .where("status", "==", "ready")
      .where("scheduledFor", "<=", now)
      .limit(10)
      .get();

    for (const docSnap of readySnap.docs) {
      const post = docSnap.data() as PostDoc;

      // Honor retry backoff
      if (post.nextAttemptAt && post.nextAttemptAt.toMillis() > Date.now()) continue;

      const claimedPost = await claimPostAttempt(docSnap.ref, "ready", "posting");
      if (!claimedPost) continue;

      try {
        const results = await publishPost({ ...claimedPost, id: docSnap.id });
        const anyPosted = results.some((r) => r.status === "posted");

        if (!anyPosted) {
          const reason =
            results.map((r) => r.error).filter(Boolean).join("; ") ||
            "Publishing failed on all connected accounts";
          await handlePostFailure(docSnap.ref, claimedPost, reason, "ready");
          continue;
        }

        await docSnap.ref.update({
          status: "posted",
          results,
          error: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (claimedPost.automationId) {
          await db
            .collection("automations")
            .doc(claimedPost.automationId)
            .update({ failureCount: 0 })
            .catch(() => {});
        }
      } catch (error: unknown) {
        console.error(`[postingTick] publish ${docSnap.id} failed:`, stringifyError(error));
        await handlePostFailure(docSnap.ref, claimedPost, stringifyError(error), "ready");
      }
    }
  }
);

/** Shared retry/backoff + terminal-failure handling. */
async function handlePostFailure(
  ref: admin.firestore.DocumentReference,
  post: PostDoc,
  message: string,
  retryStatus: "scheduled" | "ready"
): Promise<void> {
  // The transaction claim already persisted this attempt. Never increment a
  // second time here, and never trust a legacy document to raise the cap.
  const attempts = Math.max(1, boundedAttempts(post.attempts));
  const maxAttempts = MAX_POST_ATTEMPTS;

  if (attempts < maxAttempts) {
    const delay = RETRY_DELAYS_MINUTES[Math.min(attempts - 1, RETRY_DELAYS_MINUTES.length - 1)];
    await ref.update({
      status: retryStatus,
      attempts,
      maxAttempts,
      error: message,
      nextAttemptAt: minutesFromNow(delay),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  await ref.update({
    status: "failed",
    attempts,
    maxAttempts,
    error: message,
    nextAttemptAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (post.automationId) {
    const automationRef = db.collection("automations").doc(post.automationId);
    const snap = await automationRef.get();
    const failureCount = ((snap.data()?.failureCount as number) ?? 0) + 1;
    await automationRef.update({
      failureCount,
      lastError: message,
      ...(failureCount >= MAX_CONSECUTIVE_AUTOMATION_FAILURES
        ? { status: "error" }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
