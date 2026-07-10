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
exports.getQuota = exports.regeneratePostContent = exports.cancelPost = exports.retryPost = exports.approvePost = exports.generatePreviewContent = exports.runAutomationNow = exports.updateAutomation = exports.createAutomation = exports.syncSocialAccounts = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const core_1 = require("./core");
const schedule_math_1 = require("./schedule-math");
const generation_1 = require("./generation");
const postbridge_1 = require("./postbridge");
const quota_1 = require("./quota");
const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;
const SUPPORTED_PLATFORMS = ["instagram", "twitter", "linkedin"];
/**
 * Sync the Post Bridge workspace's linked accounts into `socialAccounts`
 * for the calling user. (Account linking itself happens in the Post Bridge
 * dashboard — concierge flow for pilot enterprises.)
 */
exports.syncSocialAccounts = (0, https_1.onCall)({ cors: true, secrets: [postbridge_1.postBridgeApiKey] }, async (request) => {
    var _a, _b, _c, _d;
    const uid = (0, core_1.requireAuth)(request);
    try {
        const accounts = await (0, postbridge_1.pbListAccounts)();
        const relevant = accounts.filter((a) => SUPPORTED_PLATFORMS.includes(a.platform));
        const batch = core_1.db.batch();
        for (const account of relevant) {
            const ref = core_1.db.collection("socialAccounts").doc(`${uid}_${account.id}`);
            batch.set(ref, {
                userId: uid,
                provider: "postbridge",
                pbAccountId: account.id,
                platform: account.platform,
                username: (_a = account.username) !== null && _a !== void 0 ? _a : "",
                displayName: (_c = (_b = account.display_name) !== null && _b !== void 0 ? _b : account.username) !== null && _c !== void 0 ? _c : "",
                avatarUrl: (_d = account.profile_picture_url) !== null && _d !== void 0 ? _d : "",
                status: "active",
                linkedAt: FieldValue.serverTimestamp(),
                lastSyncedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        await batch.commit();
        return { synced: relevant.length, dryRun: (0, postbridge_1.isDryRun)() };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", (0, core_1.stringifyError)(error));
    }
});
function validateAutomationInput(data) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!((_a = data.name) === null || _a === void 0 ? void 0 : _a.trim()))
        throw new https_1.HttpsError("invalid-argument", "Name is required");
    if (!((_b = data.brief) === null || _b === void 0 ? void 0 : _b.trim()))
        throw new https_1.HttpsError("invalid-argument", "A content brief is required");
    if (!((_c = data.platforms) === null || _c === void 0 ? void 0 : _c.length))
        throw new https_1.HttpsError("invalid-argument", "Select at least one platform");
    if (data.platforms.some((p) => !SUPPORTED_PLATFORMS.includes(p))) {
        throw new https_1.HttpsError("invalid-argument", "Unsupported platform");
    }
    if (!((_d = data.socialAccountIds) === null || _d === void 0 ? void 0 : _d.length)) {
        throw new https_1.HttpsError("invalid-argument", "Select at least one connected account");
    }
    if (!/^\d{2}:\d{2}$/.test((_f = (_e = data.schedule) === null || _e === void 0 ? void 0 : _e.time) !== null && _f !== void 0 ? _f : "")) {
        throw new https_1.HttpsError("invalid-argument", "Schedule time must be HH:mm");
    }
    if (!((_g = data.schedule) === null || _g === void 0 ? void 0 : _g.timezone)) {
        throw new https_1.HttpsError("invalid-argument", "Schedule timezone is required");
    }
}
exports.createAutomation = (0, https_1.onCall)({ cors: true }, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    const uid = (0, core_1.requireAuth)(request);
    const data = request.data;
    validateAutomationInput(data);
    const schedule = Object.assign(Object.assign({ type: (_a = data.schedule.type) !== null && _a !== void 0 ? _a : "recurring", time: data.schedule.time }, (((_b = data.schedule.daysOfWeek) === null || _b === void 0 ? void 0 : _b.length) ? { daysOfWeek: data.schedule.daysOfWeek } : {})), { timezone: data.schedule.timezone });
    let nextRunAt;
    try {
        nextRunAt = (0, schedule_math_1.computeNextRunAt)(schedule);
    }
    catch (error) {
        throw new https_1.HttpsError("invalid-argument", (0, core_1.stringifyError)(error));
    }
    if (!nextRunAt) {
        throw new https_1.HttpsError("invalid-argument", "Schedule never fires");
    }
    const status = (_c = data.status) !== null && _c !== void 0 ? _c : "active";
    if (status === "active") {
        await (0, quota_1.assertPostQuota)(uid);
    }
    const automation = Object.assign(Object.assign({ userId: uid }, (data.brandProfileId ? { brandProfileId: data.brandProfileId } : {})), { name: data.name.trim(), status, brief: data.brief.trim(), platforms: data.platforms, socialAccountIds: data.socialAccountIds, contentTypes: {
            text: true,
            image: !!((_d = data.contentTypes) === null || _d === void 0 ? void 0 : _d.image),
            video: !!((_e = data.contentTypes) === null || _e === void 0 ? void 0 : _e.video),
        }, preset: data.preset || "custom", tone: data.tone || "", schedule, nextRunAt: Timestamp.fromDate(nextRunAt), runCount: 0, failureCount: 0, generateLeadMinutes: ((_f = data.contentTypes) === null || _f === void 0 ? void 0 : _f.video) ? 120 : 30, requiresApproval: !!data.requiresApproval });
    const ref = await core_1.db.collection("automations").add(Object.assign(Object.assign({}, automation), { createdAt: FieldValue.serverTimestamp() }));
    return { id: ref.id, nextRunAt: nextRunAt.toISOString() };
});
exports.updateAutomation = (0, https_1.onCall)({ cors: true }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const uid = (0, core_1.requireAuth)(request);
    const data = request.data;
    if (!data.id)
        throw new https_1.HttpsError("invalid-argument", "Automation id is required");
    validateAutomationInput(data);
    const ref = core_1.db.collection("automations").doc(data.id);
    const snap = await ref.get();
    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.userId) !== uid) {
        throw new https_1.HttpsError("not-found", "Automation not found");
    }
    const schedule = Object.assign(Object.assign({ type: (_b = data.schedule.type) !== null && _b !== void 0 ? _b : "recurring", time: data.schedule.time }, (((_c = data.schedule.daysOfWeek) === null || _c === void 0 ? void 0 : _c.length) ? { daysOfWeek: data.schedule.daysOfWeek } : {})), { timezone: data.schedule.timezone });
    const nextRunAt = (0, schedule_math_1.computeNextRunAt)(schedule);
    if (!nextRunAt)
        throw new https_1.HttpsError("invalid-argument", "Schedule never fires");
    await ref.update(Object.assign(Object.assign({ name: data.name.trim(), brief: data.brief.trim(), brandProfileId: (_d = data.brandProfileId) !== null && _d !== void 0 ? _d : FieldValue.delete(), platforms: data.platforms, socialAccountIds: data.socialAccountIds, contentTypes: {
            text: true,
            image: !!((_e = data.contentTypes) === null || _e === void 0 ? void 0 : _e.image),
            video: !!((_f = data.contentTypes) === null || _f === void 0 ? void 0 : _f.video),
        }, preset: data.preset || "custom", tone: data.tone || "", schedule, nextRunAt: Timestamp.fromDate(nextRunAt), generateLeadMinutes: ((_g = data.contentTypes) === null || _g === void 0 ? void 0 : _g.video) ? 120 : 30, requiresApproval: !!data.requiresApproval }, (data.status ? { status: data.status } : {})), { updatedAt: FieldValue.serverTimestamp() }));
    return { id: data.id, nextRunAt: nextRunAt.toISOString() };
});
/**
 * Create an immediate post from an automation and generate its content now.
 * The postingTick publishes it within a minute. Primary demo/testing path.
 */
