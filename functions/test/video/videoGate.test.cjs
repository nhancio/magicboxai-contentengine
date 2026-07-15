const test = require("node:test");
const assert = require("node:assert/strict");

const originalProLimit = process.env.VIDEO_LIMIT_PRO;
const originalMaxLimit = process.env.VIDEO_LIMIT_MAX;
delete process.env.VIDEO_LIMIT_PRO;
delete process.env.VIDEO_LIMIT_MAX;

const {
  PLAN_VIDEO_LIMIT,
  assertVeoGenerationEnabled,
  isVeoGenerationEnabled,
  parsePositiveBoundedInteger,
} = require("../../lib/core.js");
const { generatePostAssets, generatePostVideo } = require("../../lib/generation.js");

if (originalProLimit === undefined) delete process.env.VIDEO_LIMIT_PRO;
else process.env.VIDEO_LIMIT_PRO = originalProLimit;
if (originalMaxLimit === undefined) delete process.env.VIDEO_LIMIT_MAX;
else process.env.VIDEO_LIMIT_MAX = originalMaxLimit;

test("uses conservative video quota defaults", () => {
  assert.deepEqual(PLAN_VIDEO_LIMIT, { pro: 2, max: 10 });
});

test("accepts only positive bounded integer quota overrides", () => {
  assert.equal(parsePositiveBoundedInteger(undefined, 2, 10), 2);
  assert.equal(parsePositiveBoundedInteger(" 7 ", 2, 10), 7);
  assert.equal(parsePositiveBoundedInteger("10", 2, 10), 10);

  for (const invalid of ["", "0", "-1", "1.5", "1e1", "11", "not-a-number"]) {
    assert.equal(parsePositiveBoundedInteger(invalid, 2, 10), 2);
  }

  assert.throws(() => parsePositiveBoundedInteger("2", 0, 10), /Invalid bounded/);
  assert.throws(() => parsePositiveBoundedInteger("2", 2, 1), /Invalid bounded/);
});

test("enables Veo only for the exact server value true", () => {
  const original = process.env.ENABLE_VEO_GENERATION;
  try {
    delete process.env.ENABLE_VEO_GENERATION;
    assert.equal(isVeoGenerationEnabled(), false);
    assert.throws(
      () => assertVeoGenerationEnabled(),
      (error) => error?.code === "failed-precondition"
    );

    process.env.ENABLE_VEO_GENERATION = "TRUE";
    assert.equal(isVeoGenerationEnabled(), false);

    process.env.ENABLE_VEO_GENERATION = "true";
    assert.equal(isVeoGenerationEnabled(), true);
    assert.doesNotThrow(() => assertVeoGenerationEnabled());
  } finally {
    if (original === undefined) delete process.env.ENABLE_VEO_GENERATION;
    else process.env.ENABLE_VEO_GENERATION = original;
  }
});

test("automation Veo paths fail closed before other generation work", async () => {
  const original = process.env.ENABLE_VEO_GENERATION;
  delete process.env.ENABLE_VEO_GENERATION;

  try {
    const isDisabledError = (error) => error?.code === "failed-precondition";

    await assert.rejects(
      generatePostVideo({
        postId: "post-disabled",
        brand: null,
        brief: "This must not reach the provider",
      }),
      isDisabledError
    );

    await assert.rejects(
      generatePostAssets("post-disabled", {
        userId: "user-1",
        source: "automation",
        scheduledFor: { toDate: () => new Date() },
        timezone: "UTC",
        status: "scheduled",
        brief: "This must fail before captions or media generation",
        contentTypes: { text: true, image: true, video: true },
        platforms: ["instagram"],
        socialAccountIds: [],
        attempts: 0,
        maxAttempts: 3,
      }),
      isDisabledError
    );
  } finally {
    if (original === undefined) delete process.env.ENABLE_VEO_GENERATION;
    else process.env.ENABLE_VEO_GENERATION = original;
  }
});
