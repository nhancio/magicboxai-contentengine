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
exports.onUserUpdatedClaimPendingEntitlement = exports.onUserCreatedSendWelcome = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const brevo_1 = require("./brevo");
const core_1 = require("./core");
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
async function claimPendingEntitlement(uid, email) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        const key = email.toLowerCase();
        const pendingRef = core_1.db.collection("pendingEntitlements").doc(key);
        const pending = await pendingRef.get();
        const p = pending.data();
        if (!(p === null || p === void 0 ? void 0 : p.plan) || (p.status !== "paid" && p.status !== "active"))
            return;
        const existingSub = await core_1.db.collection("subscriptions").doc(uid).get();
        if (((_a = existingSub.data()) === null || _a === void 0 ? void 0 : _a.status) === "active" && ((_b = existingSub.data()) === null || _b === void 0 ? void 0 : _b.providerSubscriptionId)) {
            logger.warn("[claimPendingEntitlement] skipped: account already has an active subscription", {
                uid,
                pendingPlan: p.plan,
            });
            return;
        }
        await core_1.db.collection("subscriptions").doc(uid).set(Object.assign(Object.assign({ plan: p.plan, billing: (_c = p.billing) !== null && _c !== void 0 ? _c : null, videosUsed: 0, videosLimit: core_1.PLAN_VIDEO_LIMIT[p.plan], status: "active", provider: (_d = p.provider) !== null && _d !== void 0 ? _d : "dodo", providerProductId: (_e = p.providerProductId) !== null && _e !== void 0 ? _e : null, providerSubscriptionId: (_f = p.providerSubscriptionId) !== null && _f !== void 0 ? _f : null, providerCustomerId: (_g = p.providerCustomerId) !== null && _g !== void 0 ? _g : null }, (p.currentPeriodEnd ? { currentPeriodEnd: p.currentPeriodEnd } : {})), { claimedFrom: "guest-checkout", updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
        await pendingRef.set({
            status: "claimed",
            claimedByUid: uid,
            claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        logger.info("[claimPendingEntitlement] claimed pending entitlement", { uid, plan: p.plan });
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
    const email = (_a = data.email) === null || _a === void 0 ? void 0 : _a.trim();
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
        const result = await (0, brevo_1.sendOnboardingEmail)({ email, name: data.displayName });
        await snap.ref.set({
            welcomeEmailSent: true,
            welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        logger.info("[onUserCreatedSendWelcome] welcome email handled", {
            uid: event.params.uid,
            messageId: result.id,
            dryRun: result.dryRun,
        });
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
    await claimPendingEntitlement(event.params.uid, email);
});
//# sourceMappingURL=welcome.js.map