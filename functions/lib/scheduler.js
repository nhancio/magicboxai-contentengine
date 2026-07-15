"use strict";
// The automation engine: three scheduled ticks moving posts through
// scheduled -> generating -> ready -> posting -> posted/failed.
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
exports.postingTick = exports.generationTick = exports.automationTick = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const core_1 = require("./core");
const schedule_math_1 = require("./schedule-math");
const generation_1 = require("./generation");
const publishing_1 = require("./publishing");
const brevo_1 = require("./brevo");
const social_1 = require("./social");
const callables_1 = require("./callables");
const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;
const RETRY_DELAYS_MINUTES = [2, 10];
const MAX_CONSECUTIVE_AUTOMATION_FAILURES = 3;
const MAX_POST_ATTEMPTS = 3;
function minutesFromNow(minutes) {
    return Timestamp.fromMillis(Date.now() + minutes * 60000);
}
function boundedAttempts(value) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.min(MAX_POST_ATTEMPTS, Math.floor(value)))
        : 0;
}
/** Atomically claim one bounded attempt and return the fresh post snapshot. */
async function claimPostAttempt(ref, expectedStatus, claimedStatus) {
    const result = await core_1.db.runTransaction(async (tx) => {
        var _a;
        const fresh = await tx.get(ref);
        if (!fresh.exists || ((_a = fresh.data()) === null || _a === void 0 ? void 0 : _a.status) !== expectedStatus)
            return null;
        const post = fresh.data();
        if (post.nextAttemptAt && post.nextAttemptAt.toMillis() > Date.now())
            return null;
        const attempts = boundedAttempts(post.attempts);
        if (attempts >= MAX_POST_ATTEMPTS) {
            tx.update(ref, {
                status: "failed",
                attempts: MAX_POST_ATTEMPTS,
                maxAttempts: MAX_POST_ATTEMPTS,
                error: `Post exceeded the ${MAX_POST_ATTEMPTS}-attempt retry limit`,
                nextAttemptAt: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { exhausted: true, post: Object.assign(Object.assign({}, post), { attempts: MAX_POST_ATTEMPTS }) };
        }
        const claimedPost = Object.assign(Object.assign({}, post), { attempts: attempts + 1, maxAttempts: MAX_POST_ATTEMPTS, status: claimedStatus });
        tx.update(ref, {
            status: claimedStatus,
            attempts: claimedPost.attempts,
            maxAttempts: MAX_POST_ATTEMPTS,
            nextAttemptAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { exhausted: false, post: claimedPost };
    });
    if (!result)
        return null;
    if (result.exhausted) {
        await handlePostFailure(ref, result.post, `Post exceeded the ${MAX_POST_ATTEMPTS}-attempt retry limit`, expectedStatus);
        return null;
    }
    return result.post;
}
/**
 * Create post docs for automations whose next slot is inside the generation
 * lead window, and advance their nextRunAt.
 */
exports.automationTick = (0, scheduler_1.onSchedule)({ schedule: "every 5 minutes", timeoutSeconds: 300, memory: "512MiB", secrets: [brevo_1.brevoApiKey] }, async () => {
    var _a;
    // Look ahead by the largest lead window (video = 120 min)
    const horizon = minutesFromNow(120);
    const snap = await core_1.db
        .collection("automations")
        .where("status", "==", "active")
        .where("nextRunAt", "<=", horizon)
        .limit(50)
        .get();
    for (const docSnap of snap.docs) {
        const automation = docSnap.data();
        const lead = (_a = automation.generateLeadMinutes) !== null && _a !== void 0 ? _a : 30;
        const slot = automation.nextRunAt.toDate();
        // Only act once the slot is within this automation's own lead window.
        if (slot.getTime() - Date.now() > lead * 60000)
            continue;
        try {
            // Revalidate legacy/stored automations before copying tenant-scoped
            // brand and account ids into a post.
            const resources = await (0, callables_1.assertOwnedPublishingResources)(automation.userId, automation);
            const slotISO = slot.toISOString().replace(/[:.]/g, "-");
            const idempotencyKey = `${docSnap.id}_${slotISO}`;
            const postRef = core_1.db.collection("posts").doc(idempotencyKey);
            const post = Object.assign(Object.assign({ userId: automation.userId, automationId: docSnap.id }, (automation.brandProfileId ? { brandProfileId: automation.brandProfileId } : {})), { source: "automation", scheduledFor: Timestamp.fromDate(slot), timezone: automation.schedule.timezone, status: automation.requiresApproval ? "pending_approval" : "scheduled", brief: automation.brief, contentTypes: automation.contentTypes, preset: automation.preset, tone: automation.tone, platforms: resources.platforms, socialAccountIds: resources.socialAccountIds, attempts: 0, maxAttempts: MAX_POST_ATTEMPTS, idempotencyKey });
            try {
                await (0, callables_1.createPostWithQuotaReservation)(automation.userId, postRef, post);
            }
            catch (reservationError) {
                const code = reservationError === null || reservationError === void 0 ? void 0 : reservationError.code;
                if (code === "permission-denied" || code === "resource-exhausted") {
                    await docSnap.ref.update({
                        status: "paused",
                        lastError: (0, core_1.stringifyError)(reservationError),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    continue;
                }
                throw reservationError;
            }
            const next = automation.schedule.type === "once"
                ? null
                : (0, schedule_math_1.computeNextRunAt)(automation.schedule, slot);
            await docSnap.ref.update(Object.assign({ lastRunAt: Timestamp.fromDate(slot), runCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, (next
                ? { nextRunAt: Timestamp.fromDate(next) }
                : { status: "paused" })));
        }
        catch (error) {
            console.error(`[automationTick] ${docSnap.id} failed:`, (0, core_1.stringifyError)(error));
            await docSnap.ref.update({
                lastError: (0, core_1.stringifyError)(error),
                failureCount: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    }
});
/** Generate content for scheduled posts entering their lead window. */
exports.generationTick = (0, scheduler_1.onSchedule)({ schedule: "every 5 minutes", timeoutSeconds: 540, memory: "1GiB" }, async () => {
    var _a;
    const horizon = minutesFromNow(120);
    const snap = await core_1.db
        .collection("posts")
        .where("status", "==", "scheduled")
        .where("scheduledFor", "<=", horizon)
        .limit(10)
        .get();
    for (const docSnap of snap.docs) {
        const post = docSnap.data();
        // Honor retry backoff
        if (post.nextAttemptAt && post.nextAttemptAt.toMillis() > Date.now())
            continue;
        // Skip manual posts that already carry content
        if ((_a = post.content) === null || _a === void 0 ? void 0 : _a.caption) {
            await docSnap.ref.update({
                status: "ready",
                attempts: 0,
                maxAttempts: MAX_POST_ATTEMPTS,
                error: FieldValue.delete(),
                nextAttemptAt: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            continue;
        }
        const claimedPost = await claimPostAttempt(docSnap.ref, "scheduled", "generating");
        if (!claimedPost)
            continue;
        try {
            await (0, callables_1.assertOwnedPublishingResources)(claimedPost.userId, claimedPost);
            const update = await (0, generation_1.generatePostAssets)(docSnap.id, claimedPost);
            // Publishing begins with its own bounded three-attempt budget.
            await docSnap.ref.update(Object.assign(Object.assign({}, update), { status: "ready", attempts: 0, maxAttempts: MAX_POST_ATTEMPTS, error: FieldValue.delete(), nextAttemptAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }));
        }
        catch (error) {
            console.error(`[generationTick] ${docSnap.id} failed:`, (0, core_1.stringifyError)(error));
            await handlePostFailure(docSnap.ref, claimedPost, (0, core_1.stringifyError)(error), "scheduled");
        }
    }
});
/** Publish ready posts that are due, straight to Instagram / LinkedIn / YouTube. */
exports.postingTick = (0, scheduler_1.onSchedule)({
    schedule: "every 1 minutes",
    timeoutSeconds: 540,
    // YouTube uploads buffer the whole video in memory
    memory: "1GiB",
    secrets: [social_1.googleOAuthClientId, social_1.googleOAuthClientSecret],
}, async () => {
    const now = Timestamp.now();
    const readySnap = await core_1.db
        .collection("posts")
        .where("status", "==", "ready")
        .where("scheduledFor", "<=", now)
        .limit(10)
        .get();
    for (const docSnap of readySnap.docs) {
        const post = docSnap.data();
        // Honor retry backoff
        if (post.nextAttemptAt && post.nextAttemptAt.toMillis() > Date.now())
            continue;
        const claimedPost = await claimPostAttempt(docSnap.ref, "ready", "posting");
        if (!claimedPost)
            continue;
        try {
            const results = await (0, publishing_1.publishPost)(claimedPost);
            const anyPosted = results.some((r) => r.status === "posted");
            if (!anyPosted) {
                const reason = results.map((r) => r.error).filter(Boolean).join("; ") ||
                    "Publishing failed on all connected accounts";
                await handlePostFailure(docSnap.ref, claimedPost, reason, "ready");
                continue;
            }
            await docSnap.ref.update({
                status: "posted",
                results,
                error: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            if (claimedPost.automationId) {
                await core_1.db
                    .collection("automations")
                    .doc(claimedPost.automationId)
                    .update({ failureCount: 0 })
                    .catch(() => { });
            }
        }
        catch (error) {
            console.error(`[postingTick] publish ${docSnap.id} failed:`, (0, core_1.stringifyError)(error));
            await handlePostFailure(docSnap.ref, claimedPost, (0, core_1.stringifyError)(error), "ready");
        }
    }
});
/** Shared retry/backoff + terminal-failure handling. */
async function handlePostFailure(ref, post, message, retryStatus) {
    var _a, _b;
    // The transaction claim already persisted this attempt. Never increment a
    // second time here, and never trust a legacy document to raise the cap.
    const attempts = Math.max(1, boundedAttempts(post.attempts));
    const maxAttempts = MAX_POST_ATTEMPTS;
    if (attempts < maxAttempts) {
        const delay = RETRY_DELAYS_MINUTES[Math.min(attempts - 1, RETRY_DELAYS_MINUTES.length - 1)];
        await ref.update({
            status: retryStatus,
            attempts,
            maxAttempts,
            error: message,
            nextAttemptAt: minutesFromNow(delay),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return;
    }
    await ref.update({
        status: "failed",
        attempts,
        maxAttempts,
        error: message,
        nextAttemptAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    if (post.automationId) {
        const automationRef = core_1.db.collection("automations").doc(post.automationId);
        const snap = await automationRef.get();
        const failureCount = ((_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.failureCount) !== null && _b !== void 0 ? _b : 0) + 1;
        await automationRef.update(Object.assign(Object.assign({ failureCount, lastError: message }, (failureCount >= MAX_CONSECUTIVE_AUTOMATION_FAILURES
            ? { status: "error" }
            : {})), { updatedAt: FieldValue.serverTimestamp() }));
    }
}
//# sourceMappingURL=scheduler.js.map