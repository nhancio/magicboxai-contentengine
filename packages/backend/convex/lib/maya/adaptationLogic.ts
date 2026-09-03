import type {
  MemeTemplate,
  BrandContext,
  SynthesizedAdaptation,
  AdaptedTextOverlay,
  AdaptedSubtitleCue,
  AdaptedSfxCue,
} from "./types";

/**
 * JSON schema handed to Gemini's `responseSchema` (see lib/gemini.ts geminiJson)
 * so adaptTemplate gets a constrained shape instead of hand-parsing prose.
 * Every field here is consumed downstream by the render pipeline — see
 * geminiResultToSynthesized and composeAndFinish in mayaTemplates.ts.
 */
export const ADAPTATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    hookText: { type: "string" },
    punchlineText: { type: "string" },
    brandBadgeText: { type: "string" },
    lipSyncLines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speakerId: { type: "string" },
          startSec: { type: "number" },
          endSec: { type: "number" },
          spokenDialogue: { type: "string" },
          deliveryTone: { type: "string" },
          facialExpression: { type: "string" },
          phonemePacing: {
            type: "string",
            enum: ["fast_rant", "dramatic_slow", "punchy_rhythmic", "natural"],
          },
        },
        required: ["speakerId", "startSec", "endSec", "spokenDialogue"],
      },
    },
    subtitleCues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startSec: { type: "number" },
          endSec: { type: "number" },
          text: { type: "string" },
        },
        required: ["startSec", "endSec", "text"],
      },
    },
    overlayTiming: {
      type: "object",
      properties: {
        hookStartSec: { type: "number" },
        hookEndSec: { type: "number" },
        punchlineStartSec: { type: "number" },
        punchlineEndSec: { type: "number" },
      },
    },
    sfxCues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestampSec: { type: "number" },
          sfxName: { type: "string" },
          volumeMultiplier: { type: "number" },
        },
        required: ["timestampSec", "sfxName"],
      },
    },
    instagramCaption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    veoPrompt: { type: "string" },
    adaptationNote: { type: "string" },
  },
  required: ["hookText", "punchlineText", "lipSyncLines", "instagramCaption", "hashtags"],
} as const;

/** Chronological join of per-speaker lines — this is what actually gets voiced by TTS for lip-sync. */
function joinScript(lines: SynthesizedAdaptation["lipSyncScript"]): string {
  return [...lines]
    .sort((a, b) => a.startSec - b.startSec)
    .map((l) => l.spokenDialogue)
    .join(" ");
}

/** Fallback subtitle generation: chunks each line's words into 2-4 word cards spread across its own time window. */
function deriveSubtitlesFromScript(lines: SynthesizedAdaptation["lipSyncScript"]): AdaptedSubtitleCue[] {
  const cues: AdaptedSubtitleCue[] = [];
  for (const line of [...lines].sort((a, b) => a.startSec - b.startSec)) {
    const words = line.spokenDialogue.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3).join(" "));
    const span = Math.max(line.endSec - line.startSec, 0.1);
    const step = span / chunks.length;
    chunks.forEach((text, i) => {
      cues.push({ startSec: line.startSec + i * step, endSec: line.startSec + (i + 1) * step, text });
    });
  }
  return cues;
}

function defaultHashtags(brand: BrandContext): string[] {
  const alnum = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");
  const tags = ["#reels", "#viral", "#trending", "#brainrot", "#india"];
  if (brand.industry) tags.push(`#${alnum(brand.industry)}`);
  if (brand.name) tags.push(`#${alnum(brand.name)}`);
  return tags;
}

const HUMOR_INTENSITY_GUIDE: Record<string, string> = {
  unhinged_brainrot: "maximum chaotic desi comedy, heavy Hinglish, gaali-free but feral",
  relatable_corporate: "hustle-culture satire, office pain points, dry",
  high_energy: "punchy hype, fast cuts of speech, exclamation energy",
  subtle: "clean B2B punch, one sharp comparison, no slang spam",
};

