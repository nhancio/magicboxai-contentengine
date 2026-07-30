// Firestore triggers on users/{uid}. Creation dispatches the first-signup
// welcome email. Later updates keep the guest-checkout entitlement claim path
// alive without ever re-sending that email.

import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { brevoApiKey, sendOnboardingEmail } from "./brevo";
import { db, PLAN_VIDEO_LIMIT, type PlanId } from "./core";

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Claim any plan bought before signup via guest checkout, keyed by the
 * (Google-verified) email — so auto-applying it to this account on login is
 * safe. Runs on every login, not just the first one, so an existing account
 * that pays as a guest under the same email gets claimed too. Idempotent:
 * once claimed, `pendingEntitlements/{email}.status` flips to "claimed" and
 * this no-ops on subsequent logins.
 */
async function claimPendingEntitlement(uid: string, email: string): Promise<void> {
  try {
    const key = email.toLowerCase();
    const pendingRef = db.collection("pendingEntitlements").doc(key);
    const pending = await pendingRef.get();
    const p = pending.data() as
      | {
          plan?: PlanId;
          billing?: "monthly" | "annual";
          status?: string;
          provider?: string;
          providerProductId?: string;
          providerSubscriptionId?: string;
          providerCustomerId?: string;
          currentPeriodEnd?: admin.firestore.Timestamp;
        }
      | undefined;
    if (!p?.plan || (p.status !== "paid" && p.status !== "active")) return;

    const existingSub = await db.collection("subscriptions").doc(uid).get();
    if (existingSub.data()?.status === "active" && existingSub.data()?.providerSubscriptionId) {
      logger.warn("[claimPendingEntitlement] skipped: account already has an active subscription", {
        uid,
        pendingPlan: p.plan,
      });
      return;
    }

    await db.collection("subscriptions").doc(uid).set(
      {
        plan: p.plan,
        billing: p.billing ?? null,
        videosUsed: 0,
        videosLimit: PLAN_VIDEO_LIMIT[p.plan],
        status: "active",
        provider: p.provider ?? "dodo",
        providerProductId: p.providerProductId ?? null,
        providerSubscriptionId: p.providerSubscriptionId ?? null,
        providerCustomerId: p.providerCustomerId ?? null,
        ...(p.currentPeriodEnd ? { currentPeriodEnd: p.currentPeriodEnd } : {}),
        claimedFrom: "guest-checkout",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await pendingRef.set(
      {
        status: "claimed",
        claimedByUid: uid,
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    logger.info("[claimPendingEntitlement] claimed pending entitlement", { uid, plan: p.plan });
  } catch (error: unknown) {
    logger.error("[claimPendingEntitlement] failed", {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const onUserCreatedSendWelcome = onDocumentCreated(
  {
    document: "users/{uid}",
    // Firestore triggers must run in the database's region (asia-south2).
    // Pinned so the global us-central1 default (set in core.ts) can't move it.
    region: "asia-south2",
    secrets: [brevoApiKey],
  },
  async (event) => {
    const snap = event.data;
    if (!snap?.exists) return;

    const data = snap.data() as {
      email?: string;
      displayName?: string;
      welcomeEmailSent?: boolean;
    };

    const email = data.email?.trim();
    if (!email) {
      logger.warn("[onUserCreatedSendWelcome] user doc has no email, skipping", {
        uid: event.params.uid,
      });
      return;
    }

    await claimPendingEntitlement(event.params.uid, email);

    if (data.welcomeEmailSent === true) {
      return;
    }

    try {
      const result = await sendOnboardingEmail({ email, name: data.displayName });
      await snap.ref.set(
        {
          welcomeEmailSent: true,
          welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      logger.info("[onUserCreatedSendWelcome] welcome email handled", {
        uid: event.params.uid,
        messageId: result.id,
        dryRun: result.dryRun,
      });
    } catch (error: unknown) {
      logger.error("[onUserCreatedSendWelcome] failed to send welcome email", {
        uid: event.params.uid,
        error: error instanceof Error ? error.message : String(error),
      });
      // Swallow the error: a failed email must not crash the trigger or
      // block the user. welcomeEmailSent stays false so a manual/replayed
      // create could retry.
    }
  }
);

export const onUserUpdatedClaimPendingEntitlement = onDocumentUpdated(
  {
    document: "users/{uid}",
    region: "asia-south2",
  },
  async (event) => {
    const data = event.data?.after.data() as { email?: string } | undefined;
    const email = data?.email?.trim();
    if (!email) return;
    await claimPendingEntitlement(event.params.uid, email);
  }
);
