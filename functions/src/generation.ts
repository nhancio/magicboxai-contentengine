// Content generation pipeline for automation posts: Gemini captions per
// platform, Imagen images. Video posts reuse the existing Veo pipeline via
// the avatar/UGC flow and attach media before scheduling (manual source).

import { v4 as uuidv4 } from "uuid";
import { db, getAI, getBucket, getPublicUrl, stringifyError } from "./core";
import type { BrandProfileDoc, PostDoc, SocialPlatform } from "./core";
import { buildContentPrompt, buildImagePrompt } from "./prompts/marketingPrompts";

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
    model: "gemini-2.0-flash",
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

/**
 * Generate all content for a post (captions per platform + optional image)
 * and return the fields to merge onto the post doc.
 */
export async function generatePostAssets(
  postId: string,
  post: PostDoc
): Promise<Partial<PostDoc>> {
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

  if (post.contentTypes?.image) {
    try {
      const image = await generatePostImage({
        userId: post.userId,
        postId,
        brand,
        brief: post.brief,
        caption: primary.caption,
      });
      update.media = [
        ...(post.media ?? []),
        { type: "image", url: image.url, storagePath: image.storagePath, source: "imagen" },
      ];
    } catch (error) {
      // Image failure shouldn't kill the post — caption-only is still postable.
      console.error(`[generatePostAssets] image generation failed for ${postId}:`, stringifyError(error));
    }
  }

  return update;
}
