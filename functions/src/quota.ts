import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { db } from "./core";
import { sendUsageLimitEmail } from "./brevo";
import { activePaidPostEntitlement } from "./entitlements";

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getPostQuota(userId: string): Promise<{
  plan: string;
  used: number;
  limit: number;
  remaining: number;
}> {
  const [subSnap, userSnap] = await Promise.all([
    db.collection("subscriptions").doc(userId).get(),
    db.collection("users").doc(userId).get(),
  ]);
  const entitlement = subSnap.exists
    ? activePaidPostEntitlement(subSnap.data())
    : null;
  const effectivePlan = entitlement?.plan ?? "free";
  const limit = entitlement?.limit ?? 0;
  const usage = userSnap.data()?.usage as
    | { month?: string; postsThisMonth?: number }
    | undefined;
  const used = usage?.month === monthKey() ? usage.postsThisMonth ?? 0 : 0;
  return { plan: effectivePlan, used, limit, remaining: Math.max(0, limit - used) };
}

export async function assertPostQuota(userId: string): Promise<void> {
  const quota = await getPostQuota(userId);
  if (quota.plan === "free") {
    throw new HttpsError(
      "permission-denied",
      "A paid subscription is required to publish posts"
    );
  }
  if (quota.remaining <= 0) {
    // Nudge the user to upgrade (once per billing period — see helper).
    await notifyUsageLimitReached(userId);
    throw new HttpsError("resource-exhausted", "Monthly post limit reached");
  }
}

/**
 * Send the usage-limit / upgrade email the first time a paid user crosses
 * their monthly allowance, at most once per billing period.
 *
 * Dedupe guard: a `usageLimitEmailPeriod` field on the users/{uid} doc set to
 * the current month key. A transaction claims the period atomically before
 * the email is sent, so overlapping blocked requests never double-send. The
 * key rolls over each month, so the nudge repeats once per new billing period.
 * Never throws — a failed email must not change quota-enforcement behavior.
 */
export async function notifyUsageLimitReached(userId: string): Promise<void> {
  try {
    const period = monthKey();
    const quota = await getPostQuota(userId);
    // Only nudge paid users who have actually exhausted their allowance.
    if (quota.plan === "free" || quota.remaining > 0) return;

    const userRef = db.collection("users").doc(userId);
    const claim = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data() as
        | { email?: string; displayName?: string; usageLimitEmailPeriod?: string }
        | undefined;
      if (data?.usageLimitEmailPeriod === period) return null; // already notified
      const email = data?.email?.trim();
      if (!email) return null;
      tx.set(
        userRef,
        {
          usageLimitEmailPeriod: period,
          usageLimitEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { email, name: data?.displayName };
    });
    if (!claim) return;

    await sendUsageLimitEmail({ email: claim.email, name: claim.name, plan: quota.plan });
  } catch (error: unknown) {
    logger.error("[quota] failed to send usage-limit email", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function incrementPostUsage(userId: string): Promise<void> {
  const key = monthKey();
  await db.runTransaction(async (tx) => {
    const ref = db.collection("users").doc(userId);
    const snap = await tx.get(ref);
    const usage = snap.data()?.usage as
      | { month?: string; postsThisMonth?: number }
      | undefined;
    const postsThisMonth = usage?.month === key ? (usage.postsThisMonth ?? 0) + 1 : 1;
    tx.set(
      ref,
      {
        usage: {
          month: key,
          postsThisMonth,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  });
}
