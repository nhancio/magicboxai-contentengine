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
  /** Broad grouping used by the Studio picker. */
  category?: "Evergreen" | "Product" | "Education" | "Story" | "Trending";
  /** A useful default brief so choosing a template can be a one-click action. */
  starterPrompt?: string;
  /** Live trend phrases that make this format especially relevant today. */
  trendSignals?: string[];
  /** Explains any asset/licensing constraint before generation. */
  rightsNote?: string;
  /** Stable tie-breaker when no live signal matches. Higher values surface first. */
  priority?: number;
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

export type TemplateTrendEvidence = {
  platform?: string;
  kind?: string;
  value: string;
  title?: string;
  score?: number;
};

export type RankedPreset = Preset & {
  trendScore: number;
  isTrending: boolean;
  matchedTrend?: string;
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function signalMatches(signal: string, evidence: TemplateTrendEvidence): boolean {
  const needle = normalized(signal);
  const haystack = normalized(
    [evidence.kind, evidence.value, evidence.title].filter(Boolean).join(" "),
  );
  if (!needle || !haystack) return false;
  if (haystack.includes(needle) || needle.includes(haystack)) return true;

  const meaningfulWords = needle.split(" ").filter((word) => word.length >= 4);
  return meaningfulWords.length > 0 && meaningfulWords.every((word) => haystack.includes(word));
}

/**
 * Rank the durable template catalogue against the short-lived trend brief.
 * The template itself stays versioned; only its ordering and evidence badge
 * change as the daily trend rows change.
 */
export function rankPresetsForTrends(args: {
  trends: TemplateTrendEvidence[];
  platforms?: string[];
  mediaType?: Preset["mediaType"];
}): RankedPreset[] {
  const targetPlatforms = new Set((args.platforms ?? []).map(normalized));

  return PRESETS.filter((preset) => {
    if (args.mediaType && preset.mediaType !== args.mediaType) return false;
    if (targetPlatforms.size === 0) return true;
    return preset.platforms.some((platform) => targetPlatforms.has(normalized(platform)));
  })
    .map((preset) => {
      const matches = args.trends
        .filter(
          (trend) =>
            !trend.platform ||
            targetPlatforms.size === 0 ||
            targetPlatforms.has(normalized(trend.platform)),
        )
        .filter((trend) =>
          (preset.trendSignals ?? []).some((signal) => signalMatches(signal, trend)),
        )
        .sort((a, b) => (b.score ?? 0.5) - (a.score ?? 0.5));
      const strongest = matches[0];
      const trendScore = strongest ? Math.max(0, Math.min(1, strongest.score ?? 0.5)) : 0;

      return {
        ...preset,
        trendScore,
        isTrending: trendScore >= 0.45,
        matchedTrend: strongest?.value,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isTrending) - Number(a.isTrending) ||
        b.trendScore - a.trendScore ||
        (b.priority ?? 0) - (a.priority ?? 0) ||
        a.name.localeCompare(b.name),
    );
}

export const PRESETS: Preset[] = [
  {
    id: "talking-head-ugc",
    name: "Talking-head UGC",
    description: "Your avatar talks straight to camera. The format that still converts best.",
    category: "Evergreen",
    starterPrompt:
      "Introduce the brand's most useful offer through one specific customer problem and one truthful proof point.",
    trendSignals: ["creator led", "talking head", "relatable", "original content"],
    priority: 80,
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
    category: "Product",
    starterPrompt:
      "Show a specific problem the brand's audience faces, why the usual workaround fails, and the simplest honest solution.",
    trendSignals: ["solution", "brainwash you", "problem", "before after"],
    priority: 76,
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
    category: "Education",
    starterPrompt:
      "Teach three useful things the brand's audience should know, putting the most actionable point last.",
    trendSignals: ["three things", "list", "tips", "checks before"],
    priority: 70,
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
    category: "Product",
    starterPrompt:
      "Demonstrate the brand's main product or service solving one visible, specific customer problem.",
    trendSignals: ["product discovery", "product demo", "unboxing", "behind the scenes"],
    priority: 78,
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
    category: "Trending",
    starterPrompt:
      "Choose the strongest current trend that genuinely fits the brand and add one useful, original point of view.",
    trendSignals: ["trend", "reaction", "current conversation", "original audio"],
    priority: 45,
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
    id: "branded-story-image",
    name: "Brand Story Image",
    description:
      "A polished 4:5 visual built around one product, process, person, or customer moment from the brand.",
    category: "Evergreen",
    starterPrompt:
      "Choose the strongest truthful visual story from the brand website and express it as one clear, emotionally legible image.",
    trendSignals: ["photo dump", "product discovery", "behind the scenes", "visual diary"],
    priority: 74,
    platforms: ["instagram", "linkedin", "facebook", "twitter", "whatsapp"],
    mediaType: "image",
    inputs: [
      { key: "images", required: false, label: "Brand or product image" },
      { key: "prompt", required: false, label: "Moment to feature" },
    ],
    direction:
      "One focal subject in 4:5 portrait framing, brand-related environment, restrained palette relationship, " +
      "natural depth, clean edge and caption safe zones, legible at phone-thumbnail size. No generated text, " +
      "logo, watermark, collage clutter, or unsupported product details.",
    structure:
      "IMAGE HOOK: one immediately recognizable subject or contrast -> CAPTION: context and value -> CTA: one natural next step.",
  },
  {
    id: "text-post",
    name: "Text post",
    description: "No media. Pure copy — LinkedIn and X's native format.",
    category: "Evergreen",
    starterPrompt:
      "Share one precise lesson from the brand's work, support it with a concrete example, and invite a relevant response.",
    trendSignals: ["professional insight", "founder story", "lesson"],
    priority: 60,
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
    id: "miniature-crew",
    name: "Miniature Crew",
    description:
      "Tiny workers build, clean, plate, pack, or inspect an oversized product in a satisfying macro world.",
    category: "Trending",
    starterPrompt:
      "Turn the brand's main product, service, or workflow into an oversized miniature worksite where tiny original workers visibly complete the real process.",
    trendSignals: [
      "tiny workers",
      "miniature workers",
      "miniature world",
      "behind the scenes",
      "oddly satisfying",
      "ai video",
    ],
    priority: 92,
    platforms: ["instagram", "youtube", "facebook"],
    mediaType: "video",
    inputs: [
      { key: "productName", required: false, label: "Product or service" },
      { key: "images", required: false, label: "Product photo" },
      { key: "prompt", required: false, label: "What should the crew build?" },
    ],
    direction:
      "One coherent vertical 9:16 macro scene. An oversized, brand-accurate product fills the frame while " +
      "tiny original workers perform one observable process with miniature tools. Slow dolly left-to-right, " +
      "tilt-shift depth of field, tactile materials, soft commercial lighting, realistic scale, continuous motion, " +
      "clean lower-third and top safe zones. No text, watermark, duplicate workers, floating tools, or scale changes.",
    structure:
      "VISUAL HOOK (0-2s): reveal the impossible scale -> PROCESS (2-8s): three visible work beats -> " +
      "PAYOFF (8-12s): finished product hero reveal -> CTA in caption.",
  },
  {
    id: "comic-duo-banter",
    name: "Comic Duo Banter",
    description:
      "Motu Patlu-style buddy-comedy rhythm with two original characters: impulsive setup, clever fix, fast payoff.",
    category: "Trending",
    starterPrompt:
      "Create a short original buddy-comedy scene where one character makes a relatable mistake involving the brand problem and the other demonstrates the useful fix.",
    trendSignals: ["comedy", "comic", "duo", "banter", "reaction", "micro drama", "relatable"],
    rightsNote:
      "Use original characters, or user-supplied assets licensed for Motu Patlu. Never recreate protected character designs, names, voices, costumes, or locations from text alone.",
    priority: 88,
    platforms: ["instagram", "youtube", "facebook"],
    mediaType: "video",
    inputs: [
      { key: "prompt", required: false, label: "The comic situation" },
      { key: "productName", required: false, label: "Product or service" },
      { key: "images", required: false, label: "Licensed character reference" },
    ],
    direction:
      "Original stylized 3D buddy-comedy duo only: Character A is impulsive and expressive; Character B is calm " +
      "and resourceful. Medium two-shot, clear eyelines, readable silhouettes, three quick reaction cuts, warm " +
      "daylight, vertical 9:16 safe zones, consistent faces and costumes. Do not name, depict, imitate, or clone " +
      "Motu, Patlu, Furfuri Nagar, signature costumes, or recognizable voices unless licensed reference assets are supplied.",
    structure:
      "COLD OPEN (0-2s): mistake already in motion -> BANTER (2-6s): two-line escalation -> " +
      "FIX (6-10s): product or lesson resolves it -> REACTION LOOP (10-12s): visual callback.",
  },
  {
    id: "work-chaos-punchline",
    name: "Work Chaos Punchline",
    description:
      "A painfully specific workplace mistake, hard-cut to the product or process that saves the moment.",
    category: "Trending",
    starterPrompt:
      "Choose one harmless, highly specific mistake the brand's audience makes at work and turn it into a two-beat visual joke with a useful fix.",
    trendSignals: ["ai will replace you", "ai is going to take your job", "workplace mistake", "work chaos"],
    priority: 84,
    platforms: ["instagram", "linkedin", "youtube", "facebook"],
    mediaType: "video",
    inputs: [
      { key: "prompt", required: false, label: "The relatable work mistake" },
      { key: "productName", required: false, label: "Product or service" },
    ],
    direction:
      "Vertical 9:16, creator-shot workplace realism. Open mid-mistake, hold just long enough for recognition, " +
      "then hard cut to the clean fix. Natural light, restrained handheld motion, readable text-safe negative space, " +
      "one location, no fake performance claims.",
    structure:
      "RELATABLE SETUP (0-3s) -> HARD-CUT PUNCHLINE (3-5s) -> USEFUL FIX (5-10s) -> LOOPING CALLBACK (10-12s).",
  },
  {
    id: "scrollable-moodboard",
    name: "Living Moodboard",
    description:
      "A short sequence of tactile details that feels like a moving visual moodboard rather than an advertisement.",
    category: "Trending",
    starterPrompt:
      "Build a five-shot visual moodboard from the brand's website palette, product details, people, and real environment, ending on one clear brand payoff.",
    trendSignals: ["mood board", "moodboard", "photo dump", "capture it", "visual diary", "nostalgia"],
    priority: 82,
    platforms: ["instagram", "youtube", "facebook"],
    mediaType: "video",
    inputs: [
      { key: "images", required: false, label: "Brand imagery" },
      { key: "prompt", required: false, label: "Mood or campaign moment" },
    ],
    direction:
      "Five connected vertical 9:16 detail shots with matching color and light: texture, hands, environment, " +
      "product detail, final wide reveal. Gentle match cuts, subtle film grain, slow push-ins, no random stock imagery, " +
      "keep interface safe zones clear and make the final frame loop naturally into the first.",
    structure:
      "TEXTURE HOOK (0-2s) -> THREE CONNECTED DETAILS (2-8s) -> BRAND REVEAL (8-11s) -> SEAMLESS LOOP (11-12s).",
  },
  {
    id: "grwm",
    name: "Get Ready With Me",
    description: "Casual routine that naturally introduces the product.",
    category: "Story",
    starterPrompt:
      "Bring the audience through a real getting-ready moment and introduce the brand naturally during the routine.",
    trendSignals: ["get ready with me", "grwm", "routine", "beauty", "fashion"],
    priority: 68,
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
    category: "Product",
    starterPrompt:
      "Unbox the brand's product with a tactile first-look sequence and one honest observation about the experience.",
    trendSignals: ["unboxing", "first look", "asmr", "product discovery"],
    priority: 66,
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
    category: "Product",
    starterPrompt:
      "Show an honest before-and-after transformation supported by the brand's real product, process, or evidence.",
    trendSignals: ["before after", "transformation", "reveal"],
    priority: 72,
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
    category: "Story",
    starterPrompt:
      "Tell one true founder, customer, or process story that starts at the moment something changed.",
    trendSignals: ["storytime", "micro drama", "founder story", "story"],
    priority: 65,
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
    category: "Trending",
    starterPrompt:
      "Correct one familiar industry belief with a useful, evidence-supported explanation from the brand's experience.",
    trendSignals: ["hot take", "unpopular opinion", "contrarian", "reaction"],
    priority: 55,
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
    category: "Trending",
    starterPrompt:
      "Put the viewer inside a specific moment when the brand's product or service removes a recognizable frustration.",
    trendSignals: ["pov", "discovery", "i saved my", "point of view"],
    priority: 64,
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
    category: "Education",
    starterPrompt:
      "Compare the brand's approach with the usual alternative using two fair, observable criteria and an honest verdict.",
    trendSignals: ["comparison", "this vs that", "test", "versus"],
    priority: 67,
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
