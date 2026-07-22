import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireUid } from "./lib/auth";
import { geminiJson } from "./lib/gemini";
import { MODELS } from "./lib/models";

/**
 * Branded carousel generator.
 *
 * Flow: user topic + brand kit → Gemini structured copy (4 slides) →
 * client React layering framework paints identical geometry (logo / name /
 * chevrons) and exports PNGs for LinkedIn / IG / FB / X.
 *
 * Costs 1 i-credit (same as a text+image post).
 */

const SYSTEM = `You are MagicBox AI's carousel creative director for LinkedIn, Instagram, Facebook, and X.

You write SHORT, punchy carousel copy that stops the scroll. Every slide is a square social graphic with:
- A bold ALL-CAPS title (max ~8 words)
- Optional highlighted phrases inside the title (2–4 words max that get accent color)
- A 1–2 sentence body (max 220 characters) — or empty on the CTA slide

Structure EXACTLY 4 slides:
1. hook — the topic as a scroll-stopping claim (not a question unless it's magnetic)
2. point — first concrete angle / insight
3. point — second concrete angle / insight (different from slide 2)
4. cta — "Follow {brandName} for more" style close; body can be one soft line or empty

Rules:
- No emojis. No hashtags inside titles.
- Never invent statistics, testimonials, or fake case studies.
- Match brand toneOfVoice when provided.
- Avoid bannedTopics.
- Titles must work as visual posters — concrete nouns, not vague fluff.
- highlightWords must be exact substrings of the title (case-insensitive match OK).
- Slide 4 title MUST include the brand name.
- Body text is supporting, not a paragraph essay.`;

const SCHEMA = {
  type: "object",
  properties: {
    caption: {
      type: "string",
      description: "Post caption for the carousel (platform-ready, under 400 chars).",
    },
    hashtags: {
      type: "array",
      items: { type: "string" },
      description: "3-8 hashtags without # prefix",
    },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["hook", "point", "cta"] },
          title: { type: "string" },
          highlightWords: {
            type: "array",
            items: { type: "string" },
            description: "Substrings of title to accent-color highlight",
          },
          body: { type: "string" },
        },
        required: ["role", "title", "highlightWords", "body"],
      },
    },
  },
  required: ["caption", "hashtags", "slides"],
} as const;

type RawSlide = {
  role: "hook" | "point" | "cta";
  title: string;
  highlightWords: string[];
  body: string;
};

type TitleSegment =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string };

/** Split title into text/highlight segments from Gemini highlightWords. */
export function segmentTitle(title: string, highlights: string[]): TitleSegment[] {
  if (!highlights?.length) return [{ type: "text", value: title }];

  // Longest-first so overlapping phrases prefer the fuller match.
  const sorted = [...highlights]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  type Span = { start: number; end: number; text: string };
  const spans: Span[] = [];
  const lower = title.toLowerCase();

  for (const h of sorted) {
    const needle = h.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + h.length;
      const overlaps = spans.some((s) => !(end <= s.start || idx >= s.end));
      if (!overlaps) spans.push({ start: idx, end, text: title.slice(idx, end) });
      from = end;
    }
  }

  spans.sort((a, b) => a.start - b.start);
  if (spans.length === 0) return [{ type: "text", value: title }];

  const segs: TitleSegment[] = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) {
      segs.push({ type: "text", value: title.slice(cursor, s.start) });
    }
    segs.push({ type: "highlight", value: s.text });
    cursor = s.end;
  }
  if (cursor < title.length) segs.push({ type: "text", value: title.slice(cursor) });
  return segs.map((s) => ({ ...s, value: s.value.trim() })).filter((s) => s.value);
}

