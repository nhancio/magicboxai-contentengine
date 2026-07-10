import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "./core";

// Posts per calendar month by subscription plan. Free users can draft but
// not publish; paid tiers map to the existing `subscriptions` collection.
const PLAN_POST_LIMITS: Record<string, number> = {
  free: 0,
  starter: 60,
  pro: 300,
};

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
  const plan = (subSnap.data()?.plan as string) ?? "free";
  const status = subSnap.data()?.status as string | undefined;
  const effectivePlan = status && status !== "active" ? "free" : plan;
  const limit = PLAN_POST_LIMITS[effectivePlan] ?? 0;
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
    throw new HttpsError("resource-exhausted", "Monthly post limit reached");
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
