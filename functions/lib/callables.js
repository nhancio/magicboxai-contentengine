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
exports.getQuota = exports.regeneratePostContent = exports.cancelPost = exports.retryPost = exports.approvePost = exports.generatePreviewContent = exports.createManualPost = exports.runAutomationNow = exports.setAutomationStatus = exports.updateAutomation = exports.createAutomation = exports.syncBillingClaims = void 0;
exports.assertOwnedPublishingResources = assertOwnedPublishingResources;
exports.createPostWithQuotaReservation = createPostWithQuotaReservation;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const core_1 = require("./core");
const schedule_math_1 = require("./schedule-math");
const generation_1 = require("./generation");
const brevo_1 = require("./brevo");
const quota_1 = require("./quota");
const publishing_1 = require("./publishing");
const entitlements_1 = require("./entitlements");
const Timestamp = admin.firestore.Timestamp;
const FieldValue = admin.firestore.FieldValue;
const SUPPORTED_PLATFORMS = ["instagram", "linkedin", "youtube"];
const MAX_POST_ATTEMPTS = 3;
/**
 * Synchronize the billing entitlement used by Convex. Firestore is the
 * authoritative Stripe/webhook store; the signed custom claims let Convex
 * enforce the same entitlement without trusting client-supplied plan data.
 */
exports.syncBillingClaims = (0, https_1.onCall)(Object.assign({}, core_1.callableSecurity), async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const snapshot = await core_1.db.collection("subscriptions").doc(uid).get();
    const data = snapshot.data();
    const plan = (data === null || data === void 0 ? void 0 : data.plan) === "pro" || (data === null || data === void 0 ? void 0 : data.plan) === "max" ? data.plan : "free";
    const status = (data === null || data === void 0 ? void 0 : data.status) === "active" || (data === null || data === void 0 ? void 0 : data.status) === "past_due" || (data === null || data === void 0 ? void 0 : data.status) === "cancelled"
        ? data.status
        : "inactive";
    const user = await admin.auth().getUser(uid);
    const existing = (_a = user.customClaims) !== null && _a !== void 0 ? _a : {};
    await admin.auth().setCustomUserClaims(uid, Object.assign(Object.assign({}, existing), { magicboxPlan: plan, magicboxSubscriptionStatus: status }));
    return { plan, status, hasPaidPlan: (plan === "pro" || plan === "max") && status === "active" };
});
function isSupportedPlatform(value) {
    return typeof value === "string" && SUPPORTED_PLATFORMS.includes(value);
}
function validateResourceSelection(input) {
    if (!Array.isArray(input.platforms) || input.platforms.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Select at least one platform");
    }
    if (input.platforms.length > SUPPORTED_PLATFORMS.length ||
        input.platforms.some((platform) => !isSupportedPlatform(platform)) ||
        new Set(input.platforms).size !== input.platforms.length) {
        throw new https_1.HttpsError("invalid-argument", "Platforms must be unique Instagram, LinkedIn, or YouTube values");
    }
    if (!Array.isArray(input.socialAccountIds) || input.socialAccountIds.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Select at least one connected account");
    }
    if (input.socialAccountIds.length > 20 ||
        input.socialAccountIds.some((id) => typeof id !== "string" || id.length === 0 || id.length > 300 || id.includes("/")) ||
        new Set(input.socialAccountIds).size !== input.socialAccountIds.length) {
        throw new https_1.HttpsError("invalid-argument", "Connected account ids must be unique and valid");
    }
    return {
        platforms: [...input.platforms],
        socialAccountIds: [...input.socialAccountIds],
    };
}
async function getOwnedBrandProfile(uid, brandProfileId) {
    var _a;
    if (!brandProfileId)
        return null;
    if (typeof brandProfileId !== "string" ||
        brandProfileId.length > 300 ||
        brandProfileId.includes("/")) {
        throw new https_1.HttpsError("invalid-argument", "Brand profile id is invalid");
    }
    const snap = await core_1.db.collection("brandProfiles").doc(brandProfileId).get();
    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.userId) !== uid) {
        throw new https_1.HttpsError("permission-denied", "Brand profile is unavailable");
    }
    return snap.data();
}
/**
 * Tenant boundary shared by callables and the scheduler. Account ownership,
 * active state, provider/platform consistency, and brand ownership are all
 * checked server-side; caller-supplied ids are never trusted by themselves.
 */
