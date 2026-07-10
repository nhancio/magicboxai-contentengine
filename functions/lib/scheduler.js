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
const postbridge_1 = require("./postbridge");
const quota_1 = require("./quota");
const core_2 = require("./core");
const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;
const RETRY_DELAYS_MINUTES = [2, 10, 30];
const MAX_CONSECUTIVE_AUTOMATION_FAILURES = 3;
function minutesFromNow(minutes) {
    return Timestamp.fromMillis(Date.now() + minutes * 60000);
}
/**
 * Create post docs for automations whose next slot is inside the generation
 * lead window, and advance their nextRunAt.
 */
exports.automationTick = (0, scheduler_1.onSchedule)({ schedule: "every 5 minutes", timeoutSeconds: 300, memory: "512MiB" }, async () => {
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
            const quota = await (0, quota_1.getPostQuota)(automation.userId);
            if (quota.remaining <= 0) {
                await docSnap.ref.update({
                    status: "paused",
                    lastError: quota.plan === "free"
                        ? "Publishing requires a paid subscription"
                        : "Monthly post limit reached — automation paused",
                    updatedAt: FieldValue.serverTimestamp(),
                });
                continue;
            }
            const slotISO = slot.toISOString().replace(/[:.]/g, "-");
            const idempotencyKey = `${docSnap.id}_${slotISO}`;
            const postRef = core_1.db.collection("posts").doc(idempotencyKey);
            const post = {
                userId: automation.userId,
                automationId: docSnap.id,
                brandProfileId: automation.brandProfileId,
                source: "automation",
                scheduledFor: Timestamp.fromDate(slot),
                timezone: automation.schedule.timezone,
                status: automation.requiresApproval ? "pending_approval" : "scheduled",
                brief: automation.brief,
                contentTypes: automation.contentTypes,
                preset: automation.preset,
                tone: automation.tone,
                platforms: automation.platforms,
                socialAccountIds: automation.socialAccountIds,
                attempts: 0,
                maxAttempts: 3,
                idempotencyKey,
            };
            try {
                // create() throws if the doc exists -> idempotent across ticks
                await postRef.create(Object.assign(Object.assign({}, post), { createdAt: FieldValue.serverTimestamp() }));
                await (0, quota_1.incrementPostUsage)(automation.userId);
            }
            catch (createError) {
                const message = (0, core_1.stringifyError)(createError);
                if (!/already exists/i.test(message))
                    throw createError;
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
            await docSnap.ref.update({ status: "ready", updatedAt: FieldValue.serverTimestamp() });
            continue;
        }
        // Transaction-claim so overlapping runs never double-generate
        const claimed = await core_1.db.runTransaction(async (tx) => {
            var _a;
            const fresh = await tx.get(docSnap.ref);
            if (((_a = fresh.data()) === null || _a === void 0 ? void 0 : _a.status) !== "scheduled")
                return false;
            tx.update(docSnap.ref, {
                status: "generating",
                updatedAt: FieldValue.serverTimestamp(),
            });
            return true;
        });
        if (!claimed)
            continue;
        try {
            const update = await (0, generation_1.generatePostAssets)(docSnap.id, post);
            await docSnap.ref.update(Object.assign(Object.assign({}, update), { status: "ready", updatedAt: FieldValue.serverTimestamp() }));
        }
        catch (error) {
            console.error(`[generationTick] ${docSnap.id} failed:`, (0, core_1.stringifyError)(error));
            await handlePostFailure(docSnap.ref, post, (0, core_1.stringifyError)(error), "scheduled");
        }
    }
});
/** Publish ready posts that are due, and poll in-flight Post Bridge posts. */
exports.postingTick = (0, scheduler_1.onSchedule)({
    schedule: "every 1 minutes",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [postbridge_1.postBridgeApiKey],
}, async () => {
    var _a, _b, _c, _d, _e, _f;
    const now = Timestamp.now();
    // 1) Ready + due -> submit to Post Bridge
    const readySnap = await core_1.db
        .collection("posts")
        .where("status", "==", "ready")
        .where("scheduledFor", "<=", now)
        .limit(20)
        .get();
    for (const docSnap of readySnap.docs) {
        const post = docSnap.data();
        // Honor retry backoff
        if (post.nextAttemptAt && post.nextAttemptAt.toMillis() > Date.now())
            continue;
        const claimed = await core_1.db.runTransaction(async (tx) => {
            var _a;
            const fresh = await tx.get(docSnap.ref);
            if (((_a = fresh.data()) === null || _a === void 0 ? void 0 : _a.status) !== "ready")
                return false;
            tx.update(docSnap.ref, {
                status: "posting",
                attempts: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
            });
            return true;
        });
        if (!claimed)
            continue;
        try {
            // Upload media to Post Bridge
            const mediaIds = [];
            for (const media of (_a = post.media) !== null && _a !== void 0 ? _a : []) {
                if (media.pbMediaId) {
                    mediaIds.push(media.pbMediaId);
                    continue;
                }
                if (!media.storagePath)
                    continue;
                const [buffer] = await (0, core_2.getBucket)().file(media.storagePath).download();
                const mime = media.type === "video" ? "video/mp4" : "image/png";
                const pbMediaId = await (0, postbridge_1.pbUploadMediaFromBuffer)(buffer, mime, (_b = media.storagePath.split("/").pop()) !== null && _b !== void 0 ? _b : "media");
                mediaIds.push(pbMediaId);
            }
            const { id: pbPostId, dryRun } = await (0, postbridge_1.pbCreatePost)({
                caption: (_d = (_c = post.content) === null || _c === void 0 ? void 0 : _c.caption) !== null && _d !== void 0 ? _d : post.brief,
                socialAccountIds: post.socialAccountIds,
                mediaIds,
            });
            await docSnap.ref.update({
                "pb.postId": pbPostId,
                "pb.dryRun": dryRun,
                "pb.submittedAt": FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
        catch (error) {
            console.error(`[postingTick] submit ${docSnap.id} failed:`, (0, core_1.stringifyError)(error));
            await handlePostFailure(docSnap.ref, post, (0, core_1.stringifyError)(error), "ready");
        }
    }
    // 2) Poll in-flight posts for final status
    const postingSnap = await core_1.db
        .collection("posts")
        .where("status", "==", "posting")
        .limit(30)
        .get();
    for (const docSnap of postingSnap.docs) {
        const post = docSnap.data();
        if (!((_e = post.pb) === null || _e === void 0 ? void 0 : _e.postId))
            continue; // will be retried by failure path
        try {
            const pbPost = await (0, postbridge_1.pbGetPost)(post.pb.postId);
            const status = (pbPost.status || "").toLowerCase();
            if (status === "posted" || status === "published" || status === "success") {
                const results = post.platforms.map((platform) => {
                    var _a;
                    const match = (_a = pbPost.results) === null || _a === void 0 ? void 0 : _a.find((r) => r.platform === platform);
                    return Object.assign({ platform, status: "posted" }, ((match === null || match === void 0 ? void 0 : match.url) ? { permalink: match.url } : {}));
                });
                await docSnap.ref.update({
                    status: "posted",
                    results,
                    error: FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                if (post.automationId) {
                    await core_1.db.collection("automations").doc(post.automationId).update({
                        failureCount: 0,
                    });
                }
            }
            else if (status === "failed" || status === "error") {
                const reason = ((_f = pbPost.results) === null || _f === void 0 ? void 0 : _f.map((r) => r.error).filter(Boolean).join("; ")) ||
                    "Post Bridge reported failure";
                await handlePostFailure(docSnap.ref, post, reason, "ready");
            }
            // otherwise still processing — poll again next tick
        }
        catch (error) {
            console.error(`[postingTick] poll ${docSnap.id} failed:`, (0, core_1.stringifyError)(error));
        }
    }
    if ((0, postbridge_1.isDryRun)()) {
        console.log("[postingTick] running in DRY-RUN mode (no POST_BRIDGE_API_KEY)");
    }
});
/** Shared retry/backoff + terminal-failure handling. */
async function handlePostFailure(ref, post, message, retryStatus) {
    var _a, _b, _c, _d;
    const attempts = ((_a = post.attempts) !== null && _a !== void 0 ? _a : 0) + 1;
    const maxAttempts = (_b = post.maxAttempts) !== null && _b !== void 0 ? _b : 3;
    if (attempts < maxAttempts) {
        const delay = RETRY_DELAYS_MINUTES[Math.min(attempts - 1, RETRY_DELAYS_MINUTES.length - 1)];
        await ref.update({
            status: retryStatus,
            error: message,
            nextAttemptAt: minutesFromNow(delay),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return;
    }
    await ref.update({
        status: "failed",
        error: message,
        updatedAt: FieldValue.serverTimestamp(),
    });
    if (post.automationId) {
        const automationRef = core_1.db.collection("automations").doc(post.automationId);
        const snap = await automationRef.get();
        const failureCount = ((_d = (_c = snap.data()) === null || _c === void 0 ? void 0 : _c.failureCount) !== null && _d !== void 0 ? _d : 0) + 1;
        await automationRef.update(Object.assign(Object.assign({ failureCount, lastError: message }, (failureCount >= MAX_CONSECUTIVE_AUTOMATION_FAILURES
            ? { status: "error" }
            : {})), { updatedAt: FieldValue.serverTimestamp() }));
    }
}
//# sourceMappingURL=scheduler.js.map