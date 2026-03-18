import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

let genAI: GoogleGenerativeAI | null = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

// ─── System Prompts ───────────────────────────────────────────

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

// ─── Gemini API Functions ─────────────────────────────────────

export async function generateScript(params: {
  productName: string;
  productDescription: string;
  templateName: string;
  avatarPersonality: string;
  tone: string;
  platform: string;
}): Promise<{
  hook: string;
  script: string;
  cta: string;
  captions: string[];
}> {
  if (!genAI) {
    return getMockScript(params);
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `${SYSTEM_PROMPTS.scriptGenerator}

Generate a viral UGC video script with these details:
- Product: ${params.productName}
- Description: ${params.productDescription}
- Template Style: ${params.templateName}
- Avatar Personality: ${params.avatarPersonality}
- Tone: ${params.tone}
- Platform: ${params.platform}

Write the script now:`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return parseScriptResponse(text);
}

export async function generateHooks(params: {
  productName: string;
  productDescription: string;
  tone: string;
}): Promise<string[]> {
  if (!genAI) {
    return [
      `Stop scrolling — ${params.productName} changed everything`,
      `POV: You finally found the perfect ${params.productName}`,
      `Nobody told me about ${params.productName} until now`,
      `I was today years old when I discovered ${params.productName}`,
      `The ${params.productName} hack that broke the internet`,
    ];
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `${SYSTEM_PROMPTS.hookGenerator}

Product: ${params.productName}
Description: ${params.productDescription}
Tone: ${params.tone}

Generate 5 hooks now:`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

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
  if (!genAI) {
    return {
      onScreenCaptions: [
        "Wait for it...",
        `This ${params.productName} is INSANE`,
        "The results speak for themselves",
        "Link in bio",
      ],
      postCaption: `Just discovered ${params.productName} and I'm obsessed. Have you tried it yet? 👇`,
      hashtags: ["#ugc", "#viral", "#fyp", "#trending", "#review"],
    };
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `${SYSTEM_PROMPTS.captionGenerator}

Script: ${params.script}
Platform: ${params.platform}
Product: ${params.productName}

Generate captions now. Return in this exact format:
ON_SCREEN:
[one caption per line]
POST_CAPTION:
[the post caption]
HASHTAGS:
[space-separated hashtags]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return parseCaptionResponse(text);
}

export async function rewriteAsUGC(params: {
  text: string;
  avatarPersonality: string;
  tone: string;
}): Promise<string> {
  if (!genAI) {
    return `Okay so I literally just tried this and I'm shook. ${params.text} — like seriously, where has this been all my life? You NEED to try this.`;
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `${SYSTEM_PROMPTS.ugcToneGenerator}

Rewrite this in UGC style:
"${params.text}"

Avatar personality: ${params.avatarPersonality}
Tone: ${params.tone}

Rewrite now (just the rewritten text, no explanation):`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
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

function getMockScript(params: {
  productName: string;
  templateName: string;
  tone: string;
}): {
  hook: string;
  script: string;
  cta: string;
  captions: string[];
} {
  return {
    hook: `Stop scrolling — you NEED to see this ${params.productName}`,
    script: `[Avatar looks at camera with excitement]
Okay so I've been using ${params.productName} for about a week now and honestly? I'm obsessed.

[Avatar holds up product]
Like I know everyone says that but this one actually delivers. The quality is insane and I can already see the difference.

[Avatar gestures enthusiastically]
What I love most is how easy it is to use. No complicated setup, no learning curve — just results.

[Avatar leans in close]
And the best part? It's way more affordable than I expected. I literally told all my friends about it.

[Avatar points at camera]
You need to try this. Trust me, your future self will thank you.`,
    cta: "Link in bio — go grab yours before it sells out!",
    captions: [
      "Stop scrolling 🛑",
      `${params.productName} changed EVERYTHING`,
      "The results are INSANE",
      "Way more affordable than expected 💰",
      "Link in bio — GO! 🔗",
    ],
  };
}
