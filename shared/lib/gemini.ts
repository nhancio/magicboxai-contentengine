import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// ─── System Prompts ───────────────────────────────────────────
// Kept here for reference if needed, but mostly moved to Cloud Functions
export const SYSTEM_PROMPTS = {
  scriptGenerator: `You are a viral video script writer for UGC (User-Generated Content) style short-form videos.

Your scripts should feel like a real person talking to camera — authentic, engaging, and NOT robotic or overly polished.

Rules:
- Write in first person, conversational tone
- Keep scripts under 60 seconds when read aloud (roughly 150 words)
- Start with a strong hook (first 3 seconds are critical)
- Use pattern interrupts to maintain attention
- End with a clear CTA (call-to-action)
- Include stage directions in [brackets] for avatar actions
- Never use corporate language — write like a real creator
- Match the specified tone (funny, aesthetic, bold, storytelling, etc.)

Output format:
HOOK: [The opening hook line — must stop the scroll]
SCRIPT: [Full script with stage directions]
CTA: [Closing call-to-action]
CAPTIONS: [Key caption text for on-screen display, one per line]`,

  hookGenerator: `You are a viral hook specialist. Your only job is to write scroll-stopping opening lines for short-form video content.

Rules:
- Hooks must be under 10 words
- Create curiosity gaps ("You won't believe...", "Nobody talks about...")
- Use emotional triggers (shock, FOMO, curiosity, relatability)
- Avoid clickbait that doesn't deliver
- Each hook should work as a standalone text overlay
- Generate 5 hooks per request, ranked by predicted engagement

Output format: Return exactly 5 hooks, numbered 1-5, best first.`,

  ugcToneGenerator: `You are a UGC content tone adapter. You take any product description or marketing message and rewrite it in authentic UGC influencer style.

Your output should sound like a real person who genuinely loves a product and is telling their followers about it — NOT like an ad.

Tone characteristics:
- Natural, unscripted feeling
- Personal anecdotes and experiences
- Relatable language ("okay so", "literally", "no but seriously")
- Genuine enthusiasm without being fake
- Appropriate slang for the target demographic
- Imperfect grammar is okay if it sounds natural

Never: Use marketing jargon, sound corporate, or be overtly salesy.`,

  productPromotionScript: `You are a product promotion specialist for UGC-style videos. You create scripts where an AI avatar naturally promotes a product.

Structure every script as:
1. HOOK (0-3s): Attention-grabbing opening
2. PROBLEM (3-8s): Relatable pain point
3. DISCOVERY (8-15s): How they found the product
4. DEMO (15-35s): Showing/explaining the product
5. RESULT (35-45s): The transformation/benefit
6. CTA (45-60s): What to do next

Rules:
- Feel like a genuine recommendation, not a paid ad
- Include specific details about the product
- Use emotional storytelling
- Add [visual cues] for what the avatar should do
- Match the avatar's personality to the script tone`,

  captionGenerator: `You are a social media caption and on-screen text specialist for short-form videos.

Generate:
1. Animated caption text (the words that appear on screen during the video)
2. Post caption (the description/caption for the social media post)
3. Relevant hashtags (5-10, mix of popular and niche)

Rules for on-screen captions:
- Maximum 5-7 words per caption frame
- Highlight key words in ALL CAPS or with emphasis markers
- Time them to the script beats
- Use engaging fonts (specify: bold, handwritten, or clean)

Rules for post captions:
- Under 150 characters for TikTok
- Under 2200 characters for Instagram
- Include a hook in the first line
- End with a question or CTA to drive comments`,
} as const;

// ─── Helper: Convert File to base64 string ────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG to ensure small payload size
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Cloud Function Callers ───────────────────────────────────

export async function analyzeProductPhoto(file: File): Promise<string> {
  if (!functions) {
    throw new Error("Firebase functions not initialized");
  }

  const base64 = await fileToBase64(file);
  const analyzeImageFn = httpsCallable<{ imageBase64: string; prompt: string; mimeType: string }, { text: string }>(functions, "analyzeImage");

  const result = await analyzeImageFn({
    imageBase64: base64,
    mimeType: file.type,
    prompt: "Analyze this product photo in detail. Describe: 1) What the product is, 2) Its key visual features, 3) The quality and design, 4) Who the target audience might be, 5) Key selling points based on appearance. Be specific and detailed. This will be used to generate a UGC video script about this product.",
  });

  return result.data.text;
}