exports.runAutomationNow = (0, https_1.onCall)({ cors: true, timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const { automationId } = request.data;
    if (!automationId)
        throw new https_1.HttpsError("invalid-argument", "automationId is required");
    const snap = await core_1.db.collection("automations").doc(automationId).get();
    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.userId) !== uid) {
        throw new https_1.HttpsError("not-found", "Automation not found");
    }
    const automation = snap.data();
    await (0, quota_1.assertPostQuota)(uid);
    const now = new Date();
    const postRef = core_1.db.collection("posts").doc();
    const post = {
        userId: uid,
        automationId,
        brandProfileId: automation.brandProfileId,
        source: "automation",
        scheduledFor: Timestamp.fromDate(now),
        timezone: automation.schedule.timezone,
        status: "generating",
        brief: automation.brief,
        contentTypes: automation.contentTypes,
        preset: automation.preset,
        tone: automation.tone,
        platforms: automation.platforms,
        socialAccountIds: automation.socialAccountIds,
        attempts: 0,
        maxAttempts: 3,
    };
    await postRef.set(Object.assign(Object.assign({}, post), { createdAt: FieldValue.serverTimestamp() }));
    await (0, quota_1.incrementPostUsage)(uid);
    try {
        const update = await (0, generation_1.generatePostAssets)(postRef.id, post);
        const finalStatus = automation.requiresApproval ? "pending_approval" : "ready";
        await postRef.update(Object.assign(Object.assign({}, update), { status: finalStatus, updatedAt: FieldValue.serverTimestamp() }));
        return { postId: postRef.id, status: finalStatus };
    }
    catch (error) {
        await postRef.update({
            status: "failed",
            error: (0, core_1.stringifyError)(error),
            updatedAt: FieldValue.serverTimestamp(),
        });
        throw new https_1.HttpsError("internal", (0, core_1.stringifyError)(error));
    }
});
/** Generate a one-off sample post (caption only) for wizard/onboarding previews. */
exports.generatePreviewContent = (0, https_1.onCall)({ cors: true, timeoutSeconds: 120 }, async (request) => {
    (0, core_1.requireAuth)(request);
    const { brief, platform, preset, tone, brandProfileId } = request.data;
    if (!(brief === null || brief === void 0 ? void 0 : brief.trim()))
        throw new https_1.HttpsError("invalid-argument", "brief is required");
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
        throw new https_1.HttpsError("invalid-argument", "Unsupported platform");
    }
    let brand = null;
    if (brandProfileId) {
        const snap = await core_1.db.collection("brandProfiles").doc(brandProfileId).get();
        brand = snap.exists ? snap.data() : null;
    }
    try {
        const result = await (0, generation_1.generateCaptionForPlatform)({
            brand,
            brief,
            preset: preset || "custom",
            tone: tone || "",
            platform,
        });
        return result;
    }
    catch (error) {
        throw new https_1.HttpsError("internal", (0, core_1.stringifyError)(error));
    }
});
async function getOwnedPost(uid, postId) {
    var _a;
    const ref = core_1.db.collection("posts").doc(postId);
    const snap = await ref.get();
    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.userId) !== uid) {
        throw new https_1.HttpsError("not-found", "Post not found");
    }
    return { ref, post: snap.data() };
}
exports.approvePost = (0, https_1.onCall)({ cors: true }, async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (post.status !== "pending_approval") {
        throw new https_1.HttpsError("failed-precondition", "Post is not awaiting approval");
    }
    // Approved posts with content go straight to ready; otherwise generate first
    await ref.update({
        status: ((_a = post.content) === null || _a === void 0 ? void 0 : _a.caption) ? "ready" : "scheduled",
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
});
exports.retryPost = (0, https_1.onCall)({ cors: true }, async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (post.status !== "failed") {
        throw new https_1.HttpsError("failed-precondition", "Only failed posts can be retried");
    }
    await ref.update({
        status: ((_a = post.content) === null || _a === void 0 ? void 0 : _a.caption) ? "ready" : "scheduled",
        attempts: 0,
        error: FieldValue.delete(),
        nextAttemptAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
});
exports.cancelPost = (0, https_1.onCall)({ cors: true }, async (request) => {
    const uid = (0, core_1.requireAuth)(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (["posted", "posting"].includes(post.status)) {
        throw new https_1.HttpsError("failed-precondition", "Post is already publishing or published");
    }
    await ref.update({ status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
});
exports.regeneratePostContent = (0, https_1.onCall)({ cors: true, timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
    const uid = (0, core_1.requireAuth)(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (!["ready", "failed", "pending_approval", "scheduled", "draft"].includes(post.status)) {
        throw new https_1.HttpsError("failed-precondition", "Post content cannot be regenerated right now");
    }
    try {
        const update = await (0, generation_1.generatePostAssets)(request.data.postId, post);
        await ref.update(Object.assign(Object.assign({}, update), { updatedAt: FieldValue.serverTimestamp() }));
        return { success: true, content: update.content };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", (0, core_1.stringifyError)(error));
    }
});
exports.getQuota = (0, https_1.onCall)({ cors: true }, async (request) => {
    const uid = (0, core_1.requireAuth)(request);
    return (0, quota_1.getPostQuota)(uid);
});
//# sourceMappingURL=callables.js.map