async function assertOwnedPublishingResources(uid, input) {
    const selection = validateResourceSelection(input);
    const [brand, accountSnaps] = await Promise.all([
        getOwnedBrandProfile(uid, input.brandProfileId),
        Promise.all(selection.socialAccountIds.map((id) => core_1.db.collection("socialAccounts").doc(id).get())),
    ]);
    const accountPlatforms = new Set();
    for (const snap of accountSnaps) {
        const account = snap.data();
        if (!snap.exists ||
            (account === null || account === void 0 ? void 0 : account.userId) !== uid ||
            account.status !== "active" ||
            !isSupportedPlatform(account.platform) ||
            account.provider !== account.platform) {
            throw new https_1.HttpsError("permission-denied", "One or more connected accounts is unavailable");
        }
        accountPlatforms.add(account.platform);
    }
    const selectedPlatforms = new Set(selection.platforms);
    if ([...accountPlatforms].some((platform) => !selectedPlatforms.has(platform)) ||
        selection.platforms.some((platform) => !accountPlatforms.has(platform))) {
        throw new https_1.HttpsError("invalid-argument", "Selected platforms must exactly match the connected accounts");
    }
    return Object.assign(Object.assign({}, selection), { brand });
}
function validateAutomationInput(data) {
    var _a, _b, _c, _d, _e;
    if (!data || typeof data !== "object") {
        throw new https_1.HttpsError("invalid-argument", "Automation data is required");
    }
    if (!((_a = data.name) === null || _a === void 0 ? void 0 : _a.trim()) || data.name.trim().length > 120) {
        throw new https_1.HttpsError("invalid-argument", "Name is required and must be at most 120 characters");
    }
    if (!((_b = data.brief) === null || _b === void 0 ? void 0 : _b.trim()) || data.brief.trim().length > 4000) {
        throw new https_1.HttpsError("invalid-argument", "A content brief is required and must be at most 4,000 characters");
    }
    if (data.status !== undefined &&
        data.status !== "active" &&
        data.status !== "paused" &&
        data.status !== "draft") {
        throw new https_1.HttpsError("invalid-argument", "Automation status is invalid");
    }
    if (typeof data.preset !== "string" ||
        data.preset.length > 100 ||
        typeof data.tone !== "string" ||
        data.tone.length > 500) {
        throw new https_1.HttpsError("invalid-argument", "Automation preset or tone is invalid");
    }
    validateResourceSelection(data);
    const timeMatch = (_d = (_c = data.schedule) === null || _c === void 0 ? void 0 : _c.time) === null || _d === void 0 ? void 0 : _d.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) {
        throw new https_1.HttpsError("invalid-argument", "Schedule time must be HH:mm");
    }
    if (data.schedule.type !== "recurring" && data.schedule.type !== "once") {
        throw new https_1.HttpsError("invalid-argument", "Schedule type is invalid");
    }
    if (data.schedule.daysOfWeek &&
        (!Array.isArray(data.schedule.daysOfWeek) ||
            new Set(data.schedule.daysOfWeek).size !== data.schedule.daysOfWeek.length ||
            data.schedule.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) {
        throw new https_1.HttpsError("invalid-argument", "Schedule days must be unique values from 0 to 6");
    }
    if (!((_e = data.schedule) === null || _e === void 0 ? void 0 : _e.timezone) || data.schedule.timezone.length > 100) {
        throw new https_1.HttpsError("invalid-argument", "Schedule timezone is required");
    }
    try {
        new Intl.DateTimeFormat("en", { timeZone: data.schedule.timezone }).format();
    }
    catch (_f) {
        throw new https_1.HttpsError("invalid-argument", "Schedule timezone must be a valid IANA timezone");
    }
}
function currentMonthKey() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
async function assertActiveAutomationAccess(uid) {
    const snap = await core_1.db.collection("subscriptions").doc(uid).get();
    if (!snap.exists || (0, entitlements_1.activePaidPostEntitlement)(snap.data()) === null) {
        throw new https_1.HttpsError("permission-denied", "An active, unexpired paid subscription is required");
    }
    await (0, quota_1.assertPostQuota)(uid);
}
function isSameReservedPost(existing, uid, post) {
    const data = existing;
    return ((data === null || data === void 0 ? void 0 : data.userId) === uid &&
        data.source === post.source &&
        (post.idempotencyKey === undefined || data.idempotencyKey === post.idempotencyKey));
}
/**
 * Atomically create a post and reserve one monthly quota unit. Returning false
 * means this exact idempotent post already exists and was previously reserved.
 */