export function buildAdaptationPrompt(template: MemeTemplate, brand: BrandContext, opts: {
  customProductAngle?: string;
  humorIntensity?: string;
}): string {
  const speakerBlock = template.lipSyncSlots
    .map(
      (s, i) =>
        `  ${i + 1}. speakerId="${s.speakerId}" (${s.speakerDescription})\n` +
        `     window: ${s.startSec}s -> ${s.endSec}s | mood: ${s.emotionalExpression}\n` +
        `     originally says: "${s.originalDialogue}"`,
    )
    .join("\n");
  const beatsBlock = template.beats
    .map(
      (b) =>
        `  - ${b.timestampSec}s-${b.timestampSec + b.durationSec}s (${b.label}): ${b.visualAction}` +
        `${b.suggestedBrandAction ? ` -> brand moment: ${b.suggestedBrandAction}` : ""}`,
    )
    .join("\n");

  const humorIntensity = opts.humorIntensity || "unhinged_brainrot";
  const angleBlock = opts.customProductAngle
    ? `- The user's own comedic angle (HONOUR IT, it is the brief):\n  ${opts.customProductAngle}`
    : `- No angle given: invent a genuinely fresh one. Find an unexpected bridge\n  between what is VISUALLY happening in this clip and the brand's USP.`;

  return `You are Maya — MagicBox's viral meme director for Indian Instagram Reels,
Desi Brainrot culture, and high-converting brand comedy.

The user clicked "Adapt". You get ONE shot. Everything you return is wired
straight into the render pipeline with no human editing step:

  your lipSyncLines -> TTS voice track -> fal lip-sync onto the ORIGINAL
  footage -> Remotion burns in your overlays/subtitles/badge -> the MP4 is
  handed to the user to post on Instagram.

So: no placeholders, no "[brand name]", no bracketed TODOs, no options for
the user to pick between. Ship-ready or nothing.

## THE FOOTAGE YOU ARE REWRITING (it is reused as-is — you cannot reshoot it)
- Title: ${template.title}
- Format: ${template.format}
- Duration: ${template.durationSec}s   Aspect: ${template.aspectRatio}
- Why it went viral: ${template.viralHook}
- Humor mechanism: ${template.humorMechanism}
- Cultural context: ${template.culturalContext}

### Speakers on screen — one new line each, SAME id, SAME time window
${speakerBlock}

### Beat timeline — what the camera actually shows, and where brand lands
${beatsBlock}

## THE BRAND (auto-filled from the user's Brand Kit)
- Name: ${brand.name}
- Industry: ${brand.industry || "General"}
- Audience: ${brand.audience || "Indian modern digital consumers & professionals"}
- Product / USP: ${brand.productOffering || brand.uniqueSellingPoint || "Automated high-speed growth"}
- Tone of voice: ${brand.toneOfVoice || "Witty, energetic, authentic desi meme style"}
- CTA: ${brand.targetCallToAction || "Try it today"}
- Primary colour: ${brand.colors?.primary || "#FFE600"}  Accent: ${brand.colors?.accent || "#38BDF8"}
- Humor intensity: ${humorIntensity} (${HUMOR_INTENSITY_GUIDE[humorIntensity] || HUMOR_INTENSITY_GUIDE.unhinged_brainrot})
${angleBlock}

## HARD RULES

1. TIMING IS LAW. Speak the words a human can actually say in that window at
   the pacing you specify — roughly 2.6 Hinglish words per second for a rant,
   1.8 for dramatic delivery. Overrun and the lip-sync desyncs and the reel is
   unusable. Count before you commit. Reuse each speakerId/startSec/endSec
   verbatim.

2. MATCH THE PICTURE. The words must make sense against visualAction at that
   timestamp. If a speaker is pointing off-screen, the line reacts to something
   off-screen. If it's an animal or 3D avatar, lean into that being an animal —
   don't write a line that only works for a human in an office. A script that
   is funny but visually orphaned is a failed adaptation.

3. KEEP THE MECHANISM, SWAP THE SUBJECT. The template went viral because of
   ${template.humorMechanism}. Preserve that exact comedic structure and
   rhythm — the setup beat, the turn, the punch land on the same frames — and
   only substitute the subject matter for the brand's pain point. Do not
   invent a new joke shape.

4. THE BRAND IS THE PUNCHLINE, NOT THE PREMISE. Open with the audience's pain,
   in their own words. ${brand.name} arrives late, as the relief/twist —
   never in the first line, never more than twice total in spoken dialogue.
   If it reads like an ad in the first 2 seconds, rewrite it.

5. NEVER REPEAT YOURSELF. The user may hit Adapt five times on this same
   template. Each run must feel like a different writer wrote it — different
   slang, different metaphor, different angle of attack. Avoid the house
   clichés: "bhai 2 second me ho jata hai", "POV:", "nobody:", "me still
   doing X in 2026", "game changer", "10x". Those are burned.

6. LANGUAGE. Natural Hinglish as the audience actually types it — Roman script
   only (no Devanagari, the renderer's font won't have it). For "subtle" /
   LinkedIn, English with at most a light desi cadence. No emoji inside
   spokenDialogue (TTS reads them aloud); emoji ARE welcome in overlay text.

7. BRAND-SAFE. No named competitors, no real people or celebrities, no
   copyrighted characters or IP, nothing about caste/religion/politics/body
   shaming, no medical or financial claims, no unverifiable numbers ("saves
   90%") unless the brand's own USP text states them.

8. OVERLAYS ARE PART OF THE JOKE. The burned-in text must not repeat the
   spoken words — it does the second half of the gag (setup on top, punch on
   bottom). Top header <= 7 words, bottom punchline <= 10 words, all-caps only
   where it hits harder. Time the punchline to appear on the beat where the
   visual turn happens, not at 0s.

9. SUBTITLES. Chunk the full spoken script into 2-4 word caption cards with
   real start/end times inside each speaker's window — Reels are watched on
   mute, so the joke has to survive with the sound off.

10. THE CAPTION SHIPS TOO. Write the Instagram caption and hashtags the user
    will paste. Caption: hook line, one line of value, then the CTA
    (${brand.targetCallToAction || "a clear next step"}). 8-12 hashtags, mixing broad reach with
    ${brand.industry || "the brand's"} niche tags. No hashtag walls, no follow-for-follow.

## SELF-CHECK BEFORE YOU RETURN
Silently verify, and fix anything that fails:
  - every speakerId/startSec/endSec copied exactly, one line per speaker
  - every line's word count fits its window at the stated pacing
  - each line is consistent with the visualAction at that timestamp
  - brand named <= 2x in dialogue, never in the opening line
  - overlays add a joke rather than echoing the dialogue
  - subtitle chunks tile the speech continuously, no gaps or overlaps
  - zero placeholders, zero brackets, zero emoji in spokenDialogue
  - it would make you personally stop scrolling

Return JSON only, exactly this shape:
{
  "hookText": "top caption, <=7 words",
  "punchlineText": "bottom caption, <=10 words",
  "brandBadgeText": "corner badge, e.g. Powered by ${brand.name}",
  "lipSyncLines": [
    {
      "speakerId": "<copied>", "startSec": <copied>, "endSec": <copied>,
      "spokenDialogue": "new brand-adapted words for THIS speaker",
      "deliveryTone": "e.g. fast frustrated Hinglish rant, breaking into smug",
      "facialExpression": "e.g. exasperated then dead-eyed confident",
      "phonemePacing": "fast_rant | dramatic_slow | punchy_rhythmic | natural"
    }
  ],
  "subtitleCues": [
    { "startSec": 0.5, "endSec": 1.1, "text": "2-4 words" }
  ],
  "overlayTiming": {
    "hookStartSec": 0, "hookEndSec": <n>,
    "punchlineStartSec": <the visual turn>, "punchlineEndSec": <n>
  },
  "sfxCues": [
    { "timestampSec": <n>, "sfxName": "vine_boom | bruh | record_scratch | dramatic_reverb | cash_register", "volumeMultiplier": 0.8 }
  ],
  "instagramCaption": "ready-to-paste caption ending in the CTA",
  "hashtags": ["#tag", "..."],
  "veoPrompt": "fallback only — used when lip-sync onto the original clip is unavailable. Single string, this structure:\\nStyle: 3D stylized CGI animation, cinematic lighting, 9:16 vertical\\nScene Description: ...\\nCharacters: an ORIGINAL invented mascot — no existing IP, no real people\\nAction & Animation: ...\\nAudio & Tone: ...",
  "adaptationNote": "one sentence: the comedic angle you chose and why it fits this footage"
}`;
}

