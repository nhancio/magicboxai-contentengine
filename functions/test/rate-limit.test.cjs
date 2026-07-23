const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateFixedWindowRateLimit } = require("../lib/rate-limit.js");

const LIMIT = { limit: 2, windowMs: 60_000 };

test("allows requests until a fixed window is full", () => {
  const first = evaluateFixedWindowRateLimit(undefined, LIMIT, 1_000);
  assert.deepEqual(first, { allowed: true, count: 1, windowStartedAtMs: 1_000 });

  const second = evaluateFixedWindowRateLimit(
    { windowStartedAtMs: first.windowStartedAtMs, count: first.count },
    LIMIT,
    2_000,
  );
  assert.deepEqual(second, { allowed: true, count: 2, windowStartedAtMs: 1_000 });

  assert.deepEqual(
    evaluateFixedWindowRateLimit(
      { windowStartedAtMs: second.windowStartedAtMs, count: second.count },
      LIMIT,
      3_000,
    ),
    { allowed: false, retryAfterMs: 58_000 },
  );
});

test("resets an expired or clock-skewed window", () => {
  assert.deepEqual(
    evaluateFixedWindowRateLimit({ windowStartedAtMs: 1_000, count: 2 }, LIMIT, 61_000),
    { allowed: true, count: 1, windowStartedAtMs: 61_000 },
  );
  assert.deepEqual(
    evaluateFixedWindowRateLimit({ windowStartedAtMs: 70_000, count: 2 }, LIMIT, 61_000),
    { allowed: true, count: 1, windowStartedAtMs: 61_000 },
  );
});

test("treats malformed stored state as a fresh window", () => {
  assert.deepEqual(
    evaluateFixedWindowRateLimit({ windowStartedAtMs: "bad", count: -1 }, LIMIT, 5_000),
    { allowed: true, count: 1, windowStartedAtMs: 5_000 },
  );
  assert.throws(
    () => evaluateFixedWindowRateLimit(undefined, { limit: 0, windowMs: 1 }, 5_000),
    /Invalid rate-limit configuration/,
  );
});
