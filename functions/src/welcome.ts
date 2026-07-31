// Firestore triggers on users/{uid}. Creation dispatches the first-signup
// welcome email. Later updates keep the guest-checkout entitlement claim path
// alive without ever re-sending that email.

import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { brevoApiKey, sendOnboardingEmail } from "./brevo";
import { callableSecurity, db, PLAN_VIDEO_LIMIT, requireAuth, type PlanId } from "./core";

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
      if (!result.dryRun) {
        await snap.ref.set(
          {
            welcomeEmailSent: true,
            welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        logger.info("[onUserCreatedSendWelcome] welcome email sent via Brevo", {
          uid: event.params.uid,
          messageId: result.id,
        });
      } else {
        logger.warn("[onUserCreatedSendWelcome] dry-run executed: BREVO_API_KEY secret is not set in Firebase. welcomeEmailSent not marked true so email can be retried once key is set.", {
          uid: event.params.uid,
          email,
        });
      }
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

/**
 * Callable endpoint to trigger or resend a welcome email for any user/email.
 * Useful for admin panel or manual recovery when welcome email failed or ran in dry-run.
 */
export const triggerWelcomeEmail = onCall(
  {
    ...callableSecurity,
    secrets: [brevoApiKey],
  },
  async (request) => {
    const callerUid = requireAuth(request);
    const emailInput = typeof request.data?.email === "string" ? request.data.email.trim() : "";
    const nameInput = typeof request.data?.name === "string" ? request.data.name.trim() : undefined;
    const targetUid = typeof request.data?.targetUid === "string" ? request.data.targetUid.trim() : callerUid;

    let email = emailInput;
    let displayName = nameInput;

    if (!email && targetUid) {
      const snap = await db.collection("users").doc(targetUid).get();
      if (snap.exists) {
        const u = snap.data() as { email?: string; displayName?: string };
        email = u.email?.trim() ?? "";
        displayName = displayName ?? u.displayName;
      }
    }

    if (!email) {
      throw new HttpsError("invalid-argument", "Valid email address is required to send welcome email.");
    }

    try {
      const result = await sendOnboardingEmail({ email, name: displayName });
      if (!result.dryRun && targetUid) {
        await db.collection("users").doc(targetUid).set(
          {
            welcomeEmailSent: true,
            welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      return {
        success: true,
        email,
        messageId: result.id,
        dryRun: result.dryRun,
      };
    } catch (err) {
      logger.error("[triggerWelcomeEmail] failed", {
        email,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new HttpsError("internal", err instanceof Error ? err.message : "Failed to send welcome email via Brevo.");
    }
  }
);
