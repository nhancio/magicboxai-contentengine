"use strict";
// Firestore triggers on users/{uid}. Creation dispatches the first-signup
// welcome email. Later updates keep the guest-checkout entitlement claim path
// alive without ever re-sending that email.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerWelcomeEmail = exports.claimGuestEntitlement = exports.onUserUpdatedClaimPendingEntitlement = exports.onUserCreatedSendWelcome = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const brevo_1 = require("./brevo");
const core_1 = require("./core");
if (!admin.apps.length) {
    admin.initializeApp();
}
async function applyBillingClaims(uid) {
    var _a;
    const snapshot = await core_1.db.collection("subscriptions").doc(uid).get();
    const data = snapshot.data();
    const plan = (data === null || data === void 0 ? void 0 : data.plan) === "pro" || (data === null || data === void 0 ? void 0 : data.plan) === "max" ? data.plan : "free";
    const status = (data === null || data === void 0 ? void 0 : data.status) === "active" || (data === null || data === void 0 ? void 0 : data.status) === "past_due" || (data === null || data === void 0 ? void 0 : data.status) === "cancelled"
        ? data.status
        : "inactive";
    const user = await admin.auth().getUser(uid);
    const existing = (_a = user.customClaims) !== null && _a !== void 0 ? _a : {};
    await admin.auth().setCustomUserClaims(uid, Object.assign(Object.assign({}, existing), { magicboxPlan: plan, magicboxSubscriptionStatus: status }));
    return {
        plan,
        status,
        hasPaidPlan: (plan === "pro" || plan === "max") && status === "active",
    };
}
/**
 * Claim any plan bought before signup via guest checkout, keyed by the
 * (Google-verified) email — so auto-applying it to this account on login is
 * safe. Runs on every login, not just the first one, so an existing account
 * that pays as a guest under the same email gets claimed too. Idempotent:
 * once claimed, `pendingEntitlements/{email}.status` flips to "claimed" and
 * this no-ops on subsequent logins.
 *
 * Entitlement only attaches when the paying email matches the signed-in
 * Google email. A mismatch looks like "none" because pending rows are keyed
 * by the Dodo customer email.
 */
