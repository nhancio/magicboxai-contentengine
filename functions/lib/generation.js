"use strict";
// Content generation pipeline for automation posts: Gemini captions per
// platform, Imagen images. Video posts reuse the existing Veo pipeline via
// the avatar/UGC flow and attach media before scheduling (manual source).
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCaptionForPlatform = generateCaptionForPlatform;
exports.generatePostImage = generatePostImage;
exports.generatePostAssets = generatePostAssets;
const uuid_1 = require("uuid");
const core_1 = require("./core");
const marketingPrompts_1 = require("./prompts/marketingPrompts");
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
        model: "gemini-2.0-flash",
        contents: prompt,
        config: { systemInstruction },
    });
    return parseJsonBlock((_a = result.text) !== null && _a !== void 0 ? _a : "");
}
async function generatePostImage(args) {
    var _a, _b, _c;
    const ai = (0, core_1.getAI)();
    const prompt = (0, marketingPrompts_1.buildImagePrompt)({
        brand: args.brand,
        brief: args.brief,
        caption: args.caption,
    });
    const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-001",
        prompt: prompt.slice(0, 4000),
        config: {
            numberOfImages: 1,
            outputMimeType: "image/png",
            aspectRatio: "1:1",
        },
    });
    const imageBytes = (_c = (_b = (_a = response.generatedImages) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.image) === null || _c === void 0 ? void 0 : _c.imageBytes;
    if (!imageBytes)
        throw new Error("No image returned from Imagen");
    const storagePath = `posts/${args.postId}/${(0, uuid_1.v4)()}.png`;
    const file = (0, core_1.getBucket)().file(storagePath);
    await file.save(Buffer.from(imageBytes, "base64"), {
        metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
    });
    await file.makePublic();
    return { url: (0, core_1.getPublicUrl)(storagePath), storagePath };
}
/**
 * Generate all content for a post (captions per platform + optional image)
 * and return the fields to merge onto the post doc.
 */
async function generatePostAssets(postId, post) {
    var _a, _b, _c, _d;
    const brand = await getBrand(post.brandProfileId);
    const preset = (_a = post.preset) !== null && _a !== void 0 ? _a : "custom";
    const tone = (_b = post.tone) !== null && _b !== void 0 ? _b : "";
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
    if ((_c = post.contentTypes) === null || _c === void 0 ? void 0 : _c.image) {
        try {
            const image = await generatePostImage({
                userId: post.userId,
                postId,
                brand,
                brief: post.brief,
                caption: primary.caption,
            });
            update.media = [
                ...((_d = post.media) !== null && _d !== void 0 ? _d : []),
                { type: "image", url: image.url, storagePath: image.storagePath, source: "imagen" },
            ];
        }
        catch (error) {
            // Image failure shouldn't kill the post — caption-only is still postable.
            console.error(`[generatePostAssets] image generation failed for ${postId}:`, (0, core_1.stringifyError)(error));
        }
    }
    return update;
}
//# sourceMappingURL=generation.js.map