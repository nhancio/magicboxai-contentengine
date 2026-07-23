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
exports.stringifyError = exports.PLAN_VIDEO_LIMIT = exports.assertVeoGenerationEnabled = exports.isVeoGenerationEnabled = exports.AI_RATE_LIMITS = exports.callableSecurity = exports.getBucket = exports.requireAuth = exports.getAI = exports.db = void 0;
exports.enforceCallableRateLimit = enforceCallableRateLimit;
exports.createDownloadUrl = createDownloadUrl;
exports.parsePositiveBoundedInteger = parsePositiveBoundedInteger;
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
const node_crypto_1 = require("node:crypto");
const rate_limit_1 = require("./rate-limit");
// core.ts is the first module in the import graph (callables.ts imports it),
// so this runs before any function is defined and applies to all of them.
// Region is pinned to match the deployed webhook URL + Vertex location.
// maxInstances caps runaway cost. NOTE: to kill cold starts on the hot
// interactive callables at launch, add `minInstances: 1` here (paid warm
// instance — leave at 0 pre-launch while traffic is ~zero).
(0, v2_1.setGlobalOptions)({
    region: "us-central1",
    maxInstances: 10,
});
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.db = admin.firestore();
const getAI = () => {
    const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
    return new genai_1.GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: "us-central1",
    });
};
exports.getAI = getAI;
const requireAuth = (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    return request.auth.uid;
};
exports.requireAuth = requireAuth;
const getBucket = () => admin.storage().bucket();
exports.getBucket = getBucket;
/**
 * Only the first-party applications and local development servers can invoke
 * browser callables. Authentication still remains the authorization boundary.
 */
exports.callableSecurity = {
    cors: [
        "https://app.magicboxai.in",
        "https://admin.magicboxai.in",
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
    ],
    // App Check is initialized by shared/lib/firebase.ts. Deployments must set
    // VITE_FIREBASE_APPCHECK_SITE_KEY before serving browser traffic.
    enforceAppCheck: true,
};
const RATE_LIMIT_OPERATION = /^[a-z][a-z0-9-]{0,63}$/;
/** Conservative ceilings for provider-backed work that is not covered by a paid-post quota. */
exports.AI_RATE_LIMITS = {
    imageGeneration: { limit: 10, windowMs: 60 * 60 * 1000 },
    textGeneration: { limit: 30, windowMs: 60 * 60 * 1000 },
    imageAnalysis: { limit: 30, windowMs: 60 * 60 * 1000 },
    avatarPhotoAnalysis: { limit: 6, windowMs: 60 * 60 * 1000 },
    avatarVideoAnalysis: { limit: 3, windowMs: 60 * 60 * 1000 },
    brandExtraction: { limit: 10, windowMs: 60 * 60 * 1000 },
    postRegeneration: { limit: 12, windowMs: 60 * 60 * 1000 },
};
/**
 * Atomically reserve one request in a per-user, per-operation window. Rate
 * limit records are server-only (there is no client Firestore rule for this
 * collection), so callers cannot reset or consume another user's allowance.
 */
async function enforceCallableRateLimit(uid, operation, config) {
    if (!RATE_LIMIT_OPERATION.test(operation)) {
        throw new Error("Invalid rate-limit operation");
    }
    const userKey = (0, node_crypto_1.createHash)("sha256").update(uid).digest("base64url");
    const ref = exports.db.collection("callableRateLimits").doc(userKey).collection("operations").doc(operation);
    const nowMs = Date.now();
    const decision = await exports.db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        const data = snapshot.data();
        const storedWindowStart = data === null || data === void 0 ? void 0 : data.windowStartedAt;
        const windowStartedAtMs = storedWindowStart && typeof storedWindowStart.toMillis === "function"
            ? storedWindowStart.toMillis()
            : undefined;
        const result = (0, rate_limit_1.evaluateFixedWindowRateLimit)({
            windowStartedAtMs,
            count: data === null || data === void 0 ? void 0 : data.count,
        }, config, nowMs);
        if (result.allowed) {
            tx.set(ref, {
                count: result.count,
                windowStartedAt: admin.firestore.Timestamp.fromMillis(result.windowStartedAtMs),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        return result;
    });
    if (!decision.allowed) {
        const retryAfterSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
        throw new https_1.HttpsError("resource-exhausted", `Request limit reached. Try again in about ${retryAfterSeconds} seconds.`);
    }
}
/**
 * Give a caller a Firebase Storage bearer URL without making the underlying
 * GCS object public. The URL is still sensitive and must only be persisted in
 * tenant-owned records; bucket-level anonymous reads are never required.
 */
async function createDownloadUrl(filePath) {
    const bucket = (0, exports.getBucket)();
    const token = (0, node_crypto_1.randomUUID)();
    await bucket.file(filePath).setMetadata({
        metadata: { firebaseStorageDownloadTokens: token },
    });
    return (`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
        `/o/${encodeURIComponent(filePath)}?alt=media&token=${encodeURIComponent(token)}`);
}
/** Veo is opt-in so an incomplete deployment cannot incur generation spend. */
const isVeoGenerationEnabled = () => process.env.ENABLE_VEO_GENERATION === "true";
exports.isVeoGenerationEnabled = isVeoGenerationEnabled;
const assertVeoGenerationEnabled = () => {
    if (!(0, exports.isVeoGenerationEnabled)()) {
        throw new https_1.HttpsError("failed-precondition", "AI video generation is temporarily disabled by the server configuration");
    }
};
exports.assertVeoGenerationEnabled = assertVeoGenerationEnabled;
/** Parse an operator override without accepting zero, fractions, or unsafe values. */
function parsePositiveBoundedInteger(rawValue, fallback, maximum) {
    if (!Number.isSafeInteger(fallback) ||
        fallback < 1 ||
        !Number.isSafeInteger(maximum) ||
        maximum < fallback) {
        throw new Error("Invalid bounded integer configuration");
    }
    const value = rawValue === null || rawValue === void 0 ? void 0 : rawValue.trim();
    if (!value || !/^\d+$/.test(value))
        return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum
        ? parsed
        : fallback;
}
exports.PLAN_VIDEO_LIMIT = {
    pro: parsePositiveBoundedInteger(process.env.VIDEO_LIMIT_PRO, 2, 10),
    max: parsePositiveBoundedInteger(process.env.VIDEO_LIMIT_MAX, 10, 50),
};
const stringifyError = (error) => {
    if (error instanceof Error)
        return error.message;
    if (typeof error === "string")
        return error;
    try {
        return JSON.stringify(error);
    }
    catch (_a) {
        return "Unexpected error";
    }
};
exports.stringifyError = stringifyError;
//# sourceMappingURL=core.js.map