export async function analyzeAvatarPhotos(files: File[]): Promise<{ description: string; personality: string; voiceTone: string }> {
  if (!functions) {
    throw new Error("Firebase functions not initialized");
  }

  const analyzeAvatarPhotosFn = httpsCallable<
    {
      images: Array<{ imageBase64: string; mimeType: string }>;
    },
    { text: string }
  >(functions, "analyzeAvatarPhotos");

  const images = await Promise.all(
    files.slice(0, 10).map(async (file) => ({
      imageBase64: await fileToBase64(file),
      mimeType: file.type,
    }))
  );

  const result = await analyzeAvatarPhotosFn({
    images,
  });

  const text = result.data.text;
  const descMatch = text.match(/DESCRIPTION:\s*(.+?)(?=\nPERSONALITY:)/s);
  const persMatch = text.match(/PERSONALITY:\s*(.+?)(?=\nVOICE_TONE:)/s);
  const voiceMatch = text.match(/VOICE_TONE:\s*(.+?)$/s);

  return {
    description: descMatch?.[1]?.trim() || "A natural content creator with authentic presence.",
    personality: persMatch?.[1]?.trim() || "Content Creator",
    voiceTone: voiceMatch?.[1]?.trim() || "Warm and conversational",
  };
}

export async function analyzeAvatarPhotosFromStorage(
  storagePaths: string[]
): Promise<{ description: string; personality: string; voiceTone: string }> {
  if (!functions) {
    throw new Error("Firebase functions not initialized");
  }

  const analyzeAvatarPhotosFn = httpsCallable<
    {
      storagePaths: string[];
    },
    { text: string }
  >(functions, "analyzeAvatarPhotos");

  const result = await analyzeAvatarPhotosFn({
    storagePaths: storagePaths.slice(0, 10),
  });

  const text = result.data.text;
  const descMatch = text.match(/DESCRIPTION:\s*(.+?)(?=\nPERSONALITY:)/s);
  const persMatch = text.match(/PERSONALITY:\s*(.+?)(?=\nVOICE_TONE:)/s);
  const voiceMatch = text.match(/VOICE_TONE:\s*(.+?)$/s);

  return {
    description: descMatch?.[1]?.trim() || "A natural content creator with authentic presence.",
    personality: persMatch?.[1]?.trim() || "Content Creator",
    voiceTone: voiceMatch?.[1]?.trim() || "Warm and conversational",
  };
}

export async function generateScript(params: {
  productName: string;
  productDescription: string;
  templateName: string;
  avatarPersonality: string;
  tone: string;
  platform: string;
  productPhotoAnalysis?: string;
}): Promise<{
  hook: string;
  script: string;
  cta: string;
  captions: string[];
}> {
  if (!functions) {
    throw new Error("Firebase functions not initialized");
  }

  const generateScriptFn = httpsCallable<{ prompt: string; systemInstruction: string }, { text: string }>(functions, "generateScript");

  const photoContext = params.productPhotoAnalysis
    ? `\n- Product Photo Analysis: ${params.productPhotoAnalysis}`
    : "";

  const prompt = `Generate a viral UGC video script with these details:
- Product: ${params.productName}
- Description: ${params.productDescription}${photoContext}
- Template Style: ${params.templateName}
- Avatar Personality: ${params.avatarPersonality}
- Tone: ${params.tone}
- Platform: ${params.platform}

Write the script now:`;

  const result = await generateScriptFn({
    prompt,
    systemInstruction: SYSTEM_PROMPTS.scriptGenerator,
  });

  return parseScriptResponse(result.data.text);
}

export async function generateHooks(params: {
  productName: string;
  productDescription: string;
  tone: string;
}): Promise<string[]> {
  if (!functions) {
    throw new Error("Firebase functions not initialized");
  }

  const generateScriptFn = httpsCallable<{ prompt: string; systemInstruction: string }, { text: string }>(functions, "generateScript");

  const prompt = `Product: ${params.productName}
Description: ${params.productDescription}
Tone: ${params.tone}

Generate 5 hooks now:`;

  const result = await generateScriptFn({
    prompt,
    systemInstruction: SYSTEM_PROMPTS.hookGenerator,
  });

  const text = result.data.text;
  return text
    .split("\n")
    .filter((line) => line.match(/^\d/))
    .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
    .slice(0, 5);
}

