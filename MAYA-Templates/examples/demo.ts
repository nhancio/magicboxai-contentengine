/**
 * Live end-to-end demo: find a trending AI-generated reel for a brand and
 * adapt it. Hits real APIs.
 *
 *   MONID_API_KEY=... GEMINI_API_KEY=... npm run demo
 *
 * No keys hardcoded — without MONID_API_KEY it falls back to the curated set,
 * without GEMINI_API_KEY it falls back to the deterministic synthesizer.
 */
import { createAdaptedMemeReel } from "../src/index";
import type { BrandContext } from "../src/types";

const brand: BrandContext = {
  name: process.env.DEMO_BRAND_NAME ?? "Ownly",
  industry: process.env.DEMO_BRAND_INDUSTRY ?? "Food Delivery App",
  audience: "Hungry students and office workers in Indian metros",
  productOffering: "Curated Indian meals delivered in 20 minutes",
  toneOfVoice: "Playful, fast, unmistakably desi",
  targetCallToAction: "Order on Ownly today",
  colors: { primary: "#ff5f56", accent: "#ffbd2e" },
};

async function main() {
  console.log(`\nAdapting a trending reel for ${brand.name}...\n`);

  const result = await createAdaptedMemeReel({
    brand,
    keyword: process.env.DEMO_KEYWORD,
    humorIntensity: "unhinged_brainrot",
  });

  const { template, adaptation, usedAI, templateSource } = result;

  console.log(`SOURCE REEL   ${template.title}`);
  console.log(`              ${templateSource === "monid" ? "live from Monid" : "curated fallback"} · ${template.durationSec}s · ${template.format}`);
  console.log(`              ${template.previewVideoUrl}\n`);

  console.log(`SCRIPT BY     ${usedAI ? "Gemini" : "deterministic fallback (no GEMINI_API_KEY or call failed)"}\n`);

  console.log(`HOOK          ${adaptation.hookText}`);
  console.log(`SPOKEN        ${adaptation.adaptedScript}\n`);

  console.log("PER-SPEAKER LINES");
  for (const line of adaptation.lipSyncScript) {
    console.log(`  [${line.startSec}s-${line.endSec}s] ${line.speakerId}: "${line.spokenDialogue}"`);
    console.log(`      tone: ${line.deliveryTone}`);
  }

  console.log("\nOVERLAYS");
  for (const o of adaptation.textOverlays) {
    console.log(`  (${o.placement}) ${o.text}`);
  }

  console.log(`\nSUBTITLES     ${adaptation.subtitleCues.length} cards`);
  console.log(`SFX CUES      ${adaptation.sfxCues.map((c) => `${c.sfxName}@${c.timestampSec}s`).join(", ") || "none"}`);

  console.log(`\nCAPTION\n${adaptation.instagramCaption}`);
  console.log(`\n${adaptation.hashtags.join(" ")}`);

  if (adaptation.adaptationNote) console.log(`\nANGLE         ${adaptation.adaptationNote}`);
  console.log("");
}

main().catch((err) => {
  console.error("demo failed:", err);
  process.exit(1);
});