async function createPostWithQuotaReservation(uid, ref, post) {
    // Avoid blocking recovery after a scheduler crash that created the post but
    // did not yet advance the automation. The transaction repeats this check to
    // close the race with another tick.
    const existing = await ref.get();
    if (existing.exists) {
        if (!isSameReservedPost(existing.data(), uid, post)) {
            throw new https_1.HttpsError("already-exists", "Post reservation id is already in use");
        }
        return false;
    }
    const month = currentMonthKey();
    try {
        return await core_1.db.runTransaction(async (tx) => {
            var _a;
            const userRef = core_1.db.collection("users").doc(uid);
            const subscriptionRef = core_1.db.collection("subscriptions").doc(uid);
            const [postSnap, subscriptionSnap, userSnap] = await Promise.all([
                tx.get(ref),
                tx.get(subscriptionRef),
                tx.get(userRef),
            ]);
            if (postSnap.exists) {
                if (!isSameReservedPost(postSnap.data(), uid, post)) {
                    throw new https_1.HttpsError("already-exists", "Post reservation id is already in use");
                }
                return false;
            }
            const entitlement = (0, entitlements_1.activePaidPostEntitlement)(subscriptionSnap.data());
            if (!entitlement) {
                throw new https_1.HttpsError("permission-denied", "An active, unexpired paid subscription is required");
            }
            const usage = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.usage;
            const rawUsed = (usage === null || usage === void 0 ? void 0 : usage.month) === month ? usage.postsThisMonth : 0;
            if (rawUsed !== undefined &&
                (typeof rawUsed !== "number" || !Number.isFinite(rawUsed) || rawUsed < 0)) {
                throw new https_1.HttpsError("failed-precondition", "Monthly usage record is invalid");
            }
            const used = rawUsed === undefined ? 0 : Math.floor(rawUsed);
            if (used >= entitlement.limit) {
                throw new https_1.HttpsError("resource-exhausted", "Monthly post limit reached");
            }
            tx.create(ref, Object.assign(Object.assign({}, post), { createdAt: FieldValue.serverTimestamp() }));
            tx.set(userRef, {
                usage: {
                    month,
                    postsThisMonth: used + 1,
                    updatedAt: FieldValue.serverTimestamp(),
                },
            }, { merge: true });
            return true;
        });
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) === "resource-exhausted") {
            await (0, quota_1.notifyUsageLimitReached)(uid);
        }
        throw error;
    }
}
function normalizeManualContent(value, platforms) {
    if (value === undefined)
        return undefined;
    if (!value || typeof value !== "object") {
        throw new https_1.HttpsError("invalid-argument", "Post content is invalid");
    }
    if (typeof value.caption !== "string" || !value.caption.trim() || value.caption.length > 10000) {
        throw new https_1.HttpsError("invalid-argument", "A non-empty caption of at most 10,000 characters is required");
    }
    if (value.hashtags !== undefined &&
        (!Array.isArray(value.hashtags) ||
            value.hashtags.length > 30 ||
            value.hashtags.some((tag) => typeof tag !== "string" || tag.length === 0 || tag.length > 100))) {
        throw new https_1.HttpsError("invalid-argument", "Hashtags are invalid");
    }
    const perPlatform = {};
    if (value.perPlatform !== undefined) {
        if (!value.perPlatform || typeof value.perPlatform !== "object" || Array.isArray(value.perPlatform)) {
            throw new https_1.HttpsError("invalid-argument", "Per-platform content is invalid");
        }
        const selected = new Set(platforms);
        for (const [platform, entry] of Object.entries(value.perPlatform)) {
            const caption = entry === null || entry === void 0 ? void 0 : entry.caption;
            if (!isSupportedPlatform(platform) ||
                !selected.has(platform) ||
                typeof caption !== "string" ||
                !caption.trim() ||
                caption.length > 10000) {
                throw new https_1.HttpsError("invalid-argument", "Per-platform content is invalid");
            }
            perPlatform[platform] = { caption: caption.trim() };
        }
    }
    return Object.assign({ caption: value.caption.trim(), hashtags: Array.isArray(value.hashtags) ? [...value.hashtags] : [] }, (Object.keys(perPlatform).length ? { perPlatform } : {}));
}
async function normalizeManualMedia(uid, value) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value) || value.length > 10) {
        throw new https_1.HttpsError("invalid-argument", "At most 10 media items are allowed");
    }
    return Promise.all(value.map(async (item) => {
        var _a, _b;
        if ((item === null || item === void 0 ? void 0 : item.type) !== "image" && (item === null || item === void 0 ? void 0 : item.type) !== "video") {
            throw new https_1.HttpsError("invalid-argument", "Media type must be image or video");
        }
        if (typeof item.url !== "string") {
            throw new https_1.HttpsError("invalid-argument", "Media URL is required");
        }
        const storagePath = (0, publishing_1.trustedStoragePathFromUrl)(item.url);
        if (!storagePath ||
            !storagePath.startsWith(`users/${uid}/`) ||
            (item.storagePath !== undefined && item.storagePath !== storagePath)) {
            throw new https_1.HttpsError("permission-denied", "Media must be an upload owned by the signed-in user");
        }
        let metadata;
        try {
            [metadata] = await (0, core_1.getBucket)().file(storagePath).getMetadata();
        }
        catch (_c) {
            throw new https_1.HttpsError("invalid-argument", "Media object does not exist");
        }
        const expectedPrefix = item.type === "image" ? "image/" : "video/";
        if (!((_a = metadata.contentType) === null || _a === void 0 ? void 0 : _a.startsWith(expectedPrefix))) {
            throw new https_1.HttpsError("invalid-argument", "Media type does not match the stored object");
        }
        const size = Number((_b = metadata.size) !== null && _b !== void 0 ? _b : 0);
        const maxSize = item.type === "image" ? 10 * 1024 * 1024 : 250 * 1024 * 1024;
        if (!Number.isFinite(size) || size <= 0 || size > maxSize) {
            throw new https_1.HttpsError("invalid-argument", "Media object size is not allowed");
        }
        return {
            type: item.type,
            storagePath,
            url: new URL(item.url).toString(),
            // The caller cannot claim server-only generation provenance.
            source: "upload",
        };
    }));
}
function parseManualSchedule(value) {
    if (typeof value !== "string" || value.length > 100) {
        throw new https_1.HttpsError("invalid-argument", "scheduledFor must be an ISO timestamp");
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
        throw new https_1.HttpsError("invalid-argument", "scheduledFor must be an ISO timestamp");
    }
    const now = Date.now();
    if (date.getTime() < now - 5 * 60000 || date.getTime() > now + 366 * 24 * 60 * 60000) {
        throw new https_1.HttpsError("invalid-argument", "scheduledFor must be between now and one year from now");
    }
    return date;
}
exports.createAutomation = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [brevo_1.brevoApiKey] }), async (request) => {
    var _a, _b, _c, _d, _e, _f;
    const uid = (0, core_1.requireAuth)(request);
    const data = request.data;
    validateAutomationInput(data);
    const resources = await assertOwnedPublishingResources(uid, data);
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
        await assertActiveAutomationAccess(uid);
    }
    const automation = Object.assign(Object.assign({ userId: uid }, (data.brandProfileId ? { brandProfileId: data.brandProfileId } : {})), { name: data.name.trim(), status, brief: data.brief.trim(), platforms: resources.platforms, socialAccountIds: resources.socialAccountIds, contentTypes: {
            text: true,
            image: !!((_d = data.contentTypes) === null || _d === void 0 ? void 0 : _d.image),
            video: !!((_e = data.contentTypes) === null || _e === void 0 ? void 0 : _e.video),
        }, preset: data.preset || "custom", tone: data.tone || "", schedule, nextRunAt: Timestamp.fromDate(nextRunAt), runCount: 0, failureCount: 0, generateLeadMinutes: ((_f = data.contentTypes) === null || _f === void 0 ? void 0 : _f.video) ? 120 : 30, requiresApproval: !!data.requiresApproval });
    const ref = await core_1.db.collection("automations").add(Object.assign(Object.assign({}, automation), { createdAt: FieldValue.serverTimestamp() }));
    return { id: ref.id, nextRunAt: nextRunAt.toISOString() };
});
exports.updateAutomation = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [brevo_1.brevoApiKey] }), async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const uid = (0, core_1.requireAuth)(request);
    const data = request.data;
    if (!data.id || data.id.includes("/")) {
        throw new https_1.HttpsError("invalid-argument", "Automation id is required");
    }
    validateAutomationInput(data);
    const ref = core_1.db.collection("automations").doc(data.id);
    const snap = await ref.get();
    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.userId) !== uid) {
        throw new https_1.HttpsError("not-found", "Automation not found");
    }
    const resources = await assertOwnedPublishingResources(uid, data);
    const resultingStatus = (_b = data.status) !== null && _b !== void 0 ? _b : (_c = snap.data()) === null || _c === void 0 ? void 0 : _c.status;
    if (resultingStatus === "active") {
        await assertActiveAutomationAccess(uid);
    }
    const schedule = Object.assign(Object.assign({ type: (_d = data.schedule.type) !== null && _d !== void 0 ? _d : "recurring", time: data.schedule.time }, (((_e = data.schedule.daysOfWeek) === null || _e === void 0 ? void 0 : _e.length) ? { daysOfWeek: data.schedule.daysOfWeek } : {})), { timezone: data.schedule.timezone });
    const nextRunAt = (0, schedule_math_1.computeNextRunAt)(schedule);
    if (!nextRunAt)
        throw new https_1.HttpsError("invalid-argument", "Schedule never fires");
    await ref.update(Object.assign(Object.assign({ name: data.name.trim(), brief: data.brief.trim(), brandProfileId: (_f = data.brandProfileId) !== null && _f !== void 0 ? _f : FieldValue.delete(), platforms: resources.platforms, socialAccountIds: resources.socialAccountIds, contentTypes: {
            text: true,
            image: !!((_g = data.contentTypes) === null || _g === void 0 ? void 0 : _g.image),
            video: !!((_h = data.contentTypes) === null || _h === void 0 ? void 0 : _h.video),
        }, preset: data.preset || "custom", tone: data.tone || "", schedule, nextRunAt: Timestamp.fromDate(nextRunAt), generateLeadMinutes: ((_j = data.contentTypes) === null || _j === void 0 ? void 0 : _j.video) ? 120 : 30, requiresApproval: !!data.requiresApproval }, (data.status ? { status: data.status } : {})), { updatedAt: FieldValue.serverTimestamp() }));
    return { id: data.id, nextRunAt: nextRunAt.toISOString() };
});
/** Pause or safely resume an automation without exposing lifecycle writes. */
exports.setAutomationStatus = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [brevo_1.brevoApiKey] }), async (request) => {
    var _a, _b;
    const uid = (0, core_1.requireAuth)(request);
    const { id, status } = (_a = request.data) !== null && _a !== void 0 ? _a : {};
    if (!id || id.includes("/") || (status !== "active" && status !== "paused")) {
        throw new https_1.HttpsError("invalid-argument", "Automation id and status are required");
    }
    const ref = core_1.db.collection("automations").doc(id);
    const snap = await ref.get();
    if (!snap.exists || ((_b = snap.data()) === null || _b === void 0 ? void 0 : _b.userId) !== uid) {
        throw new https_1.HttpsError("not-found", "Automation not found");
    }
    if (status === "active") {
        const automation = snap.data();
        await assertOwnedPublishingResources(uid, automation);
        await assertActiveAutomationAccess(uid);
    }
    await ref.update(Object.assign(Object.assign({ status }, (status === "active"
        ? { failureCount: 0, lastError: FieldValue.delete() }
        : {})), { updatedAt: FieldValue.serverTimestamp() }));
    return { success: true };
});
/**
 * Create an immediate post from an automation and generate its content now.
 * The postingTick publishes it within a minute. Primary demo/testing path.
 */