export async function generateCaptions(params: {
  script: string;
  platform: string;
  productName: string;
}): Promise<{
  onScreenCaptions: string[];
  postCaption: string;
  hashtags: string[];
}> {
  if (!functions) {
    throw new Error("Firebase functions not initialized");
  }

  const generateScriptFn = httpsCallable<{ prompt: string; systemInstruction: string }, { text: string }>(functions, "generateScript");

  const prompt = `Script: ${params.script}
Platform: ${params.platform}
Product: ${params.productName}

Generate captions now. Return in this exact format:
ON_SCREEN:
[one caption per line]
POST_CAPTION:
[the post caption]
HASHTAGS:
[space-separated hashtags]`;

  const result = await generateScriptFn({
    prompt,
    systemInstruction: SYSTEM_PROMPTS.captionGenerator,
  });

  return parseCaptionResponse(result.data.text);
}

export async function rewriteAsUGC(params: {
  text: string;
  avatarPersonality: string;
  tone: string;
}): Promise<string> {
  if (!functions) {
    throw new Error("Firebase functions not initialized");
  }

  const generateScriptFn = httpsCallable<{ prompt: string; systemInstruction: string }, { text: string }>(functions, "generateScript");

  const prompt = `Rewrite this in UGC style:
"${params.text}"

Avatar personality: ${params.avatarPersonality}
Tone: ${params.tone}

Rewrite now (just the rewritten text, no explanation):`;

  const result = await generateScriptFn({
    prompt,
    systemInstruction: SYSTEM_PROMPTS.ugcToneGenerator,
  });

  return result.data.text.trim();
}

export type MarketingAssetType = "image" | "video" | "carousel" | "campaign";

export interface MarketingCampaignParams {
  brandName: string;
  productName: string;
  audience: string;
  offer: string;
  goal: string;
  platform: string;
  tone: string;
  assetType: MarketingAssetType;
  templateName: string;
  notes?: string;
}

export interface CarouselSlide {
  title: string;
  body: string;
  visual: string;
}

export interface MarketingCampaignResult {
  headline: string;
  primaryCopy: string;
  imagePrompt: string;
  videoScript: string;
  carouselSlides: CarouselSlide[];
  captions: string[];
  hashtags: string[];
  creativeDirection: string;
}

const MARKETING_SYSTEM_PROMPT = `You are Magicbox AI, a senior performance creative strategist.

Create practical marketing assets for founders, creators, and small teams. Output must be clear enough to paste into a designer, video editor, ad manager, or image generation tool.

Rules:
- Use concise, conversion-focused language.
- Match the selected platform and tone.
- Include image, video, and carousel guidance when relevant.
- Avoid vague hype and generic filler.
- Return only valid JSON with this exact shape:
{
  "headline": "string",
  "primaryCopy": "string",
  "imagePrompt": "string",
  "videoScript": "string",
  "carouselSlides": [{"title": "string", "body": "string", "visual": "string"}],
  "captions": ["string"],
  "hashtags": ["string"],
  "creativeDirection": "string"
}`;

const fallbackMarketingResult = (params: MarketingCampaignParams): MarketingCampaignResult => ({
  headline: `${params.productName} for ${params.audience}`,
  primaryCopy: `${params.productName} helps ${params.audience} move faster with ${params.offer}. Built for ${params.goal.toLowerCase()}.`,
  imagePrompt: `Create a clean ${params.platform} marketing visual for ${params.productName}. Show the product benefit clearly, use ${params.tone.toLowerCase()} styling, add space for a bold headline, and make the offer "${params.offer}" easy to understand.`,
  videoScript: `HOOK: ${params.audience}, this is for you.\nSCENE: Show the problem and introduce ${params.productName}.\nDEMO: Highlight how it helps with ${params.goal.toLowerCase()}.\nCTA: Try ${params.productName} today and claim ${params.offer}.`,
  carouselSlides: [
    {
      title: `Stop losing time on ${params.goal.toLowerCase()}`,
      body: `${params.productName} gives ${params.audience} a simpler path forward.`,
      visual: "Problem-focused opener with a clear before state.",
    },
    {
      title: params.offer,
      body: "Show the strongest benefit in one plain sentence.",
      visual: "Product or workflow close-up with strong contrast.",
    },
    {
      title: "Ready to start?",
      body: "End with a direct CTA and one proof point.",
      visual: "CTA slide with brand color, product shot, and URL area.",
    },
  ],
  captions: [
    `${params.productName} is built for ${params.audience}.`,
    `A faster way to ${params.goal.toLowerCase()}.`,
    `Claim ${params.offer}.`,
  ],
  hashtags: ["#marketing", "#contentcreation", "#aicreator", "#smallbusiness"],
  creativeDirection: `Use the ${params.templateName} template with ${params.tone.toLowerCase()} messaging for ${params.platform}.`,
});

