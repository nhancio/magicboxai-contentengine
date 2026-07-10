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
exports.incrementPostUsage = incrementPostUsage;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const core_1 = require("./core");
// Posts per calendar month by subscription plan. Free users can draft but
// not publish; paid tiers map to the existing `subscriptions` collection.
const PLAN_POST_LIMITS = {
    free: 0,
    starter: 60,
    pro: 300,
};
function monthKey(date = new Date()) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
async function getPostQuota(userId) {
    var _a, _b, _c, _d, _e, _f;
    const [subSnap, userSnap] = await Promise.all([
        core_1.db.collection("subscriptions").doc(userId).get(),
        core_1.db.collection("users").doc(userId).get(),
    ]);
    const plan = (_b = (_a = subSnap.data()) === null || _a === void 0 ? void 0 : _a.plan) !== null && _b !== void 0 ? _b : "free";
    const status = (_c = subSnap.data()) === null || _c === void 0 ? void 0 : _c.status;
    const effectivePlan = status && status !== "active" ? "free" : plan;
    const limit = (_d = PLAN_POST_LIMITS[effectivePlan]) !== null && _d !== void 0 ? _d : 0;
    const usage = (_e = userSnap.data()) === null || _e === void 0 ? void 0 : _e.usage;
    const used = (usage === null || usage === void 0 ? void 0 : usage.month) === monthKey() ? (_f = usage.postsThisMonth) !== null && _f !== void 0 ? _f : 0 : 0;
    return { plan: effectivePlan, used, limit, remaining: Math.max(0, limit - used) };
}
async function assertPostQuota(userId) {
    const quota = await getPostQuota(userId);
    if (quota.plan === "free") {
        throw new https_1.HttpsError("permission-denied", "A paid subscription is required to publish posts");
    }
    if (quota.remaining <= 0) {
        throw new https_1.HttpsError("resource-exhausted", "Monthly post limit reached");
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