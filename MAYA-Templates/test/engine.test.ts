import assert from "node:assert/strict";
import test from "node:test";

import {
  CURATED_INDIAN_MEME_TEMPLATES,
  synthesizeAlgorithmicAdaptation,
  buildAdaptationPrompt,
  formatConditioningCues,
} from "../src/index";
import type { BrandContext } from "../src/types";

const BRAND: BrandContext = {
  name: "Ownly",
  industry: "Food Delivery App",
  audience: "Hungry students and office workers",
  productOffering: "Curated Indian meals delivered in 20 minutes",
  toneOfVoice: "Playful, fast, desi",
  targetCallToAction: "Order on Ownly today",
  colors: { primary: "#ff5f56", accent: "#ffbd2e" },
};

// These cover the deterministic path only — no network, no API keys — so the
// suite stays runnable in CI. The Gemini path is exercised by examples/demo.ts.

test("curated templates are well-formed", () => {
  assert.ok(CURATED_INDIAN_MEME_TEMPLATES.length > 0);
  for (const t of CURATED_INDIAN_MEME_TEMPLATES) {
    assert.ok(t.templateId, "templateId required");
    assert.ok(t.previewVideoUrl.startsWith("http"), "previewVideoUrl must be a URL");
    assert.ok(t.durationSec > 0, "durationSec must be positive");
    assert.ok(t.lipSyncSlots.length > 0, "needs at least one speaker slot");
  }
});

test("algorithmic adaptation anchors lines to the template's real speaker slots", () => {
  const template = CURATED_INDIAN_MEME_TEMPLATES[0];
  const out = synthesizeAlgorithmicAdaptation(template, BRAND);

  assert.equal(out.lipSyncScript.length, template.lipSyncSlots.length);
  out.lipSyncScript.forEach((line, i) => {
    assert.equal(line.speakerId, template.lipSyncSlots[i].speakerId);
    assert.equal(line.startSec, template.lipSyncSlots[i].startSec);
    assert.equal(line.endSec, template.lipSyncSlots[i].endSec);
  });
});

test("adapted script is exactly what gets voiced (join of the lines, in order)", () => {
  const out = synthesizeAlgorithmicAdaptation(CURATED_INDIAN_MEME_TEMPLATES[0], BRAND);
  const joined = [...out.lipSyncScript]
    .sort((a, b) => a.startSec - b.startSec)
    .map((l) => l.spokenDialogue)
    .join(" ");
  assert.equal(out.adaptedScript, joined);
});

test("every adaptation ships subtitles, sfx cues, caption and hashtags", () => {
  const out = synthesizeAlgorithmicAdaptation(CURATED_INDIAN_MEME_TEMPLATES[0], BRAND);
  assert.ok(out.subtitleCues.length > 0, "subtitles are required for mute viewing");
  assert.ok(out.sfxCues.length > 0);
  assert.ok(out.instagramCaption.includes(BRAND.targetCallToAction!));
  assert.ok(out.hashtags.length > 0);
});

test("brand details actually reach the generated copy", () => {
  const out = synthesizeAlgorithmicAdaptation(CURATED_INDIAN_MEME_TEMPLATES[0], BRAND);
  const blob = `${out.hookText} ${out.adaptedScript} ${out.textOverlays.map((t) => t.text).join(" ")}`;
  assert.ok(blob.includes(BRAND.name), "brand name must appear in the adaptation");
  assert.equal(out.textOverlays[0].color, BRAND.colors!.primary, "overlay uses the brand's primary colour");
});

test("a custom angle is folded in regardless of meme format", () => {
  const angle = "Show how silly waiting 40 minutes for food is";
  for (const template of CURATED_INDIAN_MEME_TEMPLATES) {
    const out = synthesizeAlgorithmicAdaptation(template, BRAND, angle);
    assert.ok(out.adaptedScript.includes(angle), `angle dropped for format ${template.format}`);
  }
});

test("the adaptation prompt grounds the model in the real footage", () => {
  const template = CURATED_INDIAN_MEME_TEMPLATES[0];
  const prompt = buildAdaptationPrompt(template, BRAND, { humorIntensity: "unhinged_brainrot" });

  assert.ok(prompt.includes(template.title));
  assert.ok(prompt.includes(BRAND.name));
  assert.ok(prompt.includes(template.lipSyncSlots[0].speakerId), "speaker ids must be in the prompt");
  assert.ok(prompt.includes(template.beats[0].visualAction), "beat timeline must be in the prompt");
});

test("conditioning cues render one readable line per shot", () => {
  const out = synthesizeAlgorithmicAdaptation(CURATED_INDIAN_MEME_TEMPLATES[3], BRAND);
  const cues = formatConditioningCues(out.lipSyncScript);
  assert.equal(cues.split("\n").length, out.lipSyncScript.length);
  assert.ok(cues.includes("Shot 1"));
});
