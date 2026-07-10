// The automation engine: three scheduled ticks moving posts through
// scheduled -> generating -> ready -> posting -> posted/failed.

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { db, stringifyError } from "./core";
import type { AutomationDoc, PostDoc } from "./core";
import { computeNextRunAt } from "./schedule-math";
import { generatePostAssets } from "./generation";
import {
  postBridgeApiKey,
  isDryRun,
  pbCreatePost,
  pbGetPost,
  pbUploadMediaFromBuffer,
} from "./postbridge";
import { getPostQuota, incrementPostUsage } from "./quota";
import { getBucket } from "./core";

const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;

const RETRY_DELAYS_MINUTES = [2, 10, 30];
const MAX_CONSECUTIVE_AUTOMATION_FAILURES = 3;

function minutesFromNow(minutes: number): admin.firestore.Timestamp {
  return Timestamp.fromMillis(Date.now() + minutes * 60_000);
}

/**
 * Create post docs for automations whose next slot is inside the generation
 * lead window, and advance their nextRunAt.
 */
export const automationTick = onSchedule(
  { schedule: "every 5 minutes", timeoutSeconds: 300, memory: "512MiB" },
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
        const quota = await getPostQuota(automation.userId);
        if (quota.remaining <= 0) {
          await docSnap.ref.update({
            status: "paused",
            lastError:
              quota.plan === "free"
                ? "Publishing requires a paid subscription"
                : "Monthly post limit reached — automation paused",
            updatedAt: FieldValue.serverTimestamp(),
          });
          continue;
        }

        const slotISO = slot.toISOString().replace(/[:.]/g, "-");
        const idempotencyKey = `${docSnap.id}_${slotISO}`;
        const postRef = db.collection("posts").doc(idempotencyKey);

        const post: PostDoc = {
          userId: automation.userId,
          automationId: docSnap.id,
          brandProfileId: automation.brandProfileId,
          source: "automation",
          scheduledFor: Timestamp.fromDate(slot),
          timezone: automation.schedule.timezone,
          status: automation.requiresApproval ? "pending_approval" : "scheduled",
          brief: automation.brief,
          contentTypes: automation.contentTypes,
          preset: automation.preset,
          tone: automation.tone,
          platforms: automation.platforms,
          socialAccountIds: automation.socialAccountIds,
          attempts: 0,
          maxAttempts: 3,
          idempotencyKey,
        };

        try {
          // create() throws if the doc exists -> idempotent across ticks
          await postRef.create({
            ...post,
            createdAt: FieldValue.serverTimestamp(),
          });
          await incrementPostUsage(automation.userId);
        } catch (createError: unknown) {
          const message = stringifyError(createError);
          if (!/already exists/i.test(message)) throw createError;
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
        await docSnap.ref.update({ status: "ready", updatedAt: FieldValue.serverTimestamp() });
        continue;
      }

      // Transaction-claim so overlapping runs never double-generate
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(docSnap.ref);
        if (fresh.data()?.status !== "scheduled") return false;
        tx.update(docSnap.ref, {
          status: "generating",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (!claimed) continue;

      try {
        const update = await generatePostAssets(docSnap.id, post);
        await docSnap.ref.update({
          ...update,
          status: "ready",
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (error: unknown) {
        console.error(`[generationTick] ${docSnap.id} failed:`, stringifyError(error));
        await handlePostFailure(docSnap.ref, post, stringifyError(error), "scheduled");
      }
    }
  }
);

/** Publish ready posts that are due, and poll in-flight Post Bridge posts. */
export const postingTick = onSchedule(
  {
    schedule: "every 1 minutes",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [postBridgeApiKey],
  },
  async () => {
    const now = Timestamp.now();

    // 1) Ready + due -> submit to Post Bridge
    const readySnap = await db
      .collection("posts")
      .where("status", "==", "ready")
      .where("scheduledFor", "<=", now)
      .limit(20)
      .get();

    for (const docSnap of readySnap.docs) {
      const post = docSnap.data() as PostDoc;

      // Honor retry backoff
      if (post.nextAttemptAt && post.nextAttemptAt.toMillis() > Date.now()) continue;

      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(docSnap.ref);
        if (fresh.data()?.status !== "ready") return false;
        tx.update(docSnap.ref, {
          status: "posting",
          attempts: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (!claimed) continue;

      try {
        // Upload media to Post Bridge
        const mediaIds: string[] = [];
        for (const media of post.media ?? []) {
          if (media.pbMediaId) {
            mediaIds.push(media.pbMediaId);
            continue;
          }
          if (!media.storagePath) continue;
          const [buffer] = await getBucket().file(media.storagePath).download();
          const mime = media.type === "video" ? "video/mp4" : "image/png";
          const pbMediaId = await pbUploadMediaFromBuffer(
            buffer,
            mime,
            media.storagePath.split("/").pop() ?? "media"
          );
          mediaIds.push(pbMediaId);
        }

        const { id: pbPostId, dryRun } = await pbCreatePost({
          caption: post.content?.caption ?? post.brief,
          socialAccountIds: post.socialAccountIds,
          mediaIds,
        });

        await docSnap.ref.update({
          "pb.postId": pbPostId,
          "pb.dryRun": dryRun,
          "pb.submittedAt": FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (error: unknown) {
        console.error(`[postingTick] submit ${docSnap.id} failed:`, stringifyError(error));
        await handlePostFailure(docSnap.ref, post, stringifyError(error), "ready");
      }
    }

    // 2) Poll in-flight posts for final status
    const postingSnap = await db
      .collection("posts")
      .where("status", "==", "posting")
      .limit(30)
      .get();

    for (const docSnap of postingSnap.docs) {
      const post = docSnap.data() as PostDoc;
      if (!post.pb?.postId) continue; // will be retried by failure path

      try {
        const pbPost = await pbGetPost(post.pb.postId);
        const status = (pbPost.status || "").toLowerCase();

        if (status === "posted" || status === "published" || status === "success") {
          const results = post.platforms.map((platform) => {
            const match = pbPost.results?.find((r) => r.platform === platform);
            return {
              platform,
              status: "posted" as const,
              ...(match?.url ? { permalink: match.url } : {}),
            };
          });
          await docSnap.ref.update({
            status: "posted",
            results,
            error: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          if (post.automationId) {
            await db.collection("automations").doc(post.automationId).update({
              failureCount: 0,
            });
          }
        } else if (status === "failed" || status === "error") {
          const reason =
            pbPost.results?.map((r) => r.error).filter(Boolean).join("; ") ||
            "Post Bridge reported failure";
          await handlePostFailure(docSnap.ref, post, reason, "ready");
        }
        // otherwise still processing — poll again next tick
      } catch (error: unknown) {
        console.error(`[postingTick] poll ${docSnap.id} failed:`, stringifyError(error));
      }
    }

    if (isDryRun()) {
      console.log("[postingTick] running in DRY-RUN mode (no POST_BRIDGE_API_KEY)");
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
  const attempts = (post.attempts ?? 0) + 1;
  const maxAttempts = post.maxAttempts ?? 3;

  if (attempts < maxAttempts) {
    const delay = RETRY_DELAYS_MINUTES[Math.min(attempts - 1, RETRY_DELAYS_MINUTES.length - 1)];
    await ref.update({
      status: retryStatus,
      error: message,
      nextAttemptAt: minutesFromNow(delay),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  await ref.update({
    status: "failed",
    error: message,
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