/** Shared negative-prompt terms for Veo/Kling/Sora — keeps unwanted real-human/low-quality output out regardless of which path (Gemini or algorithmic) wrote the rest of the prompt. */
const VEO_NEGATIVE_PROMPT =
  "real humans, live-action footage, realistic human photographs, blurry textures, low resolution, deformed anatomy, static motionless frames, dark dull lighting, watermark, copyright logos, distorted face, robotic motion, artifacts";

export function geminiResultToSynthesized(
  parsed: any,
  template: MemeTemplate,
  brand: BrandContext,
): SynthesizedAdaptation {
  const lipSyncScript = (parsed.lipSyncLines || []).map((l: any, i: number) => {
    const originalSlot = template.lipSyncSlots.find((s) => s.speakerId === l.speakerId) ?? template.lipSyncSlots[i];
    return {
      speakerId: l.speakerId || originalSlot?.speakerId || "speaker_main",
      startSec: l.startSec ?? originalSlot?.startSec ?? 0.5,
      endSec: l.endSec ?? originalSlot?.endSec ?? template.durationSec - 1.5,
      spokenDialogue: l.spokenDialogue,
      deliveryTone: l.deliveryTone || "energetic",
      facialExpression: l.facialExpression || originalSlot?.emotionalExpression || "expressive",
      phonemePacing: l.phonemePacing,
    };
  });

  const primaryColor = brand.colors?.primary || "#FFE600";
  const accentColor = brand.colors?.accent || "#38BDF8";
  const timing = parsed.overlayTiming || {};
  const hookStart = typeof timing.hookStartSec === "number" ? timing.hookStartSec : 0;
  const hookEnd = typeof timing.hookEndSec === "number" ? timing.hookEndSec : Math.min(3, template.durationSec);
  const punchStart =
    typeof timing.punchlineStartSec === "number" ? timing.punchlineStartSec : Math.max(template.durationSec - 3, hookEnd);
  const punchEnd = typeof timing.punchlineEndSec === "number" ? timing.punchlineEndSec : template.durationSec;

  const textOverlays: AdaptedTextOverlay[] = [
    {
      slotId: "top_header",
      text: parsed.hookText || `ME BEFORE USING ${brand.name.toUpperCase()}:`,
      placement: "top",
      color: primaryColor,
      bgColor: "#000000CC",
      startSec: hookStart,
      endSec: hookEnd,
    },
    {
      slotId: "bottom_punchline",
      text: parsed.punchlineText || `Switched to ${brand.name} in 1 click`,
      placement: "bottom",
      color: "#FFFFFF",
      bgColor: "#DC2626EE",
      startSec: punchStart,
      endSec: punchEnd,
    },
    {
      slotId: "brand_badge",
      text: parsed.brandBadgeText || `Powered by ${brand.name}`,
      placement: "bottom_right",
      color: accentColor,
      bgColor: "#0F172AEB",
      startSec: Math.floor(template.durationSec * 0.6),
      endSec: template.durationSec,
    },
  ];

  const subtitleCues: AdaptedSubtitleCue[] = Array.isArray(parsed.subtitleCues)
    ? parsed.subtitleCues.map((c: any) => ({ startSec: c.startSec, endSec: c.endSec, text: c.text }))
    : [];
  const sfxCues: AdaptedSfxCue[] = Array.isArray(parsed.sfxCues)
    ? parsed.sfxCues.map((c: any) => ({ timestampSec: c.timestampSec, sfxName: c.sfxName, volumeMultiplier: c.volumeMultiplier }))
    : [];

  return {
    hookText: parsed.hookText,
    // Derived from the per-speaker lines (not a separately-authored field) so
    // the single TTS track dispatched for lip-sync says exactly what's in
    // lipSyncScript, in order — the two can never drift apart.
    adaptedScript: joinScript(lipSyncScript),
    textOverlays,
    lipSyncScript,
    videoModelPrompts: {
      googleVeoPrompt:
        parsed.veoPrompt ||
        `Style: 3D stylized CGI animation, cinematic lighting, 9:16 vertical.\n` +
          `Scene Description: A bright, modern setting themed around ${brand.name}.\n` +
          `Characters: An original expressive 3D-animated mascot character (invented, not any existing copyrighted character) representing ${brand.name}.\n` +
          `Action & Animation: The character passionately reacts and talks directly to camera about ${brand.name}, expressive facial animation, dynamic camera push-in.\n` +
          `Audio & Tone: High-energy, punchy delivery with clean commercial sound design.`,
      negativePrompt: VEO_NEGATIVE_PROMPT,
    },
    // Fall back to a derived/deterministic version rather than an empty array
    // if Gemini omits them — every adaptation ships with usable subtitles/sfx.
    subtitleCues: subtitleCues.length ? subtitleCues : deriveSubtitlesFromScript(lipSyncScript),
    sfxCues: sfxCues.length
      ? sfxCues
      : template.audioPlan.sfxCues.map((c) => ({
          timestampSec: c.timestampSec,
          sfxName: c.sfxName,
          volumeMultiplier: c.volumeMultiplier,
        })),
    instagramCaption:
      parsed.instagramCaption ||
      `${parsed.hookText || template.viralHook}\n\n${brand.targetCallToAction || `Try ${brand.name} today.`}`,
    hashtags: Array.isArray(parsed.hashtags) && parsed.hashtags.length ? parsed.hashtags : defaultHashtags(brand),
    adaptationNote: typeof parsed.adaptationNote === "string" ? parsed.adaptationNote : undefined,
  };
}