function parseMarketingJson(text: string, params: MarketingCampaignParams): MarketingCampaignResult {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<MarketingCampaignResult>;
    return {
      ...fallbackMarketingResult(params),
      ...parsed,
      carouselSlides: Array.isArray(parsed.carouselSlides) && parsed.carouselSlides.length
        ? parsed.carouselSlides.map((slide) => ({
            title: String(slide.title ?? ""),
            body: String(slide.body ?? ""),
            visual: String(slide.visual ?? ""),
          }))
        : fallbackMarketingResult(params).carouselSlides,
      captions: Array.isArray(parsed.captions) ? parsed.captions.map(String) : fallbackMarketingResult(params).captions,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : fallbackMarketingResult(params).hashtags,
    };
  } catch {
    return {
      ...fallbackMarketingResult(params),
      primaryCopy: text.trim() || fallbackMarketingResult(params).primaryCopy,
    };
  }
}

export async function generateMarketingCampaign(
  params: MarketingCampaignParams
): Promise<MarketingCampaignResult> {
  if (!functions) {
    return fallbackMarketingResult(params);
  }

  const generateScriptFn = httpsCallable<{ prompt: string; systemInstruction: string }, { text: string }>(
    functions,
    "generateScript"
  );

  const prompt = `Create a Magicbox AI marketing package.

Brand: ${params.brandName}
Product or service: ${params.productName}
Audience: ${params.audience}
Offer: ${params.offer}
Goal: ${params.goal}
Platform: ${params.platform}
Tone: ${params.tone}
Requested asset type: ${params.assetType}
Template: ${params.templateName}
Extra notes: ${params.notes || "None"}

Generate the asset package now.`;

  const result = await generateScriptFn({
    prompt,
    systemInstruction: MARKETING_SYSTEM_PROMPT,
  });

  return parseMarketingJson(result.data.text, params);
}

// ─── Parsers ──────────────────────────────────────────────────

function parseScriptResponse(text: string): {
  hook: string;
  script: string;
  cta: string;
  captions: string[];
} {
  const hookMatch = text.match(/HOOK:\s*(.+?)(?=\nSCRIPT:|\n\n)/s);
  const scriptMatch = text.match(/SCRIPT:\s*(.+?)(?=\nCTA:|\n\n)/s);
  const ctaMatch = text.match(/CTA:\s*(.+?)(?=\nCAPTIONS:|\n\n|$)/s);
  const captionsMatch = text.match(/CAPTIONS:\s*(.+?)$/s);

  return {
    hook: hookMatch?.[1]?.trim() || "Check this out!",
    script: scriptMatch?.[1]?.trim() || text,
    cta: ctaMatch?.[1]?.trim() || "Link in bio!",
    captions: captionsMatch?.[1]
      ?.split("\n")
      .map((l) => l.trim())
      .filter(Boolean) || ["Check this out!"],
  };
}

function parseCaptionResponse(text: string): {
  onScreenCaptions: string[];
  postCaption: string;
  hashtags: string[];
} {
  const onScreenMatch = text.match(
    /ON_SCREEN:\s*\n([\s\S]*?)(?=\nPOST_CAPTION:)/
  );
  const postMatch = text.match(
    /POST_CAPTION:\s*\n([\s\S]*?)(?=\nHASHTAGS:)/
  );
  const hashtagsMatch = text.match(/HASHTAGS:\s*\n([\s\S]*?)$/);

  return {
    onScreenCaptions: onScreenMatch?.[1]
      ?.split("\n")
      .map((l) => l.trim())
      .filter(Boolean) || ["Check this out!"],
    postCaption: postMatch?.[1]?.trim() || "",
    hashtags: hashtagsMatch?.[1]
      ?.trim()
      .split(/\s+/)
      .filter((h) => h.startsWith("#")) || ["#ugc", "#viral"],
  };
}
