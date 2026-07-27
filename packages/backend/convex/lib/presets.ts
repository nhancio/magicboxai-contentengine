import type { PlatformId } from "./providers/types";

/**
 * The canonical Studio preset catalogue — ONE source of truth.
 *
 * Today presets are duplicated and inconsistent: `shared/lib/templates.ts` has
 * 12 VIRAL_TEMPLATES used only by VideoCreator, while ContentStudio hard-codes a
 * different, unrelated set of 4 caption templates. Neither knows about the other.
 * Everything preset-driven should read from here.
 *
 * A preset answers: what inputs do we collect, what media do we make, and how do
 * we prompt for it.
 */

export type PresetInput =
  | "avatar"
  | "context"
  | "images"
  | "prompt"
  | "referenceVideo"
  | "productName";

export type Preset = {
  id: string;
  name: string;
  description: string;
  /** Where this format actually performs. */
  platforms: PlatformId[];
  mediaType: "video" | "image" | "none";
  /** Inputs the Studio form should collect. `required` gates the generate button. */
  inputs: { key: PresetInput; required: boolean; label: string }[];
  /** Directing block appended to the media prompt. */
  direction: string;
  /** Copy structure the caption generator must follow. */
  structure: string;
};

export const PRESETS: Preset[] = [
  {
    id: "talking-head-ugc",
    name: "Talking-head UGC",
    description: "Your avatar talks straight to camera. The format that still converts best.",
    platforms: ["instagram", "youtube", "facebook", "whatsapp"],
    mediaType: "video",
    inputs: [
      { key: "avatar", required: true, label: "Avatar" },
      { key: "prompt", required: true, label: "What should they say?" },
      { key: "images", required: false, label: "Product photo" },
      { key: "context", required: false, label: "Extra context" },
    ],
    direction:
      "Vertical 9:16. Creator-style lighting, natural room. Character faces camera and speaks the " +
      "script. Restrained, realistic gesture and lip sync. No surreal transformation or warped hands.",
    structure:
      "HOOK (0-3s) -> the claim -> one specific proof -> CTA. First line must stop the scroll.",
  },
  {
    id: "problem-solution",
    name: "Problem → Solution",
    description: "Name a pain the audience feels, then reveal the fix.",
    platforms: ["instagram", "linkedin", "facebook", "youtube"],
    mediaType: "video",
    inputs: [
      { key: "prompt", required: true, label: "The problem" },
      { key: "avatar", required: false, label: "Avatar" },
      { key: "images", required: false, label: "Product photo" },
      { key: "context", required: false, label: "Extra context" },
    ],
    direction:
      "Vertical 9:16. Open on the frustration, land on visible relief. Clear reveal moment at the turn.",
    structure: "PAIN (relatable, specific) -> why the usual fix fails -> the reveal -> CTA.",
  },
  {
    id: "listicle",
    name: "3 Reasons / Listicle",
    description: "Numbered, fast-paced, easy to finish. Strong completion rate.",
    platforms: ["instagram", "linkedin", "youtube"],
    mediaType: "video",
    inputs: [
      { key: "prompt", required: true, label: "The topic" },
      { key: "avatar", required: false, label: "Avatar" },
      { key: "context", required: false, label: "Extra context" },
    ],
    direction:
      "Vertical 9:16. Snappy cuts on each item. On-screen number for every beat. Keep energy up.",
    structure: "HOOK naming the number -> item 1 -> item 2 -> item 3 (best last) -> CTA.",
  },
  {
    id: "product-demo",
    name: "Product demo",
    description: "Show the thing working. Best when the product is visual.",
    platforms: ["instagram", "youtube", "facebook", "whatsapp"],
    mediaType: "video",
    inputs: [
      { key: "productName", required: true, label: "Product" },
      { key: "images", required: true, label: "Product photos" },
      { key: "prompt", required: false, label: "What to emphasise" },
      { key: "avatar", required: false, label: "Avatar" },
      { key: "referenceVideo", required: false, label: "Reference video (style)" },
    ],
    direction:
      "Vertical 9:16. Product clearly visible for most of the clip, handled naturally. Never change " +
      "the product's colour, shape or category from the reference photo.",
    structure: "HOOK -> what it is -> the one benefit that matters -> proof -> CTA.",
  },
  {
    id: "trend-reaction",
    name: "Trend reaction",
    description: "React to something happening right now. Highest reach, shortest shelf life.",
    platforms: ["instagram", "twitter", "linkedin"],
    mediaType: "image",
    inputs: [
      { key: "prompt", required: true, label: "The trend / your take" },
      { key: "context", required: false, label: "Extra context" },
      { key: "images", required: false, label: "Image" },
    ],
    direction: "Bold, high-contrast, text-forward. Readable at thumbnail size.",
    structure: "The trend in one line -> your contrarian or additive take -> why it matters -> CTA.",
  },
  {
    id: "text-post",
    name: "Text post",
    description: "No media. Pure copy — LinkedIn and X's native format.",
    platforms: ["linkedin", "twitter", "facebook"],
    mediaType: "none",
    inputs: [
      { key: "prompt", required: true, label: "What's the point?" },
      { key: "context", required: false, label: "Extra context" },
    ],
    direction: "",
    structure:
      "Strong first line (it's the only thing shown before 'see more') -> the insight -> a concrete " +
      "example -> a question that invites replies.",
  },
  // --- Ported from Video Creator VIRAL_TEMPLATES ---
  {
    id: "grwm",
    name: "Get Ready With Me",
    description: "Casual routine that naturally introduces the product.",
    platforms: ["instagram", "youtube", "facebook"],
    mediaType: "video",
    inputs: [
      { key: "avatar", required: true, label: "Avatar" },
      { key: "productName", required: false, label: "Product" },
      { key: "images", required: false, label: "Product photo" },
      { key: "prompt", required: true, label: "What are you getting ready for?" },
    ],
    direction:
      "Vertical 9:16. Intimate creator lighting. Natural chat while getting ready; product appears casually.",
    structure: "HOOK inviting viewer along -> setup -> soft product intro -> use moment -> soft CTA.",
  },
  {
    id: "unboxing",
    name: "Unboxing",
    description: "First impressions as the package opens.",
    platforms: ["instagram", "youtube", "facebook"],
    mediaType: "video",
    inputs: [
      { key: "avatar", required: false, label: "Avatar" },
      { key: "productName", required: true, label: "Product" },
      { key: "images", required: true, label: "Product photos" },
      { key: "prompt", required: false, label: "What to highlight" },
    ],
    direction: "Vertical 9:16. Build anticipation on the package, genuine first-look reaction.",
    structure: "HOOK with package -> unbox -> first look -> first use -> verdict -> CTA.",
  },
  {
    id: "before-after",
    name: "Before & After",
    description: "Show the transformation — problem state to result.",
    platforms: ["instagram", "youtube", "facebook", "linkedin"],
    mediaType: "video",
    inputs: [
      { key: "avatar", required: false, label: "Avatar" },
      { key: "images", required: true, label: "Before/after or product photos" },
      { key: "prompt", required: true, label: "The transformation" },
      { key: "productName", required: false, label: "Product" },
    ],
    direction: "Vertical 9:16. Clear before state, punchy reveal to after. Keep product honest.",
    structure: "HOOK naming the change -> before pain -> the turn -> after proof -> CTA.",
  },
  {
    id: "storytime",
    name: "Storytime",
    description: "Narrative that earns the product mention.",
    platforms: ["instagram", "youtube", "linkedin"],
    mediaType: "video",
    inputs: [
      { key: "avatar", required: true, label: "Avatar" },
      { key: "prompt", required: true, label: "The story" },
      { key: "productName", required: false, label: "Product" },
      { key: "context", required: false, label: "Extra context" },
    ],
    direction: "Vertical 9:16. Talking-head storytelling, natural gesture, hold for the punchline.",
    structure: "HOOK as a cliffhanger -> setup -> conflict -> discovery -> lesson -> CTA.",
  },
  {
    id: "hot-take",
    name: "Hot take",
    description: "Unpopular opinion that sparks comments.",
    platforms: ["instagram", "linkedin", "twitter", "youtube"],
    mediaType: "video",
    inputs: [
      { key: "avatar", required: false, label: "Avatar" },
      { key: "prompt", required: true, label: "Your hot take" },
      { key: "context", required: false, label: "Proof / nuance" },
    ],
    direction: "Vertical 9:16. Bold text + confident delivery. High energy first 3 seconds.",
    structure: "Controversial HOOK -> why most people are wrong -> your take with proof -> invite debate.",
  },
  {
    id: "pov",
    name: "POV discovery",
    description: "POV: you just found the thing everyone needs.",
    platforms: ["instagram", "youtube", "facebook"],
    mediaType: "video",
    inputs: [
      { key: "avatar", required: false, label: "Avatar" },
      { key: "productName", required: true, label: "Product" },
      { key: "images", required: true, label: "Product photos" },
      { key: "prompt", required: false, label: "The discovery moment" },
    ],
    direction: "Vertical 9:16. POV framing, quick cuts, product hero shots.",
    structure: "POV HOOK -> the problem you had -> discovery -> demo beat -> CTA.",
  },
  {
    id: "comparison",
    name: "This vs That",
    description: "Fair comparison that crowns a winner.",
    platforms: ["instagram", "youtube", "linkedin"],
    mediaType: "video",
    inputs: [
      { key: "productName", required: true, label: "Your product" },
      { key: "images", required: true, label: "Product photos" },
      { key: "prompt", required: true, label: "What are you comparing against?" },
      { key: "avatar", required: false, label: "Avatar" },
    ],
    direction: "Vertical 9:16. Side-by-side beats, clear criteria, honest verdict.",
    structure: "HOOK promising a test -> criterion 1 -> 2 -> 3 -> winner -> CTA.",
  },
];

export function getPreset(id: string): Preset {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset: ${id}`);
  return p;
}