/**
 * Algorithmic Rule-based Meme Synthesizer — instant, 0-latency fallback used
 * whenever Gemini is unreachable or GEMINI_API_KEY is unset.
 */
export function synthesizeAlgorithmicAdaptation(
  template: MemeTemplate,
  brand: BrandContext,
  customProductAngle?: string,
): SynthesizedAdaptation {
  const bName = brand.name;
  const bProduct = brand.productOffering || brand.industry || "workflow automation";

  let hookText = "";
  let bottomText = "";
  let spokenDialogue = "";

  switch (template.format) {
    case "talking_head_rant":
      hookText = `ME STILL DOING ${bProduct.toUpperCase()} MANUALLY IN 2026:`;
      bottomText = `Bhai ${bName} hai na! 2 second me ho jata hai 😭💀`;
      spokenDialogue = `Bhai mereko ek baat batao, tum log abhi bhi 4 ghante manual kaam kar rahe ho jab ${bName} se sab kuch 2 click me ho jata hai?! Pata nahi kya kar rahe ho!`;
      break;
    case "dramatic_reaction":
      hookText = `WHEN YOU REALIZE YOUR COMPETITOR ALREADY USES ${bName.toUpperCase()}:`;
      bottomText = `Bhai ye kya ho gaya... 10x output kaise aa raha hai?! 😱`;
      spokenDialogue = `Wait... unhone 10 minute me 50 results nikal liye with ${bName} jabki mai abhi tak pehle step pe tha?! Bhai ye kya ho gaya?!`;
      break;
    case "sigma_grindset_satire":
      hookText = `WHILE THEY OVERCOMPLICATE ${bProduct.toUpperCase()}:`;
      bottomText = `WE AUTOMATED EVERYTHING WITH ${bName.toUpperCase()} OVER 1 CHAI ☕🗿`;
      spokenDialogue = `Rule #1: Hard work mat karo, ${bName} se smart work karo. Ek chai khatam hone se pehle sab kuch ready.`;
      break;
    case "before_after_comparison":
    default:
      hookText = `TRYING TO SOLVE ${bProduct.toUpperCase()} WITHOUT ${bName.toUpperCase()}:`;
      bottomText = `Switching to ${bName}: 10x Faster & 90% Cheaper 🚀`;
      spokenDialogue = `Kyu faltu time aur paisa waste karna jab ${bName} aapko instant results deta hai? Abhi try karo!`;
      break;
  }

  // Fold in the user's own pitch/pain-point angle regardless of which meme
  // format matched — previously this only applied to the default branch,
  // so a custom angle silently got dropped for 3 of the 4 formats.
  if (customProductAngle?.trim()) {
    spokenDialogue = `${spokenDialogue} ${customProductAngle.trim()}`;
  }

  // Anchor each line to the source clip's ACTUAL speaker/timing slots — not
  // one generic line spanning an arbitrary window disconnected from the
  // footage. Multi-speaker templates (e.g. parent -> founder) get a brief
  // in-character reaction beat on earlier speakers and the full brand
  // punchline on the last (primary) speaker.
  const slots = template.lipSyncSlots.length
    ? template.lipSyncSlots
    : [
        {
          speakerId: "speaker_main",
          startSec: 0.5,
          endSec: Math.max(template.durationSec - 1.5, 4.0),
          emotionalExpression: "ranting" as const,
          originalDialogue: "",
          speakerDescription: "",
        },
      ];
  const lipSyncScript = slots.map((slot, idx) => ({
    speakerId: slot.speakerId,
    startSec: slot.startSec,
    endSec: slot.endSec,
    spokenDialogue: idx === slots.length - 1 ? spokenDialogue : "Wait... what is happening right now?",
    deliveryTone:
      idx === slots.length - 1
        ? "Fast, animated Hindi-English rant with high comedic inflection"
        : "Short, confused reaction beat",
    facialExpression: slot.emotionalExpression,
    phonemePacing: "fast_rant" as const,
  }));

  const primaryColor = brand.colors?.primary || "#FFE600";
  const accentColor = brand.colors?.accent || "#38BDF8";

  return {
    hookText,
    // Derived from lipSyncScript (not the raw punchline alone) so a
    // multi-speaker template's TTS track actually voices every line, in order.
    adaptedScript: joinScript(lipSyncScript),
    textOverlays: [
      {
        slotId: "top_header",
        text: hookText,
        placement: "top",
        color: primaryColor,
        bgColor: "#000000CC",
        startSec: 0,
        endSec: template.durationSec,
      },
      {
        slotId: "bottom_punchline",
        text: bottomText,
        placement: "bottom",
        color: "#FFFFFF",
        bgColor: "#DC2626EE",
        startSec: 2.5,
        endSec: template.durationSec,
      },
      {
        slotId: "brand_badge",
        text: `Powered by ${bName} ⚡`,
        placement: "bottom_right",
        color: accentColor,
        bgColor: "#0F172AEB",
        startSec: 0,
        endSec: template.durationSec,
      },
    ],
    lipSyncScript,
    videoModelPrompts: {
      googleVeoPrompt:
        `Style: 3D stylized CGI animation (Pixar/Illumination aesthetic), cinematic lighting, 9:16 vertical.\n` +
        `Scene Description: A vibrant, relatable setting around ${bProduct}.\n` +
        `Characters: An original expressive 3D-animated mascot character (invented, not any existing copyrighted character) representing ${bName}.\n` +
        `Action & Animation: The character reacts with exaggerated comedic expression to the pain of doing things manually, then gestures excitedly toward ${bName}'s solution.\n` +
        `Audio & Tone: Fast-paced desi comedic delivery, expressive facial animation, punchy bass drop on the reveal.`,
      negativePrompt: VEO_NEGATIVE_PROMPT,
    },
    subtitleCues: deriveSubtitlesFromScript(lipSyncScript),
    sfxCues: template.audioPlan.sfxCues.map((c) => ({
      timestampSec: c.timestampSec,
      sfxName: c.sfxName,
      volumeMultiplier: c.volumeMultiplier,
    })),
    instagramCaption: `${hookText}\n\n${bottomText}\n\n${brand.targetCallToAction || `Try ${bName} today.`}`,
    hashtags: defaultHashtags(brand),
  };
}

/** Formats phoneme/delivery cues into one readable block for lip-sync/video-conditioning prompts. */
export function formatConditioningCues(lines: SynthesizedAdaptation["lipSyncScript"]): string {
  return lines
    .map(
      (l, i) =>
        `[Shot ${i + 1} (${l.startSec.toFixed(1)}s - ${l.endSec.toFixed(1)}s)] Delivery: ${l.deliveryTone} | Expression: ${l.facialExpression} | Words: "${l.spokenDialogue}"`,
    )
    .join("\n");
}