function fallback(topic: string, brandName: string): {
  caption: string;
  hashtags: string[];
  slides: RawSlide[];
} {
  return {
    caption: `${topic} — a quick breakdown. Follow ${brandName} for more.`,
    hashtags: ["ai", "careers", "futureofwork", "linkedin"],
    slides: [
      {
        role: "hook",
        title: topic.toUpperCase(),
        highlightWords: topic.split(/\s+/).slice(0, 2),
        body: "A practical look at what is shifting — and what to do next.",
      },
      {
        role: "point",
        title: "AI IN JOB SEARCH",
        highlightWords: ["JOB SEARCH"],
        body: "Smarter outreach, sharper resumes, and proof that travels further than a PDF.",
      },
      {
        role: "point",
        title: "AI IN JOB MARKETS",
        highlightWords: ["JOB MARKETS"],
        body: "Roles change fast. The winners show public work, not just private applications.",
      },
      {
        role: "cta",
        title: `FOLLOW ${brandName.toUpperCase()} FOR MORE`,
        highlightWords: [brandName.toUpperCase()],
        body: "Save this carousel and come back for the next playbook.",
      },
    ],
  };
}

export const generate = action({
  args: {
    topic: v.string(),
    brandName: v.string(),
    brandTone: v.optional(v.string()),
    audience: v.optional(v.string()),
    industry: v.optional(v.string()),
    bannedTopics: v.optional(v.array(v.string())),
    platform: v.optional(v.string()),
    slideCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    await ctx.runMutation(internal.credits.ensure, { userId: uid });
    await ctx.runMutation(internal.credits.spendI, {
      userId: uid,
      amount: 1,
      reason: "carousel_generate",
    });

    const count = Math.min(6, Math.max(3, args.slideCount ?? 4));
    const platform = args.platform ?? "linkedin";

    try {
      const result = await geminiJson<{
        caption: string;
        hashtags: string[];
        slides: RawSlide[];
      }>({
        model: MODELS.text,
        temperature: 0.85,
        system: SYSTEM,
        prompt:
          `## Topic\n${args.topic.trim()}\n\n` +
          `## Brand\nName: ${args.brandName}\n` +
          (args.brandTone ? `Tone: ${args.brandTone}\n` : "") +
          (args.audience ? `Audience: ${args.audience}\n` : "") +
          (args.industry ? `Industry: ${args.industry}\n` : "") +
          (args.bannedTopics?.length
            ? `Banned topics: ${args.bannedTopics.join(", ")}\n`
            : "") +
          `\n## Platform\nPrimary: ${platform}. Write caption that works cross-post to LinkedIn, Instagram, Facebook, and X.\n` +
          `\n## Output\nExactly ${count} slides. Roles: first=hook, last=cta, middle=point.\n` +
          `Slide ${count} title must include "${args.brandName}".`,
        schema: SCHEMA as unknown as Record<string, unknown>,
      });

      let slides = result.slides ?? [];
      if (slides.length < count) {
        const fb = fallback(args.topic, args.brandName);
        slides = [...slides, ...fb.slides].slice(0, count);
      }
      slides = slides.slice(0, count);

      // Force CTA brand mention on last slide if model drifted.
      const last = slides[slides.length - 1];
      if (last && !last.title.toLowerCase().includes(args.brandName.toLowerCase())) {
        last.role = "cta";
        last.title = `FOLLOW ${args.brandName.toUpperCase()} FOR MORE`;
        last.highlightWords = [args.brandName.toUpperCase()];
      }

      return {
        topic: args.topic.trim(),
        caption: result.caption,
        hashtags: (result.hashtags ?? []).map((h) => h.replace(/^#/, "")),
        slides: slides.map((s) => ({
          role: s.role,
          title: s.title,
          body: s.body ?? "",
          titleSegments: segmentTitle(s.title, s.highlightWords ?? []),
        })),
      };
    } catch (e) {
      await ctx.runMutation(internal.credits.refundI, {
        userId: uid,
        amount: 1,
        reason: "carousel_generate_refund",
      });
      // Soft fallback so the UI still works if Gemini blips.
      const fb = fallback(args.topic, args.brandName);
      return {
        topic: args.topic.trim(),
        caption: fb.caption,
        hashtags: fb.hashtags,
        slides: fb.slides.map((s) => ({
          role: s.role,
          title: s.title,
          body: s.body,
          titleSegments: segmentTitle(s.title, s.highlightWords),
        })),
        usedFallback: true,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
});
