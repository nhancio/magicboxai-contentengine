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
exports.generateUGCVideo = exports.generateAvatarVideo = exports.analyzeAvatarPhotos = exports.analyzeImage = exports.generateScript = exports.generateImage = exports.renderRemotionVideo = exports.verifyAdminStatus = exports.setAdminRole = exports.createGuestCheckout = exports.dodoWebhook = exports.createDodoPortal = exports.createDodoCheckout = exports.onUserCreatedSendWelcome = exports.extractBrandFromWebsite = exports.postingTick = exports.generationTick = exports.automationTick = exports.socialOAuthCallback = exports.disconnectSocialAccount = exports.getSocialConnectUrl = exports.getQuota = exports.regeneratePostContent = exports.cancelPost = exports.retryPost = exports.approvePost = exports.generatePreviewContent = exports.createManualPost = exports.runAutomationNow = exports.setAutomationStatus = exports.updateAutomation = exports.createAutomation = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
const uuid_1 = require("uuid");
const core_1 = require("./core");
const googleVeo_1 = require("./video/googleVeo");
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
var welcome_1 = require("./welcome");
Object.defineProperty(exports, "onUserCreatedSendWelcome", { enumerable: true, get: function () { return welcome_1.onUserCreatedSendWelcome; } });
var dodo_1 = require("./dodo");
Object.defineProperty(exports, "createDodoCheckout", { enumerable: true, get: function () { return dodo_1.createDodoCheckout; } });
Object.defineProperty(exports, "createDodoPortal", { enumerable: true, get: function () { return dodo_1.createDodoPortal; } });
Object.defineProperty(exports, "dodoWebhook", { enumerable: true, get: function () { return dodo_1.dodoWebhook; } });
Object.defineProperty(exports, "createGuestCheckout", { enumerable: true, get: function () { return dodo_1.createGuestCheckout; } });
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
const getPublicUrl = (filePath) => `https://storage.googleapis.com/${getBucket().name}/${filePath}`;
const getSubscription = async (uid) => {
    var _a, _b, _c, _d;
    const snap = await db.collection("subscriptions").doc(uid).get();
    if (!snap.exists) {
        return { plan: "free", videosUsed: 0, videosLimit: 0, status: "inactive" };
    }
    const data = snap.data();
    const plan = (_a = data === null || data === void 0 ? void 0 : data.plan) !== null && _a !== void 0 ? _a : "free";
    const configuredLimit = plan === "free" ? 0 : core_1.PLAN_VIDEO_LIMIT[plan];
    const storedLimit = (_b = data === null || data === void 0 ? void 0 : data.videosLimit) !== null && _b !== void 0 ? _b : 0;
    const videosLimit = Number.isSafeInteger(storedLimit) && storedLimit > 0
        ? Math.min(storedLimit, configuredLimit)
        : 0;
    return {
        plan,
        videosUsed: (_c = data === null || data === void 0 ? void 0 : data.videosUsed) !== null && _c !== void 0 ? _c : 0,
        // Cap legacy subscription documents that may still contain the old,
        // financially unsafe 50/1000 allowances.
        videosLimit,
        status: (_d = data === null || data === void 0 ? void 0 : data.status) !== null && _d !== void 0 ? _d : ((data === null || data === void 0 ? void 0 : data.plan) && data.plan !== "free" ? "active" : "inactive"),
        currentPeriodEnd: data === null || data === void 0 ? void 0 : data.currentPeriodEnd,
    };
};
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
    await file.makePublic();
    const finalUrl = getPublicUrl(generated.storagePath);
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
exports.setAdminRole = (0, https_1.onCall)({ cors: true }, async (request) => {
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
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
        await db.collection("admins").doc(email).set({
            uid: userRecord.uid,
            email,
            grantedBy: uid,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, message: `Admin role granted to ${email}` };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.verifyAdminStatus = (0, https_1.onCall)({ cors: true }, async (request) => {
    var _a, _b;
    const uid = requireAuth(request);
    const userRecord = await admin.auth().getUser(uid);
    const isAdmin = ((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.admin) === true;
    if (!isAdmin && ((_b = request.auth) === null || _b === void 0 ? void 0 : _b.token.email)) {
        const adminDoc = await db.collection("admins").doc(request.auth.token.email).get();
        if (adminDoc.exists) {
            await admin.auth().setCustomUserClaims(uid, { admin: true });
            return { isAdmin: true };
        }
    }
    return { isAdmin };
});
// Billing is handled by Polar.sh — see functions/src/polar.ts
// (createPolarCheckout + polarWebhook), exported at the top of this file.
exports.renderRemotionVideo = (0, https_1.onCall)({ timeoutSeconds: 540, memory: "2GiB", cors: true }, async (request) => {
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
        await projectFile.makePublic();
        const projectUrl = getPublicUrl(projectFileName);
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
exports.generateImage = (0, https_1.onCall)({ timeoutSeconds: 120, memory: "512MiB", cors: true }, async (request) => {
    var _a, _b;
    const uid = requireAuth(request);
    const { prompt, type } = request.data;
    if (!prompt || typeof prompt !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Prompt is required");
    }
    try {
        const ai = getAI();
        const response = await ai.models.generateImages({
            model: "imagen-3.0-generate-001",
            prompt: prompt.slice(0, 4000),
            config: {
                numberOfImages: 1,
                outputMimeType: "image/png",
                aspectRatio: "1:1",
            },
        });
        const generatedImage = (_a = response.generatedImages) === null || _a === void 0 ? void 0 : _a[0];
        const imageBytes = (_b = generatedImage === null || generatedImage === void 0 ? void 0 : generatedImage.image) === null || _b === void 0 ? void 0 : _b.imageBytes;
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
        await getBucket().file(fileName).makePublic();
        return { imageUrl: getPublicUrl(fileName) };
    }
    catch (error) {
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.generateScript = (0, https_1.onCall)({ timeoutSeconds: 60, memory: "512MiB", cors: true }, async (request) => {
    requireAuth(request);
    const { prompt, systemInstruction } = request.data;
    try {
        const ai = getAI();
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash-001",
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
exports.analyzeImage = (0, https_1.onCall)({ timeoutSeconds: 60, memory: "512MiB", cors: true }, async (request) => {
    requireAuth(request);
    const { imageBase64, prompt, mimeType } = request.data;
    try {
        const ai = getAI();
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash-001",
            contents: [
                prompt,
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: mimeType || "image/jpeg",
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
exports.analyzeAvatarPhotos = (0, https_1.onCall)({ timeoutSeconds: 120, memory: "512MiB", cors: true }, async (request) => {
    requireAuth(request);
    const { images, storagePaths, prompt } = request.data;
    if (!(images === null || images === void 0 ? void 0 : images.length) && !(storagePaths === null || storagePaths === void 0 ? void 0 : storagePaths.length)) {
        throw new https_1.HttpsError("invalid-argument", "At least one image or storage path is required");
    }
    try {
        const ai = getAI();
        const inlineImages = (storagePaths === null || storagePaths === void 0 ? void 0 : storagePaths.length)
            ? await Promise.all(storagePaths.slice(0, 10).map(async (path) => {
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
            : (images !== null && images !== void 0 ? images : []).slice(0, 10).map((image) => ({
                inlineData: {
                    data: image.imageBase64,
                    mimeType: image.mimeType || "image/jpeg",
                },
            }));
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash-001",
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
exports.generateAvatarVideo = (0, https_1.onCall)({ timeoutSeconds: 540, memory: "1GiB", cors: true }, async (request) => {
    console.log("[generateAvatarVideo] ONCALL INVOKED");
    const uid = requireAuth(request);
    (0, core_1.assertVeoGenerationEnabled)();
    console.log(`[generateAvatarVideo] UID: ${uid}`);
    const { photoStoragePath, avatarName, personality } = request.data;
    console.log(`[generateAvatarVideo] Input data:`, { photoStoragePath, avatarName, personality });
    if (!photoStoragePath || !avatarName) {
        console.error("[generateAvatarVideo] MISSING ARGS");
        throw new https_1.HttpsError("invalid-argument", "photoStoragePath and avatarName are required");
    }
    try {
        const outputStoragePrefix = `users/${uid}/avatar-previews/${(0, uuid_1.v4)()}/`;
        console.log(`[generateAvatarVideo] outputStoragePrefix: ${outputStoragePrefix}`);
        const previewPrompt = buildAvatarPreviewPrompt({
            avatarName,
            personality,
        });
        console.log(`[generateAvatarVideo] previewPrompt: ${previewPrompt}`);
        const res = await generateVideoFromImage({
            prompt: previewPrompt,
            inputImagePath: photoStoragePath,
            outputStoragePrefix,
            durationSeconds: 8,
        });
        console.log(`[generateAvatarVideo] FINISHED SUCCESSFULLY`, res);
        return res;
    }
    catch (error) {
        console.error("[generateAvatarVideo] CATCH ERROR:", error);
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
exports.generateUGCVideo = (0, https_1.onCall)({ timeoutSeconds: 540, memory: "1GiB", cors: true }, async (request) => {
    console.log("[generateUGCVideo] ONCALL INVOKED");
    const uid = requireAuth(request);
    (0, core_1.assertVeoGenerationEnabled)();
    console.log(`[generateUGCVideo] UID: ${uid}`);
    const { videoId, photoStoragePath, script, templateId, templateName, avatarName, characterSummary, productName, productDescription, productImageAnalysis, } = request.data;
    console.log(`[generateUGCVideo] Input data:`, request.data);
    if (!photoStoragePath || !script || !templateName || !productName) {
        console.error("[generateUGCVideo] MISSING ARGS");
        throw new https_1.HttpsError("invalid-argument", "photoStoragePath, script, templateName, and productName are required");
    }
    console.log("[generateUGCVideo] Checking subscription...");
    const subscription = await getSubscription(uid);
    assertCanGenerateVideo(subscription);
    console.log("[generateUGCVideo] Subscription OK.");
    try {
        console.log(`[generateUGCVideo] Updating video document ${videoId}...`);
        await updateVideoDocument(uid, videoId, {
            status: "generating",
            renderProvider: "veo",
        });
        const outputStoragePrefix = `users/${uid}/videos/ugc_${(0, uuid_1.v4)()}/`;
        console.log(`[generateUGCVideo] outputStoragePrefix: ${outputStoragePrefix}`);
        const prompt = buildUGCVideoPrompt({
            avatarName,
            characterSummary,
            templateId,
            templateName,
            productName,
            productDescription,
            productImageAnalysis,
            script,
        });
        console.log(`[generateUGCVideo] Prompt: \n${prompt}`);
        console.log("[generateUGCVideo] Calling generateVideoFromImage...");
        const result = await generateVideoFromImage({
            prompt,
            inputImagePath: photoStoragePath,
            outputStoragePrefix,
            durationSeconds: 8,
        });
        console.log("[generateUGCVideo] generateVideoFromImage SUCCESS:", result);
        await updateVideoDocument(uid, videoId, {
            status: "completed",
            videoUrl: result.videoUrl,
            renderProvider: "veo",
            errorMessage: admin.firestore.FieldValue.delete(),
        });
        console.log("[generateUGCVideo] Video doc updated as completed.");
        await db.collection("subscriptions").doc(uid).set({
            videosUsed: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log("[generateUGCVideo] Subscription usage incremented. FINISHED.");
        return { videoUrl: result.videoUrl };
    }
    catch (error) {
        console.error("[generateUGCVideo] CATCH ERROR:", error);
        await updateVideoDocument(uid, videoId, {
            status: "failed",
            errorMessage: parseError(error),
        });
        throw new https_1.HttpsError("internal", parseError(error));
    }
});
//# sourceMappingURL=index.js.map