exports.runAutomationNow = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 300, memory: "1GiB", secrets: [brevo_1.brevoApiKey] }), async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const { automationId } = request.data;
    if (!automationId || automationId.includes("/")) {
        throw new https_1.HttpsError("invalid-argument", "automationId is required");
    }
    const snap = await core_1.db.collection("automations").doc(automationId).get();
    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.userId) !== uid) {
        throw new https_1.HttpsError("not-found", "Automation not found");
    }
    const automation = snap.data();
    const resources = await assertOwnedPublishingResources(uid, automation);
    const now = new Date();
    const postRef = core_1.db.collection("posts").doc();
    const post = Object.assign(Object.assign({ userId: uid, automationId }, (automation.brandProfileId ? { brandProfileId: automation.brandProfileId } : {})), { source: "automation", scheduledFor: Timestamp.fromDate(now), timezone: automation.schedule.timezone, status: "generating", brief: automation.brief, contentTypes: automation.contentTypes, preset: automation.preset, tone: automation.tone, platforms: resources.platforms, socialAccountIds: resources.socialAccountIds, attempts: 1, maxAttempts: MAX_POST_ATTEMPTS });
    await createPostWithQuotaReservation(uid, postRef, post);
    try {
        const update = await (0, generation_1.generatePostAssets)(postRef.id, post);
        const finalStatus = automation.requiresApproval ? "pending_approval" : "ready";
        await postRef.update(Object.assign(Object.assign({}, update), { status: finalStatus, attempts: 0, error: FieldValue.delete(), nextAttemptAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }));
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
/** Create a quota-reserved manual post without granting the client pipeline writes. */
exports.createManualPost = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [brevo_1.brevoApiKey] }), async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const data = request.data;
    if (!data || typeof data !== "object") {
        throw new https_1.HttpsError("invalid-argument", "Post data is required");
    }
    if (!((_a = data.brief) === null || _a === void 0 ? void 0 : _a.trim()) || data.brief.trim().length > 4000) {
        throw new https_1.HttpsError("invalid-argument", "A brief is required and must be at most 4,000 characters");
    }
    if (!data.timezone || data.timezone.length > 100) {
        throw new https_1.HttpsError("invalid-argument", "A valid timezone is required");
    }
    try {
        new Intl.DateTimeFormat("en", { timeZone: data.timezone }).format();
    }
    catch (_b) {
        throw new https_1.HttpsError("invalid-argument", "A valid IANA timezone is required");
    }
    const scheduledFor = parseManualSchedule(data.scheduledFor);
    const resources = await assertOwnedPublishingResources(uid, data);
    const content = normalizeManualContent(data.content, resources.platforms);
    const media = await normalizeManualMedia(uid, data.media);
    if (resources.platforms.includes("instagram") && media.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Instagram posts require an image or video");
    }
    if (resources.platforms.includes("youtube") &&
        !media.some((item) => item.type === "video")) {
        throw new https_1.HttpsError("invalid-argument", "YouTube posts require a video");
    }
    const postRef = core_1.db.collection("posts").doc();
    const status = content ? "ready" : "scheduled";
    const post = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ userId: uid }, (data.brandProfileId ? { brandProfileId: data.brandProfileId } : {})), { source: "manual", scheduledFor: Timestamp.fromDate(scheduledFor), timezone: data.timezone, status, brief: data.brief.trim() }), (content ? { content } : {})), (media.length ? { media } : {})), { contentTypes: { text: true, image: false, video: false }, platforms: resources.platforms, socialAccountIds: resources.socialAccountIds, attempts: 0, maxAttempts: MAX_POST_ATTEMPTS });
    await createPostWithQuotaReservation(uid, postRef, post);
    return { id: postRef.id, status };
});
/** Generate a one-off sample post (caption only) for wizard/onboarding previews. */
exports.generatePreviewContent = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 120 }), async (request) => {
    const uid = (0, core_1.requireAuth)(request);
    const { brief, platform, preset, tone, brandProfileId } = request.data;
    if (!(brief === null || brief === void 0 ? void 0 : brief.trim()) || brief.trim().length > 4000) {
        throw new https_1.HttpsError("invalid-argument", "brief is required and must be at most 4,000 characters");
    }
    if (!isSupportedPlatform(platform)) {
        throw new https_1.HttpsError("invalid-argument", "Unsupported platform");
    }
    const brand = await getOwnedBrandProfile(uid, brandProfileId);
    await (0, core_1.enforceCallableRateLimit)(uid, "preview-content", core_1.AI_RATE_LIMITS.textGeneration);
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
    if (!postId || typeof postId !== "string" || postId.includes("/")) {
        throw new https_1.HttpsError("invalid-argument", "Post id is required");
    }
    const ref = core_1.db.collection("posts").doc(postId);
    const snap = await ref.get();
    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.userId) !== uid) {
        throw new https_1.HttpsError("not-found", "Post not found");
    }
    return { ref, post: snap.data() };
}
exports.approvePost = (0, https_1.onCall)(Object.assign({}, core_1.callableSecurity), async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (post.status !== "pending_approval") {
        throw new https_1.HttpsError("failed-precondition", "Post is not awaiting approval");
    }
    await assertOwnedPublishingResources(uid, post);
    // Approved posts with content go straight to ready; otherwise generate first
    await ref.update({
        status: ((_a = post.content) === null || _a === void 0 ? void 0 : _a.caption) ? "ready" : "scheduled",
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
});
exports.retryPost = (0, https_1.onCall)(Object.assign({}, core_1.callableSecurity), async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (post.status !== "failed") {
        throw new https_1.HttpsError("failed-precondition", "Only failed posts can be retried");
    }
    await assertOwnedPublishingResources(uid, post);
    await ref.update({
        status: ((_a = post.content) === null || _a === void 0 ? void 0 : _a.caption) ? "ready" : "scheduled",
        attempts: 0,
        error: FieldValue.delete(),
        nextAttemptAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
});
exports.cancelPost = (0, https_1.onCall)(Object.assign({}, core_1.callableSecurity), async (request) => {
    const uid = (0, core_1.requireAuth)(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (["posted", "posting"].includes(post.status)) {
        throw new https_1.HttpsError("failed-precondition", "Post is already publishing or published");
    }
    await ref.update({ status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
});
exports.regeneratePostContent = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 300, memory: "1GiB" }), async (request) => {
    const uid = (0, core_1.requireAuth)(request);
    const { ref, post } = await getOwnedPost(uid, request.data.postId);
    if (!["ready", "failed", "pending_approval", "scheduled", "draft"].includes(post.status)) {
        throw new https_1.HttpsError("failed-precondition", "Post content cannot be regenerated right now");
    }
    await assertOwnedPublishingResources(uid, post);
    await (0, core_1.enforceCallableRateLimit)(uid, "post-regeneration", core_1.AI_RATE_LIMITS.postRegeneration);
    try {
        const update = await (0, generation_1.generatePostAssets)(request.data.postId, post);
        await ref.update(Object.assign(Object.assign({}, update), { updatedAt: FieldValue.serverTimestamp() }));
        return { success: true, content: update.content };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", (0, core_1.stringifyError)(error));
    }
});
exports.getQuota = (0, https_1.onCall)(Object.assign({}, core_1.callableSecurity), async (request) => {
    const uid = (0, core_1.requireAuth)(request);
    return (0, quota_1.getPostQuota)(uid);
});
//# sourceMappingURL=callables.js.map