async function claimPendingEntitlement(uid, email) {
    var _a, _b, _c, _d, _e;
    const key = email.toLowerCase();
    const pendingRef = core_1.db.collection("pendingEntitlements").doc(key);
    const pending = await pendingRef.get();
    const p = pending.data();
    const existingSub = await core_1.db.collection("subscriptions").doc(uid).get();
    const existing = existingSub.data();
    if (existing && (existing.plan === "pro" || existing.plan === "max") && existing.status === "active") {
        return { outcome: "already_active", plan: existing.plan };
    }
    if ((p === null || p === void 0 ? void 0 : p.status) === "claimed" && p.claimedByUid === uid && (p.plan === "pro" || p.plan === "max")) {
        return { outcome: "already_active", plan: p.plan };
    }
    if (!(p === null || p === void 0 ? void 0 : p.plan) || (p.plan !== "pro" && p.plan !== "max") || (p.status !== "paid" && p.status !== "active")) {
        return { outcome: "none" };
    }
    if ((existing === null || existing === void 0 ? void 0 : existing.status) === "active" && existing.providerSubscriptionId) {
        logger.warn("[claimPendingEntitlement] skipped: account already has an active subscription", {
            uid,
            pendingPlan: p.plan,
        });
        return { outcome: "already_active", plan: (existing.plan === "max" ? "max" : "pro") };
    }
    await core_1.db.collection("subscriptions").doc(uid).set(Object.assign(Object.assign({ plan: p.plan, billing: (_a = p.billing) !== null && _a !== void 0 ? _a : null, videosUsed: 0, videosLimit: core_1.PLAN_VIDEO_LIMIT[p.plan], status: "active", provider: (_b = p.provider) !== null && _b !== void 0 ? _b : "dodo", providerProductId: (_c = p.providerProductId) !== null && _c !== void 0 ? _c : null, providerSubscriptionId: (_d = p.providerSubscriptionId) !== null && _d !== void 0 ? _d : null, providerCustomerId: (_e = p.providerCustomerId) !== null && _e !== void 0 ? _e : null }, (p.currentPeriodEnd ? { currentPeriodEnd: p.currentPeriodEnd } : {})), { claimedFrom: "guest-checkout", updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
    await pendingRef.set({
        status: "claimed",
        claimedByUid: uid,
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    logger.info("[claimPendingEntitlement] claimed pending entitlement", { uid, plan: p.plan });
    return { outcome: "claimed", plan: p.plan };
}
async function claimPendingEntitlementSafe(uid, email) {
    try {
        await claimPendingEntitlement(uid, email);
    }
    catch (error) {
        logger.error("[claimPendingEntitlement] failed", {
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
exports.onUserCreatedSendWelcome = (0, firestore_1.onDocumentCreated)({
    document: "users/{uid}",
    // Firestore triggers must run in the database's region (asia-south2).
    // Pinned so the global us-central1 default (set in core.ts) can't move it.
    region: "asia-south2",
    secrets: [brevo_1.brevoApiKey],
}, async (event) => {
    var _a;
    const snap = event.data;
    if (!(snap === null || snap === void 0 ? void 0 : snap.exists))
        return;
    const data = snap.data();
    // Ensure default trial credits are set in Firestore
    if (!data.credits) {
        await snap.ref.set({
            credits: {
                iCredits: 50,
                vCredits: 100,
                trialClaimed: true,
                trialGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
        }, { merge: true });
    }
    const email = (_a = data.email) === null || _a === void 0 ? void 0 : _a.trim();
    if (!email) {
        logger.warn("[onUserCreatedSendWelcome] user doc has no email, skipping", {
            uid: event.params.uid,
        });
        return;
    }
    await claimPendingEntitlementSafe(event.params.uid, email);
    if (data.welcomeEmailSent === true) {
        return;
    }
    try {
        const result = await (0, brevo_1.sendOnboardingEmail)({ email, name: data.displayName });
        if (!result.dryRun) {
            await snap.ref.set({
                welcomeEmailSent: true,
                welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            logger.info("[onUserCreatedSendWelcome] welcome email sent via Brevo", {
                uid: event.params.uid,
                messageId: result.id,
            });
        }
        else {
            logger.warn("[onUserCreatedSendWelcome] dry-run executed: BREVO_API_KEY secret is not set in Firebase. welcomeEmailSent not marked true so email can be retried once key is set.", {
                uid: event.params.uid,
                email,
            });
        }
    }
    catch (error) {
        logger.error("[onUserCreatedSendWelcome] failed to send welcome email", {
            uid: event.params.uid,
            error: error instanceof Error ? error.message : String(error),
        });
        // Swallow the error: a failed email must not crash the trigger or
        // block the user. welcomeEmailSent stays false so a manual/replayed
        // create could retry.
    }
});
exports.onUserUpdatedClaimPendingEntitlement = (0, firestore_1.onDocumentUpdated)({
    document: "users/{uid}",
    region: "asia-south2",
}, async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.data();
    const email = (_b = data === null || data === void 0 ? void 0 : data.email) === null || _b === void 0 ? void 0 : _b.trim();
    if (!email)
        return;
    await claimPendingEntitlementSafe(event.params.uid, email);
});
/**
 * Client-callable claim after guest checkout returns to /pricing?checkout=returned.
 * Looks up pendingEntitlements by the signed-in Google email, writes subscriptions/{uid},
 * and refreshes custom claims so Convex can enforce the paid plan. Does not change
 * the Dodo webhook path that creates the pending row.
 */
exports.claimGuestEntitlement = (0, https_1.onCall)(core_1.callableSecurity, async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const email = typeof ((_a = request.auth) === null || _a === void 0 ? void 0 : _a.token.email) === "string" ? request.auth.token.email.trim() : "";
    if (!email) {
        throw new https_1.HttpsError("failed-precondition", "Sign in with a Google account that has an email so we can attach your purchase.");
    }
    try {
        const claim = await claimPendingEntitlement(uid, email);
        const billing = await applyBillingClaims(uid);
        return {
            outcome: claim.outcome,
            plan: claim.outcome === "none" ? billing.plan : claim.plan,
            status: billing.status,
            hasPaidPlan: billing.hasPaidPlan,
            email: email.toLowerCase(),
        };
    }
    catch (error) {
        logger.error("[claimGuestEntitlement] failed", {
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
        throw new https_1.HttpsError("internal", error instanceof Error ? error.message : "Could not attach your purchase.");
    }
});
/**
 * Callable endpoint to trigger or resend a welcome email for any user/email.
 * Useful for admin panel or manual recovery when welcome email failed or ran in dry-run.
 */
exports.triggerWelcomeEmail = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [brevo_1.brevoApiKey] }), async (request) => {
    var _a, _b, _c, _d, _e;
    const callerUid = (0, core_1.requireAuth)(request);
    const emailInput = typeof ((_a = request.data) === null || _a === void 0 ? void 0 : _a.email) === "string" ? request.data.email.trim() : "";
    const nameInput = typeof ((_b = request.data) === null || _b === void 0 ? void 0 : _b.name) === "string" ? request.data.name.trim() : undefined;
    const targetUid = typeof ((_c = request.data) === null || _c === void 0 ? void 0 : _c.targetUid) === "string" ? request.data.targetUid.trim() : callerUid;
    let email = emailInput;
    let displayName = nameInput;
    if (!email && targetUid) {
        const snap = await core_1.db.collection("users").doc(targetUid).get();
        if (snap.exists) {
            const u = snap.data();
            email = (_e = (_d = u.email) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : "";
            displayName = displayName !== null && displayName !== void 0 ? displayName : u.displayName;
        }
    }
    if (!email) {
        throw new https_1.HttpsError("invalid-argument", "Valid email address is required to send welcome email.");
    }
    try {
        const result = await (0, brevo_1.sendOnboardingEmail)({ email, name: displayName });
        if (!result.dryRun && targetUid) {
            await core_1.db.collection("users").doc(targetUid).set({
                welcomeEmailSent: true,
                welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        return {
            success: true,
            email,
            messageId: result.id,
            dryRun: result.dryRun,
        };
    }
    catch (err) {
        logger.error("[triggerWelcomeEmail] failed", {
            email,
            error: err instanceof Error ? err.message : String(err),
        });
        throw new https_1.HttpsError("internal", err instanceof Error ? err.message : "Failed to send welcome email via Brevo.");
    }
});
//# sourceMappingURL=welcome.js.map