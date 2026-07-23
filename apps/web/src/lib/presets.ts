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
  "solo-founder": {
    label: "Solo founder",
    platforms: ["linkedin", "instagram"],
    blurb: "One brief a week becomes a full calendar.",
  },
  "lean-team": {
    label: "Lean marketing team",
    platforms: ["instagram", "linkedin", "youtube"],
    blurb: "Create a reviewable publishing cadence for one brand.",
  },
};

export function getPreset(id: string | null | undefined): UseCasePreset | null {
  if (!id) return null;
  return USE_CASE_PRESETS[id] ?? null;
}
