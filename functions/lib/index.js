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
exports.generateUGCVideo = exports.generateAvatarVideo = exports.analyzeAvatarVideo = exports.analyzeAvatarPhotos = exports.analyzeImage = exports.generateScript = exports.generateImage = exports.renderRemotionVideo = exports.verifyAdminStatus = exports.setAdminRole = exports.createGuestCheckout = exports.stripeWebhook = exports.createStripePortal = exports.createStripeCheckout = exports.triggerWelcomeEmail = exports.claimGuestEntitlement = exports.onUserUpdatedClaimPendingEntitlement = exports.onUserCreatedSendWelcome = exports.generateBrandedPostImage = exports.extractBrandFromWebsite = exports.postingTick = exports.generationTick = exports.automationTick = exports.socialOAuthCallback = exports.disconnectSocialAccount = exports.getSocialConnectUrl = exports.syncBillingClaims = exports.getQuota = exports.regeneratePostContent = exports.cancelPost = exports.retryPost = exports.approvePost = exports.generatePreviewContent = exports.createManualPost = exports.runAutomationNow = exports.setAutomationStatus = exports.updateAutomation = exports.createAutomation = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
const uuid_1 = require("uuid");
const core_1 = require("./core");
const googleVeo_1 = require("./video/googleVeo");
const models_1 = require("./models");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Marketing automation suite
var callables_1 = require("./callables");
Object.defineProperty(exports, "createAutomation", { enumerable: true, get: function () { return callables_1.createAutomation; } });
Object.defineProperty(exports, "updateAutomation", { enumerable: true, get: function () { return callables_1.updateAutomation; } });
Object.defineProperty(exports, "setAutomationStatus", { enumerable: true, get: function () { return callables_1.setAutomationStatus; } });
Object.defineProperty(exports, "runAutomationNow", { enumerable: true, get: function () { return callables_1.runAutomationNow; } });
Object.defineProperty(exports, "createManualPost", { enumerable: true, get: function () { return callables_1.createManualPost; } });
Object.defineProperty(exports, "generatePreviewContent", { enumerable: true, get: function () { return callables_1.generatePreviewContent; } });
Object.defineProperty(exports, "approvePost", { enumerable: true, get: function () { return callables_1.approvePost; } });
Object.defineProperty(exports, "retryPost", { enumerable: true, get: function () { return callables_1.retryPost; } });
Object.defineProperty(exports, "cancelPost", { enumerable: true, get: function () { return callables_1.cancelPost; } });
Object.defineProperty(exports, "regeneratePostContent", { enumerable: true, get: function () { return callables_1.regeneratePostContent; } });
Object.defineProperty(exports, "getQuota", { enumerable: true, get: function () { return callables_1.getQuota; } });
var callables_2 = require("./callables");
Object.defineProperty(exports, "syncBillingClaims", { enumerable: true, get: function () { return callables_2.syncBillingClaims; } });
var social_1 = require("./social");
Object.defineProperty(exports, "getSocialConnectUrl", { enumerable: true, get: function () { return social_1.getSocialConnectUrl; } });
Object.defineProperty(exports, "disconnectSocialAccount", { enumerable: true, get: function () { return social_1.disconnectSocialAccount; } });
Object.defineProperty(exports, "socialOAuthCallback", { enumerable: true, get: function () { return social_1.socialOAuthCallback; } });
var scheduler_1 = require("./scheduler");
Object.defineProperty(exports, "automationTick", { enumerable: true, get: function () { return scheduler_1.automationTick; } });
Object.defineProperty(exports, "generationTick", { enumerable: true, get: function () { return scheduler_1.generationTick; } });
Object.defineProperty(exports, "postingTick", { enumerable: true, get: function () { return scheduler_1.postingTick; } });
var brand_1 = require("./brand");
Object.defineProperty(exports, "extractBrandFromWebsite", { enumerable: true, get: function () { return brand_1.extractBrandFromWebsite; } });
Object.defineProperty(exports, "generateBrandedPostImage", { enumerable: true, get: function () { return brand_1.generateBrandedPostImage; } });
var welcome_1 = require("./welcome");
Object.defineProperty(exports, "onUserCreatedSendWelcome", { enumerable: true, get: function () { return welcome_1.onUserCreatedSendWelcome; } });
Object.defineProperty(exports, "onUserUpdatedClaimPendingEntitlement", { enumerable: true, get: function () { return welcome_1.onUserUpdatedClaimPendingEntitlement; } });
Object.defineProperty(exports, "claimGuestEntitlement", { enumerable: true, get: function () { return welcome_1.claimGuestEntitlement; } });
Object.defineProperty(exports, "triggerWelcomeEmail", { enumerable: true, get: function () { return welcome_1.triggerWelcomeEmail; } });
var stripe_1 = require("./stripe");
Object.defineProperty(exports, "createStripeCheckout", { enumerable: true, get: function () { return stripe_1.createStripeCheckout; } });
Object.defineProperty(exports, "createStripePortal", { enumerable: true, get: function () { return stripe_1.createStripePortal; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripe_1.stripeWebhook; } });
Object.defineProperty(exports, "createGuestCheckout", { enumerable: true, get: function () { return stripe_1.createGuestCheckout; } });
const VEO_SYSTEM_PROMPTS = {
    avatarPreview: `You are MagicBox AI's avatar preview director for Veo.

Your job is to generate a short, realistic talking-head preview from a single reference image.

Rules:
- Preserve the person's identity from the reference image.
- Keep the framing vertical and social-first.
- Use subtle, believable facial motion and lip sync.
- Use a clean background and flattering soft light.
- Do not introduce extra props, extra people, or unrelated scene changes.
- The result should feel like a creator introducing themselves to camera.`,
    ugcProductVideo: `You are MagicBox AI's UGC product video director for Veo.

You generate a single-shot or lightly edited vertical short video using:
- one reference character image
- one product image context
- one spoken script

Creative objective:
- produce a convincing avatar-led UGC ad where the character looks like the reference person
- the character is clearly presenting the product
- the delivery feels native to TikTok / Reels / Shorts rather than cinematic brand film

Hard rules:
- Preserve identity from the supplied reference image.
- The character must face camera and speak the supplied script.
- The product must appear clearly and naturally in the scene.
- Show the character holding or presenting the product for an obvious portion of the clip.
- Keep body motion, hand motion, and lip sync realistic and restrained.
- Avoid surreal transformations, extra limbs, warped hands, floating props, or product swaps.
- Do not change the product category, color, or core appearance unless explicitly described in the product context.
- No subtitles burned into the video unless requested elsewhere.
- No cutaways that lose the character-product relationship for most of the clip.

Visual direction:
- mobile-first composition
- clean creator-style lighting
- natural room or studio setting
- realistic lens and skin texture
- strong product visibility without looking like a catalog shoot

Performance direction:
- conversational, persuasive, creator-style delivery
- gestures should support the spoken lines
- when the script mentions benefits, the product should be emphasized visually
- when possible, align hand positioning and eyeline with the product mention`,
};
const VEO_TEMPLATE_DIRECTIONS = {
    "template-product-explanation": {
        sceneStyle: "Creator demo setup with direct-to-camera explanation and clean product visibility.",
        pacing: "Steady, persuasive, informative pacing with no rushed gestures.",
        productHandling: "Hold the product near chest or shoulder level and angle it toward camera when key benefits are mentioned.",
        cameraBehavior: "Mostly medium framing with slight push-in energy, keeping the product and face visible together.",
    },
    "template-problem-solution": {
        sceneStyle: "Start with mild frustration or concern, then pivot into relief once the product is introduced.",
        pacing: "Hook fast, then settle into a clear before/after explanation.",
        productHandling: "Bring the product into frame at the moment of solution reveal and keep it visible during benefit explanation.",
        cameraBehavior: "Direct talking-head framing with one clear emphasis beat during the solution moment.",
    },
    "template-unboxing": {
        sceneStyle: "First-impression creator energy with tactile curiosity and natural excitement.",
        pacing: "Slightly quicker early beats, then slower when showing product details.",
        productHandling: "Show the product with both hands at first, then hold it naturally while reacting and speaking.",
        cameraBehavior: "Hands and product should stay in frame; avoid wide shots that hide the product reveal.",
    },
    "template-3-reasons": {
        sceneStyle: "List-style creator breakdown with clear structure and confident delivery.",
        pacing: "Distinct beat changes for each reason, with a clean emphasis at each transition.",
        productHandling: "Reposition or gesture to the product as each reason is discussed.",
        cameraBehavior: "Stable medium shot that keeps presenter and product consistently visible.",
    },
    "template-storytime": {
        sceneStyle: "Personal, anecdotal storytelling that feels intimate and authentic.",
        pacing: "Start conversational, build emotional momentum, then land on the product reveal.",
        productHandling: "Product appears naturally as the turning point in the story, not from the first frame.",
        cameraBehavior: "Direct vlog-like framing with warm, personal eye contact.",
    },
    "template-testimonial": {
        sceneStyle: "Satisfied customer energy with credible, low-hype confidence.",
        pacing: "Measured, believable pacing focused on trust and lived experience.",
        productHandling: "Keep the product visible as supporting proof while speaking about the result.",
        cameraBehavior: "Simple testimonial framing with minimal camera movement.",
    },
    "template-comparison": {
        sceneStyle: "Analytical creator review with clear winner-energy by the end.",
        pacing: "Structured comparison rhythm with clear verbal contrast points.",
        productHandling: "Keep the featured product dominant in frame and gesture as if contrasting it against alternatives.",
        cameraBehavior: "Front-facing comparison style shot with emphasis on product close presentation.",
    },
};
const getTemplateDirection = (templateId, templateName) => {
    const byId = templateId ? VEO_TEMPLATE_DIRECTIONS[templateId] : undefined;
    if (byId)
        return byId;
    return {
        sceneStyle: `${templateName} creator-style product presentation.`,
        pacing: "Natural short-form pacing with clear spoken beats.",
        productHandling: "Keep the product visible and naturally presented while speaking.",
        cameraBehavior: "Vertical social framing that preserves face and product visibility together.",
    };
};
const buildAvatarPreviewPrompt = (input) => [
    VEO_SYSTEM_PROMPTS.avatarPreview,
    "",
    "Character:",
    `- Avatar name: ${input.avatarName}`,
    `- Delivery style: ${input.personality || "warm, natural, creator-like"}`,
    "",
    "Scene brief:",
    `- A realistic talking-head preview where the character says: "Hello, this is your avatar. I am ${input.avatarName}."`,
    "- Look directly into camera.",
    "- Use subtle head motion, natural blinking, and a calm introduction.",
    "- Keep the result short, clean, and believable.",
].join("\n");
const buildUGCVideoPrompt = (input) => (() => {
    const direction = getTemplateDirection(input.templateId, input.templateName);
    return [
        VEO_SYSTEM_PROMPTS.ugcProductVideo,
        "",
        "Character input:",
        `- Avatar name: ${input.avatarName || "Creator"}`,
        `- Character summary: ${input.characterSummary || "Friendly, believable UGC creator"}`,
        "",
        "Template input:",
        `- Template id: ${input.templateId || "Not provided"}`,
        `- Template style: ${input.templateName}`,
        `- Scene direction: ${direction.sceneStyle}`,
        `- Pacing direction: ${direction.pacing}`,
        `- Product handling direction: ${direction.productHandling}`,
        `- Camera direction: ${direction.cameraBehavior}`,
        "",
        "Product input:",
        `- Product name: ${input.productName}`,
        `- Product description: ${input.productDescription || "Not provided"}`,
        `- Product image context: ${input.productImageAnalysis || "Use the uploaded product image as the source of truth for appearance and form factor."}`,
        "",
        "Performance requirements:",
        "- The character should visibly present the product while speaking.",
        "- Product-in-hand interaction should look natural, stable, and intentional.",
        "- Match gestures to the spoken claims and product mentions.",
        "",
        "Spoken script:",
        input.script,
    ].join("\n");
})();
const getAI = () => {
    const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
    return new genai_1.GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: "us-central1",
    });
};
const requireAuth = (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    return request.auth.uid;
};
const getBucket = () => admin.storage().bucket();
const assertCanGenerateVideo = (subscription) => {
    if (subscription.plan === "free") {
        throw new https_1.HttpsError("permission-denied", "A paid subscription is required to generate videos");
    }
    if (subscription.status && subscription.status !== "active") {
        throw new https_1.HttpsError("permission-denied", "Subscription is not active");
    }
    if (subscription.videosUsed >= subscription.videosLimit) {
        throw new https_1.HttpsError("resource-exhausted", "Monthly video generation limit reached");
    }
};
/** Atomically reserve a paid video before calling Veo, preventing quota races. */
const reserveVideoGeneration = async (uid) => {
    const ref = db.collection("subscriptions").doc(uid);
    await db.runTransaction(async (transaction) => {
        var _a, _b, _c;
        const snap = await transaction.get(ref);
        const data = snap.data();
        const plan = (_a = data === null || data === void 0 ? void 0 : data.plan) !== null && _a !== void 0 ? _a : "free";
        const storedLimit = (_b = data === null || data === void 0 ? void 0 : data.videosLimit) !== null && _b !== void 0 ? _b : 0;
        const configuredLimit = plan === "free" ? 0 : core_1.PLAN_VIDEO_LIMIT[plan];
        const rawUsed = data === null || data === void 0 ? void 0 : data.videosUsed;
        const subscription = {
            plan,
            videosUsed: typeof rawUsed === "number" && Number.isSafeInteger(rawUsed) && rawUsed >= 0
                ? rawUsed
                : 0,
            videosLimit: Number.isSafeInteger(storedLimit) && storedLimit > 0
                ? Math.min(storedLimit, configuredLimit)
                : 0,
            status: (_c = data === null || data === void 0 ? void 0 : data.status) !== null && _c !== void 0 ? _c : (plan === "free" ? "inactive" : "active"),
            currentPeriodEnd: data === null || data === void 0 ? void 0 : data.currentPeriodEnd,
        };
        assertCanGenerateVideo(subscription);
        transaction.set(ref, {
            videosUsed: subscription.videosUsed + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
};
/** Refund a failed reservation without ever taking a concurrent count negative. */
const releaseVideoGeneration = async (uid) => {
    const ref = db.collection("subscriptions").doc(uid);
    await db.runTransaction(async (transaction) => {
        var _a, _b;
        const snap = await transaction.get(ref);
        const used = Number((_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.videosUsed) !== null && _b !== void 0 ? _b : 0);
        transaction.set(ref, {
            videosUsed: Number.isSafeInteger(used) ? Math.max(0, used - 1) : 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
};
const stringifyError = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    try {
        return JSON.stringify(error);
    }
    catch (_a) {
        return "Unexpected error";
    }
};
const formatAIServiceError = (rawMessage) => {
    const message = rawMessage.trim();
    const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId || "your-project-id";
    if (/SERVICE_DISABLED/i.test(message) ||
        /aiplatform\.googleapis\.com/i.test(message) ||
        /Vertex AI API has not been used/i.test(message)) {
        return [
            `Vertex AI API is disabled for Firebase project ${projectId}.`,
            `Enable aiplatform.googleapis.com for ${projectId}, wait a few minutes for propagation, then retry avatar creation.`,
            `Console: https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=${projectId}`,
        ].join(" ");
    }
    return message || "Unexpected error";
};
const parseError = (error) => formatAIServiceError(stringifyError(error));
const updateVideoDocument = async (uid, videoId, data) => {
    var _a;
    if (!videoId)
        return;
    const ref = db.collection("videos").doc(videoId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Video job not found");
    }
    if (((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.userId) !== uid) {
        throw new https_1.HttpsError("permission-denied", "Video job does not belong to the current user");
    }
    await ref.set(data, { merge: true });
};
const generateVideoFromImage = async ({ prompt, inputImagePath, outputStoragePrefix, durationSeconds, }) => {
    (0, core_1.assertVeoGenerationEnabled)();
    const ai = getAI();
    const bucket = getBucket();
    const inputGcsUri = `gs://${bucket.name}/${inputImagePath}`;
    const outputGcsUri = `gs://${bucket.name}/${outputStoragePrefix}`;
    const inputFile = bucket.file(inputImagePath);
    const [inputExists] = await inputFile.exists();
    if (!inputExists)
        throw new Error("Veo source image was not found in storage");
    const [inputMetadata] = await inputFile.getMetadata();
    const inputMimeType = inputMetadata.contentType;
    if (!(inputMimeType === null || inputMimeType === void 0 ? void 0 : inputMimeType.startsWith("image/"))) {
        throw new Error("Veo source image is missing a valid image MIME type");
    }
    const generated = await (0, googleVeo_1.generateVeoVideo)({
        ai,
        prompt,
        sourceImage: { gcsUri: inputGcsUri, mimeType: inputMimeType },
        aspectRatio: "9:16",
        durationSeconds,
        outputGcsUri,
    });
    const file = bucket.file(generated.storagePath);
    const [exists] = await file.exists();
    if (!exists)
        throw new Error("Generated video file not found in storage");
    const finalUrl = await (0, core_1.createDownloadUrl)(generated.storagePath);
    console.log("[generateVideoFromImage] Veo generation completed", {
        operationName: generated.operationName,
        storagePath: generated.storagePath,
        pollAttempts: generated.pollAttempts,
    });
    return {
        videoUrl: finalUrl,
        outputFilePath: generated.storagePath,
    };
};
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_STORED_VIDEO_BYTES = 200 * 1024 * 1024;
function requireBoundedText(value, name, maxLength) {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
        throw new https_1.HttpsError("invalid-argument", `${name} is required and must be at most ${maxLength} characters`);
    }
    return value.trim();
}
function optionalBoundedText(value, name, maxLength) {
    if (value === undefined || value === null || value === "")
        return undefined;
    return requireBoundedText(value, name, maxLength);
}
function requireOwnedStoragePath(uid, value, name) {
    if (typeof value !== "string" ||
        value.length < 1 ||
        value.length > 1024 ||
        !value.startsWith(`users/${uid}/`) ||
        value.includes("..")) {
        throw new https_1.HttpsError("permission-denied", `${name} does not belong to the current user`);
    }
    return value;
}
async function assertStoredMedia(storagePath, mimePrefix, maxBytes) {
    var _a, _b;
    let metadata;
    try {
        [metadata] = await getBucket().file(storagePath).getMetadata();
    }
    catch (_c) {
        throw new https_1.HttpsError("not-found", "The requested media file was not found");
    }
    const size = Number((_a = metadata.size) !== null && _a !== void 0 ? _a : 0);
    if (!((_b = metadata.contentType) === null || _b === void 0 ? void 0 : _b.startsWith(mimePrefix)) ||
        !Number.isFinite(size) ||
        size <= 0 ||
        size > maxBytes) {
        throw new https_1.HttpsError("invalid-argument", "The requested media file is not an allowed type or size");
    }
}
function parseInlineImage(value, mimeType) {
    const allowedMime = typeof mimeType === "string" && /^(image\/(jpeg|png|webp))$/i.test(mimeType)
        ? mimeType.toLowerCase()
        : null;
    if (typeof value !== "string" || !allowedMime || value.length === 0 || value.length > Math.ceil(MAX_INLINE_IMAGE_BYTES * 4 / 3) + 8) {
        throw new https_1.HttpsError("invalid-argument", "Provide a JPEG, PNG, or WebP image no larger than 5 MB");
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        throw new https_1.HttpsError("invalid-argument", "Image data must be base64 encoded");
    }
    const bytes = Buffer.from(value, "base64");
    if (bytes.length === 0 || bytes.length > MAX_INLINE_IMAGE_BYTES) {
        throw new https_1.HttpsError("invalid-argument", "Image data is too large");
    }
    return { data: value, mimeType: allowedMime };
}
/** Sole MagicBox admin — keep this allowlist tight. */
const SOLE_ADMIN_EMAILS = new Set(["nithindidigam@nhancio.com"]);
exports.setAdminRole = (0, https_1.onCall)(Object.assign({}, core_1.callableSecurity), async (request) => {
    var _a;
    const uid = requireAuth(request);
    const callerRecord = await admin.auth().getUser(uid);
    if (!((_a = callerRecord.customClaims) === null || _a === void 0 ? void 0 : _a.admin)) {
        throw new https_1.HttpsError("permission-denied", "Only admins can grant admin roles");
    }
    const { email } = request.data;
    if (!email) {
        throw new https_1.HttpsError("invalid-argument", "Email is required");
    }
    const normalized = email.trim().toLowerCase();
    if (!SOLE_ADMIN_EMAILS.has(normalized)) {
        throw new https_1.HttpsError("permission-denied", "Only the designated sole admin email can hold admin privileges");
    }
    try {
        const userRecord = await admin.auth().getUserByEmail(normalized);
        await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
        await db.collection("admins").doc(normalized).set({
            uid: userRecord.uid,
            email: normalized,
            grantedBy: uid,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, message: `Admin role granted to ${normalized}` };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.verifyAdminStatus = (0, https_1.onCall)(Object.assign({}, core_1.callableSecurity), async (request) => {
    var _a, _b;
    const uid = requireAuth(request);
    const userRecord = await admin.auth().getUser(uid);
    const isAdmin = ((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.admin) === true;
    // Bootstrap path: an email listed in `admins` is promoted to a real custom
    // claim on first sign-in. The email must be verified by the provider —
    // Firebase will mint an account for an arbitrary unverified address, so
    // trusting an unverified `email` here would let anyone claim an admin
    // address that has been pre-provisioned but not yet registered.
    const email = ((_b = userRecord.email) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
    if (!isAdmin && email && userRecord.emailVerified && SOLE_ADMIN_EMAILS.has(email)) {
        const adminDoc = await db.collection("admins").doc(email).get();
        if (adminDoc.exists) {
            await admin.auth().setCustomUserClaims(uid, { admin: true });
            return { isAdmin: true };
        }
    }
    // Strip admin claim if someone outside the sole-admin allowlist somehow got one.
    if (isAdmin && email && !SOLE_ADMIN_EMAILS.has(email)) {
        await admin.auth().setCustomUserClaims(uid, { admin: false });
        return { isAdmin: false };
    }
    return { isAdmin: isAdmin && SOLE_ADMIN_EMAILS.has(email) };
});
// Billing is handled by Polar.sh — see functions/src/polar.ts
// (createPolarCheckout + polarWebhook), exported at the top of this file.
exports.renderRemotionVideo = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 540, memory: "2GiB" }), async (request) => {
    const uid = requireAuth(request);
    const { templateId, props, videoId } = request.data;
    if (!templateId || !props) {
        throw new https_1.HttpsError("invalid-argument", "templateId and props are required");
    }
    try {
        if (videoId) {
            await updateVideoDocument(uid, videoId, { status: "generating" });
        }
        const renderJobRef = await db.collection("videoRenders").add({
            userId: uid,
            templateId,
            props,
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const projectFileName = `users/${uid}/video-projects/${renderJobRef.id}.json`;
        const projectFile = getBucket().file(projectFileName);
        await projectFile.save(JSON.stringify({
            templateId,
            props,
            format: "magicboxai-remotion-project",
            version: 1,
            createdAt: new Date().toISOString(),
        }), { metadata: { contentType: "application/json" } });
        const projectUrl = await (0, core_1.createDownloadUrl)(projectFileName);
        await renderJobRef.update({
            status: "completed",
            projectUrl,
        });
        if (videoId) {
            await updateVideoDocument(uid, videoId, {
                status: "completed",
                renderProvider: "remotion",
                videoUrl: projectUrl,
            });
        }
        return {
            videoUrl: projectUrl,
            duration: 15,
            projectId: renderJobRef.id,
        };
    }
    catch (error) {
        if (videoId) {
            await updateVideoDocument(uid, videoId, {
                status: "failed",
                errorMessage: parseError(error),
            });
        }
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.generateImage = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 120, memory: "512MiB" }), async (request) => {
    var _a, _b, _c, _d;
    const uid = requireAuth(request);
    const prompt = requireBoundedText((_a = request.data) === null || _a === void 0 ? void 0 : _a.prompt, "Prompt", 4000);
    const type = (_b = request.data) === null || _b === void 0 ? void 0 : _b.type;
    if (type !== "influencer" && type !== "ad") {
        throw new https_1.HttpsError("invalid-argument", "Image type must be influencer or ad");
    }
    await (0, core_1.enforceCallableRateLimit)(uid, "legacy-image-generation", core_1.AI_RATE_LIMITS.imageGeneration);
    try {
        const ai = getAI();
        const response = await ai.models.generateImages({
            model: "imagen-3.0-generate-001",
            prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: "image/png",
                aspectRatio: "1:1",
            },
        });
        const generatedImage = (_c = response.generatedImages) === null || _c === void 0 ? void 0 : _c[0];
        const imageBytes = (_d = generatedImage === null || generatedImage === void 0 ? void 0 : generatedImage.image) === null || _d === void 0 ? void 0 : _d.imageBytes;
        if (!imageBytes) {
            throw new Error("No image returned from Imagen");
        }
        const fileName = `users/${uid}/${type}s/${(0, uuid_1.v4)()}.png`;
        await getBucket().file(fileName).save(Buffer.from(imageBytes, "base64"), {
            metadata: {
                contentType: "image/png",
                cacheControl: "public, max-age=31536000",
            },
        });
        return { imageUrl: await (0, core_1.createDownloadUrl)(fileName) };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.generateScript = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 60, memory: "512MiB" }), async (request) => {
    var _a, _b;
    const uid = requireAuth(request);
    const prompt = requireBoundedText((_a = request.data) === null || _a === void 0 ? void 0 : _a.prompt, "Prompt", 8000);
    const systemInstruction = optionalBoundedText((_b = request.data) === null || _b === void 0 ? void 0 : _b.systemInstruction, "System instruction", 4000);
    await (0, core_1.enforceCallableRateLimit)(uid, "legacy-text-generation", core_1.AI_RATE_LIMITS.textGeneration);
    try {
        const ai = getAI();
        const result = await ai.models.generateContent({
            model: models_1.MODELS.text,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction || undefined,
            },
        });
        return { text: result.text };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.analyzeImage = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 60, memory: "512MiB" }), async (request) => {
    var _a, _b, _c;
    const uid = requireAuth(request);
    const image = parseInlineImage((_a = request.data) === null || _a === void 0 ? void 0 : _a.imageBase64, (_b = request.data) === null || _b === void 0 ? void 0 : _b.mimeType);
    const prompt = requireBoundedText((_c = request.data) === null || _c === void 0 ? void 0 : _c.prompt, "Prompt", 2000);
    await (0, core_1.enforceCallableRateLimit)(uid, "legacy-image-analysis", core_1.AI_RATE_LIMITS.imageAnalysis);
    try {
        const ai = getAI();
        const result = await ai.models.generateContent({
            model: models_1.MODELS.text,
            contents: [
                prompt,
                {
                    inlineData: {
                        data: image.data,
                        mimeType: image.mimeType,
                    },
                },
            ],
        });
        return { text: result.text };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.analyzeAvatarPhotos = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 120, memory: "512MiB" }), async (request) => {
    var _a, _b, _c, _d;
    const uid = requireAuth(request);
    const { images, storagePaths } = (_a = request.data) !== null && _a !== void 0 ? _a : {};
    const prompt = optionalBoundedText((_b = request.data) === null || _b === void 0 ? void 0 : _b.prompt, "Prompt", 4000);
    if (!(images === null || images === void 0 ? void 0 : images.length) && !(storagePaths === null || storagePaths === void 0 ? void 0 : storagePaths.length)) {
        throw new https_1.HttpsError("invalid-argument", "At least one image or storage path is required");
    }
    if ((images && !Array.isArray(images)) || (storagePaths && !Array.isArray(storagePaths))) {
        throw new https_1.HttpsError("invalid-argument", "Images must be a list");
    }
    if (((_c = images === null || images === void 0 ? void 0 : images.length) !== null && _c !== void 0 ? _c : 0) > 10 || ((_d = storagePaths === null || storagePaths === void 0 ? void 0 : storagePaths.length) !== null && _d !== void 0 ? _d : 0) > 10) {
        throw new https_1.HttpsError("invalid-argument", "At most 10 images are allowed");
    }
    await (0, core_1.enforceCallableRateLimit)(uid, "avatar-photo-analysis", core_1.AI_RATE_LIMITS.avatarPhotoAnalysis);
    try {
        const ai = getAI();
        const inlineImages = (storagePaths === null || storagePaths === void 0 ? void 0 : storagePaths.length)
            ? await Promise.all(storagePaths.map(async (rawPath) => {
                const path = requireOwnedStoragePath(uid, rawPath, "Image path");
                await assertStoredMedia(path, "image/", MAX_STORED_IMAGE_BYTES);
                const file = getBucket().file(path);
                const [metadata] = await file.getMetadata();
                const [buffer] = await file.download();
                return {
                    inlineData: {
                        data: buffer.toString("base64"),
                        mimeType: metadata.contentType || "image/jpeg",
                    },
                };
            }))
            : (images !== null && images !== void 0 ? images : []).map((rawImage) => {
                const image = parseInlineImage(rawImage === null || rawImage === void 0 ? void 0 : rawImage.imageBase64, rawImage === null || rawImage === void 0 ? void 0 : rawImage.mimeType);
                return { inlineData: image };
            });
        const result = await ai.models.generateContent({
            model: models_1.MODELS.text,
            contents: [
                prompt ||
                    `You are analyzing multiple photos of the same person for a reusable talking-head avatar.
Return:
DESCRIPTION: 2-3 sentences describing their consistent visual identity and creator vibe
PERSONALITY: a concise creator archetype, max 3 words
VOICE_TONE: the most suitable speaking tone

Requirements:
- Use all photos together, not just one image
- Focus on consistent facial features, energy, and camera presence
- Ignore background differences and prioritize identity consistency`,
                ...inlineImages,
            ],
        });
        return { text: result.text };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.analyzeAvatarVideo = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 300, memory: "512MiB" }), async (request) => {
    var _a, _b;
    const uid = requireAuth(request);
    const videoStoragePath = requireOwnedStoragePath(uid, (_a = request.data) === null || _a === void 0 ? void 0 : _a.videoStoragePath, "Video");
    const requestedMimeType = (_b = request.data) === null || _b === void 0 ? void 0 : _b.mimeType;
    if (requestedMimeType !== undefined && (typeof requestedMimeType !== "string" || !requestedMimeType.startsWith("video/"))) {
        throw new https_1.HttpsError("invalid-argument", "Video MIME type is invalid");
    }
    await (0, core_1.enforceCallableRateLimit)(uid, "avatar-video-analysis", core_1.AI_RATE_LIMITS.avatarVideoAnalysis);
    try {
        const bucket = getBucket();
        const file = bucket.file(videoStoragePath);
        await assertStoredMedia(videoStoragePath, "video/", MAX_STORED_VIDEO_BYTES);
        const [metadata] = await file.getMetadata();
        const contentType = requestedMimeType || metadata.contentType;
        if (!(contentType === null || contentType === void 0 ? void 0 : contentType.startsWith("video/"))) {
            throw new https_1.HttpsError("invalid-argument", "File is not a video");
        }
        const ai = getAI();
        const result = await ai.models.generateContent({
            model: models_1.MODELS.text,
            contents: [
                `You are analyzing a short video of a person who wants a reusable talking-head avatar.
Return:
DESCRIPTION: 2-3 sentences describing their consistent visual identity, energy, and creator vibe
PERSONALITY: a concise creator archetype, max 3 words
VOICE_TONE: the most suitable speaking tone, informed by how they actually speak and move in the video

Requirements:
- Focus on facial features, expressiveness, gestures, and camera presence
- If they speak, use their delivery style to inform VOICE_TONE
- Ignore background and lighting differences; prioritize identity`,
                {
                    fileData: {
                        fileUri: `gs://${bucket.name}/${videoStoragePath}`,
                        mimeType: contentType,
                    },
                },
            ],
        });
        return { text: result.text };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.generateAvatarVideo = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 540, memory: "1GiB" }), async (request) => {
    var _a, _b, _c, _d, _e;
    const uid = requireAuth(request);
    (0, core_1.assertVeoGenerationEnabled)();
    const photoStoragePath = requireOwnedStoragePath(uid, (_a = request.data) === null || _a === void 0 ? void 0 : _a.photoStoragePath, "Image");
    const avatarName = requireBoundedText((_b = request.data) === null || _b === void 0 ? void 0 : _b.avatarName, "Avatar name", 120);
    const personality = (_d = optionalBoundedText((_c = request.data) === null || _c === void 0 ? void 0 : _c.personality, "Personality", 240)) !== null && _d !== void 0 ? _d : "";
    const frameStoragePaths = (_e = request.data) === null || _e === void 0 ? void 0 : _e.frameStoragePaths;
    if (frameStoragePaths !== undefined && (!Array.isArray(frameStoragePaths) || frameStoragePaths.length > 10)) {
        throw new https_1.HttpsError("invalid-argument", "At most 10 frame paths are allowed");
    }
    await assertStoredMedia(photoStoragePath, "image/", MAX_STORED_IMAGE_BYTES);
    await Promise.all((frameStoragePaths !== null && frameStoragePaths !== void 0 ? frameStoragePaths : []).map(async (rawPath) => {
        const path = requireOwnedStoragePath(uid, rawPath, "Frame");
        await assertStoredMedia(path, "image/", MAX_STORED_IMAGE_BYTES);
    }));
    // Metering for avatar previews lives in the Convex v-credit ledger (the same
    // balance shown across the app): the authenticated client charges v-credits
    // via `credits.spendVideo` before this call and refunds via
    // `credits.refundVideo` if it fails. This path therefore does NOT use the
    // Firebase paid-plan quota, so free-trial users with v-credits can generate.
    // App Check + auth + ownership remain the request-integrity guards.
    try {
        const outputStoragePrefix = `users/${uid}/avatar-previews/${(0, uuid_1.v4)()}/`;
        const frameNote = frameStoragePaths && frameStoragePaths.length > 1
            ? ` Identity was sampled across ${frameStoragePaths.length} stills from the source clip; stay consistent with that person.`
            : "";
        const previewPrompt = buildAvatarPreviewPrompt({
            avatarName,
            personality,
        }) + frameNote;
        const res = await generateVideoFromImage({
            prompt: previewPrompt,
            inputImagePath: photoStoragePath,
            outputStoragePrefix,
            durationSeconds: 8,
        });
        return res;
    }
    catch (error) {
        console.error("[generateAvatarVideo] failed", stringifyError(error));
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.generateUGCVideo = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 540, memory: "1GiB" }), async (request) => {
    var _a;
    const uid = requireAuth(request);
    (0, core_1.assertVeoGenerationEnabled)();
    const { videoId, photoStoragePath, script, templateId, templateName, avatarName, characterSummary, productName, productDescription, productImageAnalysis, } = (_a = request.data) !== null && _a !== void 0 ? _a : {};
    const ownedPhotoStoragePath = requireOwnedStoragePath(uid, photoStoragePath, "Image");
    await assertStoredMedia(ownedPhotoStoragePath, "image/", MAX_STORED_IMAGE_BYTES);
    const boundedScript = requireBoundedText(script, "Script", 10000);
    const boundedTemplateName = requireBoundedText(templateName, "Template name", 120);
    const boundedProductName = requireBoundedText(productName, "Product name", 240);
    const boundedAvatarName = optionalBoundedText(avatarName, "Avatar name", 120);
    const boundedSummary = optionalBoundedText(characterSummary, "Character summary", 2000);
    const boundedDescription = optionalBoundedText(productDescription, "Product description", 4000);
    const boundedImageAnalysis = optionalBoundedText(productImageAnalysis, "Product image analysis", 4000);
    const boundedTemplateId = optionalBoundedText(templateId, "Template id", 120);
    await reserveVideoGeneration(uid);
    try {
        await updateVideoDocument(uid, videoId, {
            status: "generating",
            renderProvider: "veo",
        });
        const outputStoragePrefix = `users/${uid}/videos/ugc_${(0, uuid_1.v4)()}/`;
        const prompt = buildUGCVideoPrompt({
            avatarName: boundedAvatarName,
            characterSummary: boundedSummary,
            templateId: boundedTemplateId,
            templateName: boundedTemplateName,
            productName: boundedProductName,
            productDescription: boundedDescription,
            productImageAnalysis: boundedImageAnalysis,
            script: boundedScript,
        });
        const result = await generateVideoFromImage({
            prompt,
            inputImagePath: ownedPhotoStoragePath,
            outputStoragePrefix,
            durationSeconds: 8,
        });
        await updateVideoDocument(uid, videoId, {
            status: "completed",
            videoUrl: result.videoUrl,
            renderProvider: "veo",
            errorMessage: admin.firestore.FieldValue.delete(),
        });
        return { videoUrl: result.videoUrl };
    }
    catch (error) {
        await releaseVideoGeneration(uid);
        console.error("[generateUGCVideo] failed", stringifyError(error));
        await updateVideoDocument(uid, videoId, {
            status: "failed",
            errorMessage: parseError(error),
        });
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
//# sourceMappingURL=index.js.map