"use strict";
// Firestore trigger: send a one-time welcome / thank-you email when a new
// user document is created at users/{uid}. The client (shared/lib/auth.tsx)
// creates this doc via setDoc merge on first sign-in.
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
exports.onUserCreatedSendWelcome = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const brevo_1 = require("./brevo");
const core_1 = require("./core");
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Fires once when users/{uid} is created. Sends the welcome email via Brevo,
 * guarding against duplicate sends with a welcomeEmailSent flag. A failed
 * email is logged but never crashes the trigger.
 */
exports.onUserCreatedSendWelcome = (0, firestore_1.onDocumentCreated)({
    document: "users/{uid}",
    // Firestore triggers must run in the database's region (asia-south2).
    // Pinned so the global us-central1 default (set in core.ts) can't move it.
    region: "asia-south2",
    secrets: [brevo_1.brevoApiKey],
}, async (event) => {
    var _a;
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    if (data.welcomeEmailSent === true) {
        logger.info("[onUserCreatedSendWelcome] welcome email already sent, skipping", {
            uid: event.params.uid,
        });
        return;
    }
    const email = (_a = data.email) === null || _a === void 0 ? void 0 : _a.trim();
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
        const pendingRef = core_1.db.collection("pendingEntitlements").doc(key);
        const pending = await pendingRef.get();
        const p = pending.data();
        if ((p === null || p === void 0 ? void 0 : p.plan) && (p.status === "paid" || p.status === "active")) {
            await core_1.db.collection("subscriptions").doc(event.params.uid).set(Object.assign(Object.assign({ plan: p.plan, videosUsed: 0, videosLimit: core_1.PLAN_VIDEO_LIMIT[p.plan], status: "active", provider: "dodo" }, (p.currentPeriodEnd ? { currentPeriodEnd: p.currentPeriodEnd } : {})), { claimedFrom: "guest-checkout", updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
            await pendingRef.set({
                status: "claimed",
                claimedByUid: event.params.uid,
                claimedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            logger.info("[onUserCreatedSendWelcome] claimed pending entitlement", {
                uid: event.params.uid,
                plan: p.plan,
            });
        }
    }
    catch (error) {
        logger.error("[onUserCreatedSendWelcome] pending entitlement claim failed", {
            uid: event.params.uid,
            error: error instanceof Error ? error.message : String(error),
        });
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
//# sourceMappingURL=welcome.js.map