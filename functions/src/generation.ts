// Content generation pipeline for automation posts: Gemini captions per
// platform, Imagen images, Veo text-to-video clips (for YouTube / Reels).

import { v4 as uuidv4 } from "uuid";
import {
  assertVeoGenerationEnabled,
  db,
  getAI,
  getBucket,
  getPublicUrl,
  stringifyError,
} from "./core";
import type { BrandProfileDoc, PostDoc, SocialPlatform } from "./core";
import { buildContentPrompt, buildImagePrompt } from "./prompts/marketingPrompts";
import { generateVeoVideo } from "./video/googleVeo";

function parseJsonBlock(text: string): { caption: string; hashtags: string[] } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as { caption?: string; hashtags?: string[] };
  if (!parsed.caption) throw new Error("Model returned no caption");
  return { caption: parsed.caption, hashtags: parsed.hashtags ?? [] };
}

async function getBrand(brandProfileId?: string): Promise<BrandProfileDoc | null> {
  if (!brandProfileId) return null;
  const snap = await db.collection("brandProfiles").doc(brandProfileId).get();
  return snap.exists ? (snap.data() as BrandProfileDoc) : null;
}

export async function generateCaptionForPlatform(args: {
  brand: BrandProfileDoc | null;
  brief: string;
  preset: string;
  tone: string;
  platform: SocialPlatform;
}): Promise<{ caption: string; hashtags: string[] }> {
  const ai = getAI();
  const { systemInstruction, prompt } = buildContentPrompt({
    brand: args.brand,
    automation: { brief: args.brief, preset: args.preset, tone: args.tone },
    platform: args.platform,
  });
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash-001",
    contents: prompt,
    config: { systemInstruction },
  });
  return parseJsonBlock(result.text ?? "");
}

export async function generatePostImage(args: {
  userId: string;
  postId: string;
  brand: BrandProfileDoc | null;
  brief: string;
  caption?: string;
}): Promise<{ url: string; storagePath: string }> {
  const ai = getAI();
  const prompt = buildImagePrompt({
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
  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) throw new Error("No image returned from Imagen");

  const storagePath = `posts/${args.postId}/${uuidv4()}.png`;
  const file = getBucket().file(storagePath);
  await file.save(Buffer.from(imageBytes, "base64"), {
    metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
  });
  await file.makePublic();
  return { url: getPublicUrl(storagePath), storagePath };
}

export async function generatePostVideo(args: {
  postId: string;
  brand: BrandProfileDoc | null;
  brief: string;
  caption?: string;
}): Promise<{ url: string; storagePath: string }> {
  assertVeoGenerationEnabled();
  const ai = getAI();
  const bucket = getBucket();
  const outputStoragePrefix = `posts/${args.postId}/${uuidv4()}/`;

  const prompt = [
    "Create a short, scroll-stopping vertical social media video clip.",
    "One clear subject, cinematic lighting, smooth camera movement, no on-screen text.",
    args.brand ? `Brand: ${args.brand.name} (${args.brand.industry}).` : "",
    "The clip accompanies this social post:",
    (args.caption ?? args.brief).slice(0, 800),
  ]
    .filter(Boolean)
    .join("\n");

  const generated = await generateVeoVideo({
    ai,
    prompt,
    aspectRatio: "9:16",
    durationSeconds: 8,
    outputGcsUri: `gs://${bucket.name}/${outputStoragePrefix}`,
  });

  const file = bucket.file(generated.storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Generated video file not found in storage");
  await file.makePublic();
  return {
    url: getPublicUrl(generated.storagePath),
    storagePath: generated.storagePath,
  };
}

/**
 * Generate all content for a post (captions per platform + optional
 * image/video) and return the fields to merge onto the post doc.
 */
export async function generatePostAssets(
  postId: string,
  post: PostDoc
): Promise<Partial<PostDoc>> {
  // Fail the whole video job before caption/image/provider work instead of
  // silently degrading a video request into a different asset type.
  if (post.contentTypes?.video) assertVeoGenerationEnabled();

  const brand = await getBrand(post.brandProfileId);
  const preset = post.preset ?? "custom";
  const tone = post.tone ?? "";

  const platforms = post.platforms.length ? post.platforms : (["instagram"] as SocialPlatform[]);

  // Primary caption from the first platform; per-platform variants for the rest.
  const captions = await Promise.all(
    platforms.map(async (platform) => ({
      platform,
      result: await generateCaptionForPlatform({
        brand,
        brief: post.brief,
        preset,
        tone,
        platform,
      }),
    }))
  );

  const primary = captions[0].result;
  const perPlatform: Partial<Record<SocialPlatform, { caption: string }>> = {};
  for (const { platform, result } of captions) {
    perPlatform[platform] = { caption: result.caption };
  }

  const update: Partial<PostDoc> = {
    content: {
      caption: primary.caption,
      hashtags: primary.hashtags,
      perPlatform,
    },
  };

  const media = [...(post.media ?? [])];

  // Video first: platforms like YouTube require it, and publishing picks the
  // first usable media item.
  if (post.contentTypes?.video && !media.some((m) => m.type === "video")) {
    try {
      const video = await generatePostVideo({
        postId,
        brand,
        brief: post.brief,
        caption: primary.caption,
      });
      media.push({ type: "video", url: video.url, storagePath: video.storagePath, source: "veo" });
    } catch (error) {
      const needsVideo = platforms.includes("youtube");
      console.error(`[generatePostAssets] video generation failed for ${postId}:`, stringifyError(error));
      // YouTube can't post without a video — fail the post so it retries.
      if (needsVideo && !post.contentTypes?.image) throw error;
    }
  }

  if (post.contentTypes?.image) {
    try {
      const image = await generatePostImage({
        userId: post.userId,
        postId,
        brand,
        brief: post.brief,
        caption: primary.caption,
      });
      media.push({ type: "image", url: image.url, storagePath: image.storagePath, source: "imagen" });
    } catch (error) {
      // Image failure shouldn't kill the post — caption-only is still postable.
      console.error(`[generatePostAssets] image generation failed for ${postId}:`, stringifyError(error));
    }
  }

  if (media.length) update.media = media;

  return update;
}
