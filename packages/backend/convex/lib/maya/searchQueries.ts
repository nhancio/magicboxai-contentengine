/**
 * JSON schema for Gemini's `responseSchema` when generating brand-matched
 * reel search queries (see lib/gemini.ts geminiJson).
 */
export const SEARCH_QUERY_SCHEMA = {
  type: "object",
  properties: {
    queries: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 5,
    },
  },
  required: ["queries"],
} as const;

/**
 * Turns raw brand context into search queries for the trending-reel API,
 * targeting the specific viral Indian AI-animation genres that actually
 * exist on Instagram/Monid — superhero/cartoon parodies with an Indian mom,
 * talking animals, and animated objects — rather than generic "AI avatar"
 * phrasing that's too vague to reliably surface them.
 */
export function buildSearchQueryPrompt(
  brandName: string,
  industry?: string,
  productOffering?: string,
  audience?: string,
  toneOfVoice?: string,
): string {
  return `You are a viral meme research strategist specializing in Indian AI brainrot and animated reels.

Your task is to generate 5 specific search keywords for an Instagram Reel search API to find ONLY viral AI-generated, animated, and character-driven meme videos that can be adapted to promote a brand.

STRICT CONTENT REQUIREMENTS:
1. NO REAL HUMANS: Exclude all real-person vlogs, influencer selfie rants, and live-action creator videos.
2. TARGET FORMATS:
   - Indian Superhero/Cartoon Parodies: Viral 3D animation clips of Spider-Man, Hulk, Iron Man, or Shinchan interacting with an Indian mom/family discussing household problems or funny scenarios.
   - Talking Animals: AI cats, dogs, or wildlife talking in Hindi/English, arguing, or reviewing/recommending products.
   - Animated Inanimate Objects: 3D rendered animated objects (e.g., talking phones, shoes, coffee cups, wallets) with expressive faces.
   - Pure 3D Cartoon Memes: Pixar-style or desi 3D animated characters in relatable viral situations.

BRAND CONTEXT:
- Brand Name: ${brandName}
- Industry/Niche: ${industry || "General"}
- Product Offering: ${productOffering || "Not specified"}
- Target Audience: ${audience || "Not specified"}
- Tone of Voice: ${toneOfVoice || "Not specified"}

Generate 5 high-converting search queries combining AI/3D animation indicators with viral Indian meme keywords. Only pick formats above that plausibly fit this brand — don't force a mismatch.

Output format:
{
  "queries": [
    "ai spiderman hulk indian mummy meme reel",
    "ai talking cat hindi comedy reel",
    "3d animated indian mom spiderman argument",
    "ai generated talking dog promoting product",
    "3d cartoon object talking animation meme india"
  ]
}`;
}

/** Used when Gemini is unavailable — still AI-generated-biased, just not brand-tailored. */
export const GENERIC_FALLBACK_QUERIES = [
  "ai spiderman hulk mummy meme",
  "3d animated indian mom spiderman argument reel",
  "ai talking cat hindi comedy brainrot",
  "ai cartoon dog talking reaction meme",
  "3d animated object talking funny promo reel",
];
