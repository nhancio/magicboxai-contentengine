import assert from "node:assert/strict";
import test from "node:test";
import {
  getPreset,
  rankPresetsForTrends,
} from "../convex/lib/presets.ts";

test("ranks Miniature Crew first for a current tiny-workers signal", () => {
  const ranked = rankPresetsForTrends({
    platforms: ["instagram"],
    mediaType: "video",
    trends: [
      {
        platform: "instagram",
        kind: "format",
        value: "Tiny workers",
        score: 0.91,
      },
    ],
  });

  assert.equal(ranked[0]?.id, "miniature-crew");
  assert.equal(ranked[0]?.isTrending, true);
  assert.equal(ranked[0]?.matchedTrend, "Tiny workers");
});

test("filters creator templates to the selected platform", () => {
  const ranked = rankPresetsForTrends({
    platforms: ["linkedin"],
    mediaType: "video",
    trends: [],
  });

  assert.equal(ranked.some((preset) => preset.id === "miniature-crew"), false);
  assert.equal(ranked.some((preset) => preset.id === "work-chaos-punchline"), true);
});

test("comic-duo template carries an explicit original-or-licensed guardrail", () => {
  const preset = getPreset("comic-duo-banter");

  assert.match(preset.description, /Motu Patlu-style/i);
  assert.match(preset.rightsNote ?? "", /original characters|licensed/i);
  assert.match(preset.direction, /Do not name, depict, imitate, or clone/i);
});
