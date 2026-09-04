"use strict";
// Content generation pipeline for automation posts: Gemini captions per
// platform, Imagen images, Veo text-to-video clips (for YouTube / Reels).
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCaptionForPlatform = generateCaptionForPlatform;
exports.generatePostImage = generatePostImage;
exports.generatePostVideo = generatePostVideo;
exports.generatePostAssets = generatePostAssets;
const uuid_1 = require("uuid");
const core_1 = require("./core");
const marketingPrompts_1 = require("./prompts/marketingPrompts");
const googleVeo_1 = require("./video/googleVeo");
const models_1 = require("./models");
const image_1 = require("./image");
function parseJsonBlock(text) {
    var _a;
    const cleaned = text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.caption)
        throw new Error("Model returned no caption");
    return { caption: parsed.caption, hashtags: (_a = parsed.hashtags) !== null && _a !== void 0 ? _a : [] };
}
async function getBrand(brandProfileId) {
    if (!brandProfileId)
        return null;
    const snap = await core_1.db.collection("brandProfiles").doc(brandProfileId).get();
    return snap.exists ? snap.data() : null;
}
async function generateCaptionForPlatform(args) {
    var _a;
    const ai = (0, core_1.getAI)();
    const { systemInstruction, prompt } = (0, marketingPrompts_1.buildContentPrompt)({
        brand: args.brand,
        automation: { brief: args.brief, preset: args.preset, tone: args.tone },
        platform: args.platform,
    });
    const result = await ai.models.generateContent({
        model: models_1.MODELS.text,
        contents: prompt,
        config: { systemInstruction },
    });
    return parseJsonBlock((_a = result.text) !== null && _a !== void 0 ? _a : "");
}
async function generatePostImage(args) {
    const ai = (0, core_1.getAI)();
    const prompt = (0, marketingPrompts_1.buildImagePrompt)({
        brand: args.brand,
        brief: args.brief,
        caption: args.caption,
    });
    const imageBuffer = await (0, image_1.renderImageBuffer)({ ai, prompt, aspectRatio: "1:1" });
    const storagePath = `posts/${args.postId}/${(0, uuid_1.v4)()}.png`;
    const file = (0, core_1.getBucket)().file(storagePath);
    await file.save(imageBuffer, {
        metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
    });
    return { url: await (0, core_1.createDownloadUrl)(storagePath), storagePath };
}
async function generatePostVideo(args) {
    var _a;
    (0, core_1.assertVeoGenerationEnabled)();
    const ai = (0, core_1.getAI)();
    const bucket = (0, core_1.getBucket)();
    const outputStoragePrefix = `posts/${args.postId}/${(0, uuid_1.v4)()}/`;
    const prompt = [
        "Create a short, scroll-stopping vertical social media video clip.",
        "One clear subject, cinematic lighting, smooth camera movement, no on-screen text.",
        args.brand ? `Brand: ${args.brand.name} (${args.brand.industry}).` : "",
        "The clip accompanies this social post:",
        ((_a = args.caption) !== null && _a !== void 0 ? _a : args.brief).slice(0, 800),
    ]
        .filter(Boolean)
        .join("\n");
    const generated = await (0, googleVeo_1.generateVeoVideo)({
        ai,
        prompt,
        aspectRatio: "9:16",
        durationSeconds: 8,
        outputGcsUri: `gs://${bucket.name}/${outputStoragePrefix}`,
    });
    const file = bucket.file(generated.storagePath);
    const [exists] = await file.exists();
    if (!exists)
        throw new Error("Generated video file not found in storage");
    return {
        url: await (0, core_1.createDownloadUrl)(generated.storagePath),
        storagePath: generated.storagePath,
    };
}
/**
 * Generate all content for a post (captions per platform + optional
 * image/video) and return the fields to merge onto the post doc.
 */
async function generatePostAssets(postId, post) {
    var _a, _b, _c, _d, _e, _f, _g;
    // Fail the whole video job before caption/image/provider work instead of
    // silently degrading a video request into a different asset type.
    if ((_a = post.contentTypes) === null || _a === void 0 ? void 0 : _a.video)
        (0, core_1.assertVeoGenerationEnabled)();
    const brand = await getBrand(post.brandProfileId);
    const preset = (_b = post.preset) !== null && _b !== void 0 ? _b : "custom";
    const tone = (_c = post.tone) !== null && _c !== void 0 ? _c : "";
    const platforms = post.platforms.length ? post.platforms : ["instagram"];
    // Primary caption from the first platform; per-platform variants for the rest.
    const captions = await Promise.all(platforms.map(async (platform) => ({
        platform,
        result: await generateCaptionForPlatform({
            brand,
            brief: post.brief,
            preset,
            tone,
            platform,
        }),
    })));
    const primary = captions[0].result;
    const perPlatform = {};
    for (const { platform, result } of captions) {
        perPlatform[platform] = { caption: result.caption };
    }
    const update = {
        content: {
            caption: primary.caption,
            hashtags: primary.hashtags,
            perPlatform,
        },
    };
    const media = [...((_d = post.media) !== null && _d !== void 0 ? _d : [])];
    // Video first: platforms like YouTube require it, and publishing picks the
    // first usable media item.
    if (((_e = post.contentTypes) === null || _e === void 0 ? void 0 : _e.video) && !media.some((m) => m.type === "video")) {
        try {
            const video = await generatePostVideo({
                postId,
                brand,
                brief: post.brief,
                caption: primary.caption,
            });
            media.push({ type: "video", url: video.url, storagePath: video.storagePath, source: "veo" });
        }
        catch (error) {
            const needsVideo = platforms.includes("youtube");
            console.error(`[generatePostAssets] video generation failed for ${postId}:`, (0, core_1.stringifyError)(error));
            // YouTube can't post without a video — fail the post so it retries.
            if (needsVideo && !((_f = post.contentTypes) === null || _f === void 0 ? void 0 : _f.image))
                throw error;
        }
    }
    if ((_g = post.contentTypes) === null || _g === void 0 ? void 0 : _g.image) {
        try {
            const image = await generatePostImage({
                userId: post.userId,
                postId,
                brand,
                brief: post.brief,
                caption: primary.caption,
            });
            media.push({ type: "image", url: image.url, storagePath: image.storagePath, source: "imagen" });
        }
        catch (error) {
            // Image failure shouldn't kill the post — caption-only is still postable.
            console.error(`[generatePostAssets] image generation failed for ${postId}:`, (0, core_1.stringifyError)(error));
        }
    }
    if (media.length)
        update.media = media;
    return update;
}
//# sourceMappingURL=generation.js.map