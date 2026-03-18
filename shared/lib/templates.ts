export interface ViralTemplate {
  id: string;
  name: string;
  hookLine: string;
  scriptStructure: string;
  targetUseCase: string;
  tone: string;
  description: string;
  gradient: string;
  platform: string[];
  category: string;
  estimatedDuration: string;
}

export const VIRAL_TEMPLATES: ViralTemplate[] = [
  {
    id: "template-problem-solution",
    name: "Problem → Solution",
    hookLine: "I was struggling with [problem] until I found THIS",
    scriptStructure: `HOOK (0-3s): State the relatable problem dramatically
PROBLEM (3-10s): Describe the frustration and failed attempts
DISCOVERY (10-18s): "Then I found [product]..."
DEMO (18-40s): Show the product solving the problem
RESULT (40-50s): Before vs. after transformation
CTA (50-60s): "Link in bio, trust me you need this"`,
    targetUseCase: "Any product that solves a clear problem",
    tone: "Relatable, honest, slightly dramatic",
    description: "The classic problem-solution format. Start with a pain point your audience relates to, then reveal your product as the answer.",
    gradient: "from-purple-500 to-indigo-600",
    platform: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    category: "Conversion",
    estimatedDuration: "45-60s",
  },
  {
    id: "template-get-ready-with-me",
    name: "Get Ready With Me (GRWM)",
    hookLine: "Get ready with me using my new favorite [product]",
    scriptStructure: `HOOK (0-3s): "Get ready with me! I have to show you something"
SETUP (3-10s): Start getting ready, casual chat
INTRO (10-20s): Naturally introduce the product
USE (20-40s): Use the product while chatting about benefits
REVEAL (40-50s): Show the finished look/result
CTA (50-60s): Soft sell — "Seriously the best thing I've bought"`,
    targetUseCase: "Beauty, skincare, fashion, accessories",
    tone: "Casual, intimate, like talking to a friend",
    description: "The GRWM format feels natural and non-salesy. Viewers watch the whole video because they're invested in the routine.",
    gradient: "from-pink-500 to-rose-600",
    platform: ["TikTok", "Instagram Reels"],
    category: "Lifestyle",
    estimatedDuration: "45-60s",
  },
  {
    id: "template-3-reasons",
    name: "3 Reasons Why",
    hookLine: "3 reasons why [product] is going viral right now",
    scriptStructure: `HOOK (0-3s): "3 reasons why everyone is obsessed with this"
REASON 1 (3-15s): Most impressive benefit, show proof
REASON 2 (15-30s): Unique feature that competitors don't have
REASON 3 (30-45s): Price/value proposition (save the best for last)
SUMMARY (45-55s): Quick recap with enthusiasm
CTA (55-60s): "Link in bio — you'll thank me later"`,
    targetUseCase: "Any product, especially ecommerce",
    tone: "Informative, enthusiastic, list-style",
    description: "The listicle format is proven to retain viewers because they want to see all 3 reasons. Great completion rate.",
    gradient: "from-indigo-500 to-blue-600",
    platform: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    category: "Educational",
    estimatedDuration: "45-60s",
  },
  {
    id: "template-unboxing",
    name: "Unboxing & First Impressions",
    hookLine: "This just arrived and I'm literally shaking",
    scriptStructure: `HOOK (0-3s): Show the package, build anticipation
UNBOX (3-15s): Open it slowly, react genuinely
FIRST LOOK (15-25s): Examine the product, touch and feel
FIRST USE (25-45s): Try it for the first time, live reaction
VERDICT (45-55s): Honest first impression
CTA (55-60s): "Should I do a full review? Comment below!"`,
    targetUseCase: "Physical products, gadgets, subscription boxes",
    tone: "Excited, genuine surprise, ASMR-like",
    description: "Unboxing videos tap into the anticipation emotion. The genuine reaction builds trust with viewers.",
    gradient: "from-amber-500 to-orange-600",
    platform: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    category: "Review",
    estimatedDuration: "50-60s",
  },
  {
    id: "template-day-in-my-life",
    name: "Day in My Life (ft. Product)",
    hookLine: "A day in my life as a [role] — and my secret weapon",
    scriptStructure: `HOOK (0-3s): "Come spend the day with me"
MORNING (3-12s): Morning routine, natural setting
INTRODUCE (12-20s): Naturally weave in the product
USE (20-35s): Show using it throughout the day
BENEFIT (35-45s): How it made the day better
EVENING (45-55s): Wrap up the day
CTA (55-60s): Casual recommendation`,
    targetUseCase: "Lifestyle products, apps, food, beverages",
    tone: "Vlog-style, authentic, chill",
    description: "Day-in-my-life content is endlessly watchable. Product placement feels natural, not forced.",
    gradient: "from-emerald-500 to-teal-600",
    platform: ["TikTok", "Instagram Reels"],
    category: "Lifestyle",
    estimatedDuration: "50-60s",
  },
  {
    id: "template-before-after",
    name: "Before & After Transformation",
    hookLine: "Before vs. after using [product] for 30 days",
    scriptStructure: `HOOK (0-3s): Split screen or dramatic "watch this"
BEFORE (3-12s): Show the "before" state with pain points
THE CHANGE (12-18s): "Then I started using [product]..."
DURING (18-35s): Quick montage of using the product
AFTER (35-50s): Dramatic reveal of the "after" state
PROOF (50-55s): Side-by-side comparison
CTA (55-60s): "Don't wait 30 days like I did — start now"`,
    targetUseCase: "Skincare, fitness, home improvement, cleaning",
    tone: "Dramatic reveal, transformation-focused",
    description: "Before/after content is the most persuasive format for products with visible results. The transformation creates a dopamine hit.",
    gradient: "from-violet-500 to-purple-600",
    platform: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    category: "Transformation",
    estimatedDuration: "50-60s",
  },
  {
    id: "template-storytime",
    name: "Storytime",
    hookLine: "Storytime: How [product] literally saved me",
    scriptStructure: `HOOK (0-3s): "Okay so storytime — this is crazy"
SETUP (3-12s): Set the scene, create context
CONFLICT (12-25s): The problem or challenge faced
CLIMAX (25-35s): Discovery of the product
RESOLUTION (35-50s): How the product solved everything
LESSON (50-55s): What you learned
CTA (55-60s): "If you're dealing with this too, link in bio"`,
    targetUseCase: "Any product with a compelling story angle",
    tone: "Dramatic, personal, storytelling",
    description: "Storytelling is the most engaging content format. People watch til the end to hear how it ends.",
    gradient: "from-red-500 to-pink-600",
    platform: ["TikTok", "Instagram Reels"],
    category: "Storytelling",
    estimatedDuration: "50-60s",
  },
  {
    id: "template-hot-take",
    name: "Unpopular Opinion / Hot Take",
    hookLine: "Unpopular opinion: [bold claim about product/industry]",
    scriptStructure: `HOOK (0-3s): "Unpopular opinion:" + bold controversial statement
DEFEND (3-15s): Back up your hot take with logic
PROOF (15-30s): Show evidence or demonstrate
PIVOT (30-40s): "Here's what actually works instead..."
PRODUCT (40-50s): Introduce product as the better alternative
CTA (50-60s): "Fight me in the comments or try it yourself"`,
    targetUseCase: "Products disrupting an industry, alternatives",
    tone: "Bold, controversial, debate-provoking",
    description: "Hot takes drive engagement through comments and shares. The controversy makes people watch and respond.",
    gradient: "from-rose-500 to-red-600",
    platform: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    category: "Engagement",
    estimatedDuration: "50-60s",
  },
  {
    id: "template-pov",
    name: "POV: You Discovered [Product]",
    hookLine: "POV: You finally found the [product] everyone's talking about",
    scriptStructure: `HOOK (0-3s): "POV:" text overlay + relatable scenario
SETUP (3-10s): Set the POV scene
DISCOVERY (10-20s): The moment of discovering the product
REACTION (20-35s): Genuine excitement and exploration
BENEFITS (35-50s): Key features through the POV lens
ENDING (50-60s): "And that's when everything changed" + CTA`,
    targetUseCase: "Trending products, viral items, new launches",
    tone: "Immersive, relatable, slightly dramatic",
    description: "POV content puts the viewer in the creator's shoes. It's immersive and drives higher engagement.",
    gradient: "from-sky-500 to-blue-600",
    platform: ["TikTok", "Instagram Reels"],
    category: "Trending",
    estimatedDuration: "45-60s",
  },
  {
    id: "template-comparison",
    name: "This vs. That Comparison",
    hookLine: "I tested [product] vs [competitor] so you don't have to",
    scriptStructure: `HOOK (0-3s): "I tested both so you don't have to"
INTRO (3-10s): Show both products side by side
TEST 1 (10-20s): Compare on feature #1
TEST 2 (20-30s): Compare on feature #2
TEST 3 (30-40s): Compare on feature #3 (price/value)
WINNER (40-50s): Declare the winner with enthusiasm
CTA (50-60s): "Clear winner for me — link in bio"`,
    targetUseCase: "Any product with direct competitors",
    tone: "Fair, analytical, surprising verdict",
    description: "Comparison content positions your product as the winner. The 'fairness' of testing both builds trust.",
    gradient: "from-teal-500 to-cyan-600",
    platform: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    category: "Review",
    estimatedDuration: "50-60s",
  },
];

export function getTemplateById(id: string): ViralTemplate | undefined {
  return VIRAL_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): ViralTemplate[] {
  return VIRAL_TEMPLATES.filter(
    (t) => t.category.toLowerCase() === category.toLowerCase()
  );
}

export function getTemplatesByPlatform(platform: string): ViralTemplate[] {
  return VIRAL_TEMPLATES.filter((t) =>
    t.platform.some((p) => p.toLowerCase().includes(platform.toLowerCase()))
  );
}

export const TEMPLATE_CATEGORIES = [
  "All",
  "Conversion",
  "Lifestyle",
  "Educational",
  "Review",
  "Transformation",
  "Storytelling",
  "Engagement",
  "Trending",
] as const;
