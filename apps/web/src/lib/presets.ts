import type { SocialPlatform } from "@shared/types";

/**
 * Use-case presets. The landing page links to /onboarding?preset=<id>.
 * Keep ids in sync with USE_CASES in apps/landing/src/components/landing/use-cases-section.tsx.
 * `platforms` is filtered to the channels the app currently supports.
 */
export type UseCasePreset = {
  label: string;
  platforms: SocialPlatform[];
  blurb: string;
};

export const USE_CASE_PRESETS: Record<string, UseCasePreset> = {
  founder: {
    label: "Founder",
    platforms: ["linkedin", "instagram", "youtube"],
    blurb: "Build in public and stay top-of-mind.",
  },
  "solo-founder": {
    label: "Solo founder",
    platforms: ["linkedin", "instagram"],
    blurb: "One brief a week becomes a full calendar.",
  },
  agency: {
    label: "Marketing agency",
    platforms: ["instagram", "linkedin", "youtube"],
    blurb: "Run multiple brands from one workspace.",
  },
  d2c: {
    label: "D2C brand",
    platforms: ["instagram", "youtube"],
    blurb: "Turn products into scroll-stopping posts.",
  },
};

export function getPreset(id: string | null | undefined): UseCasePreset | null {
  if (!id) return null;
  return USE_CASE_PRESETS[id] ?? null;
}
