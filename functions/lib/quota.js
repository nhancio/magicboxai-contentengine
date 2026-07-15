"use strict";
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
exports.getPostQuota = getPostQuota;
exports.assertPostQuota = assertPostQuota;
exports.notifyUsageLimitReached = notifyUsageLimitReached;
exports.incrementPostUsage = incrementPostUsage;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const core_1 = require("./core");
const brevo_1 = require("./brevo");
const entitlements_1 = require("./entitlements");
function monthKey(date = new Date()) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
async function getPostQuota(userId) {
    var _a, _b, _c, _d;
    const [subSnap, userSnap] = await Promise.all([
        core_1.db.collection("subscriptions").doc(userId).get(),
        core_1.db.collection("users").doc(userId).get(),
    ]);
    const entitlement = subSnap.exists
        ? (0, entitlements_1.activePaidPostEntitlement)(subSnap.data())
        : null;
    const effectivePlan = (_a = entitlement === null || entitlement === void 0 ? void 0 : entitlement.plan) !== null && _a !== void 0 ? _a : "free";
    const limit = (_b = entitlement === null || entitlement === void 0 ? void 0 : entitlement.limit) !== null && _b !== void 0 ? _b : 0;
    const usage = (_c = userSnap.data()) === null || _c === void 0 ? void 0 : _c.usage;
    const used = (usage === null || usage === void 0 ? void 0 : usage.month) === monthKey() ? (_d = usage.postsThisMonth) !== null && _d !== void 0 ? _d : 0 : 0;
    return { plan: effectivePlan, used, limit, remaining: Math.max(0, limit - used) };
}
async function assertPostQuota(userId) {
    const quota = await getPostQuota(userId);
    if (quota.plan === "free") {
        throw new https_1.HttpsError("permission-denied", "A paid subscription is required to publish posts");
    }
    if (quota.remaining <= 0) {
        // Nudge the user to upgrade (once per billing period — see helper).
        await notifyUsageLimitReached(userId);
        throw new https_1.HttpsError("resource-exhausted", "Monthly post limit reached");
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
async function notifyUsageLimitReached(userId) {
    try {
        const period = monthKey();
        const quota = await getPostQuota(userId);
        // Only nudge paid users who have actually exhausted their allowance.
        if (quota.plan === "free" || quota.remaining > 0)
            return;
        const userRef = core_1.db.collection("users").doc(userId);
        const claim = await core_1.db.runTransaction(async (tx) => {
            var _a;
            const snap = await tx.get(userRef);
            const data = snap.data();
            if ((data === null || data === void 0 ? void 0 : data.usageLimitEmailPeriod) === period)
                return null; // already notified
            const email = (_a = data === null || data === void 0 ? void 0 : data.email) === null || _a === void 0 ? void 0 : _a.trim();
            if (!email)
                return null;
            tx.set(userRef, {
                usageLimitEmailPeriod: period,
                usageLimitEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { email, name: data === null || data === void 0 ? void 0 : data.displayName };
        });
        if (!claim)
            return;
        await (0, brevo_1.sendUsageLimitEmail)({ email: claim.email, name: claim.name, plan: quota.plan });
    }
    catch (error) {
        logger.error("[quota] failed to send usage-limit email", {
            userId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
async function incrementPostUsage(userId) {
    const key = monthKey();
    await core_1.db.runTransaction(async (tx) => {
        var _a, _b;
        const ref = core_1.db.collection("users").doc(userId);
        const snap = await tx.get(ref);
        const usage = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.usage;
        const postsThisMonth = (usage === null || usage === void 0 ? void 0 : usage.month) === key ? ((_b = usage.postsThisMonth) !== null && _b !== void 0 ? _b : 0) + 1 : 1;
        tx.set(ref, {
            usage: {
                month: key,
                postsThisMonth,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
        }, { merge: true });
    });
}
//# sourceMappingURL=quota.js.map