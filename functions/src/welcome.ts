// Firestore trigger: send a one-time welcome / thank-you email when a new
// user document is created at users/{uid}. The client (shared/lib/auth.tsx)
// creates this doc via setDoc merge on first sign-in.

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { brevoApiKey, sendOnboardingEmail } from "./brevo";
import { db, PLAN_VIDEO_LIMIT, type PlanId } from "./core";

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Fires once when users/{uid} is created. Sends the welcome email via Brevo,
 * guarding against duplicate sends with a welcomeEmailSent flag. A failed
 * email is logged but never crashes the trigger.
 */
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
    if (!snap) return;

    const data = snap.data() as {
      email?: string;
      displayName?: string;
      welcomeEmailSent?: boolean;
    };

    if (data.welcomeEmailSent === true) {
      logger.info("[onUserCreatedSendWelcome] welcome email already sent, skipping", {
        uid: event.params.uid,
      });
      return;
    }

    const email = data.email?.trim();
    if (!email) {
      logger.warn("[onUserCreatedSendWelcome] user doc has no email, skipping", {
        uid: event.params.uid,
      });
      return;
    }

    // Claim any plan bought before signup via guest checkout. Keyed by the
    // (Google-verified) email, so auto-applying it to this account is safe.
    try {
      const key = email.toLowerCase();
      const pendingRef = db.collection("pendingEntitlements").doc(key);
      const pending = await pendingRef.get();
      const p = pending.data() as
        | { plan?: PlanId; status?: string; currentPeriodEnd?: admin.firestore.Timestamp }
        | undefined;
      if (p?.plan && (p.status === "paid" || p.status === "active")) {
        await db.collection("subscriptions").doc(event.params.uid).set(
          {
            plan: p.plan,
            videosUsed: 0,
            videosLimit: PLAN_VIDEO_LIMIT[p.plan],
            status: "active",
            provider: "dodo",
            ...(p.currentPeriodEnd ? { currentPeriodEnd: p.currentPeriodEnd } : {}),
            claimedFrom: "guest-checkout",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await pendingRef.set(
          {
            status: "claimed",
            claimedByUid: event.params.uid,
            claimedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        logger.info("[onUserCreatedSendWelcome] claimed pending entitlement", {
          uid: event.params.uid,
          plan: p.plan,
        });
      }
    } catch (error: unknown) {
      logger.error("[onUserCreatedSendWelcome] pending entitlement claim failed", {
        uid: event.params.uid,
        error: error instanceof Error ? error.message : String(error),
      });
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
