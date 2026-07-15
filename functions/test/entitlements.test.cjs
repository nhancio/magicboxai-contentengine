const test = require("node:test");
const assert = require("node:assert/strict");

const {
  activePaidPostEntitlement,
  PAID_POST_LIMITS,
} = require("../lib/entitlements.js");

const NOW = 1_750_000_000_000;
const timestamp = (millis) => ({ toMillis: () => millis });

test("accepts only active, unexpired paid publishing entitlements", () => {
  assert.deepEqual(
    activePaidPostEntitlement(
      { plan: "pro", status: "active", currentPeriodEnd: timestamp(NOW + 1) },
      NOW
    ),
    { plan: "pro", limit: PAID_POST_LIMITS.pro, currentPeriodEndMs: NOW + 1 }
  );
  assert.deepEqual(
    activePaidPostEntitlement(
      { plan: "max", status: "active", currentPeriodEnd: timestamp(NOW + 60_000) },
      NOW
    ),
    { plan: "max", limit: PAID_POST_LIMITS.max, currentPeriodEndMs: NOW + 60_000 }
  );
});

test("fails closed for missing, inactive, unknown, boundary, expired, and malformed records", () => {
  const invalid = [
    undefined,
    { plan: "pro", currentPeriodEnd: timestamp(NOW + 1) },
    { plan: "pro", status: "past_due", currentPeriodEnd: timestamp(NOW + 1) },
    { plan: "free", status: "active", currentPeriodEnd: timestamp(NOW + 1) },
    { plan: "pro", status: "active" },
    { plan: "pro", status: "active", currentPeriodEnd: timestamp(NOW) },
    { plan: "pro", status: "active", currentPeriodEnd: timestamp(NOW - 1) },
    { plan: "pro", status: "active", currentPeriodEnd: timestamp(Number.NaN) },
    { plan: "pro", status: "active", currentPeriodEnd: { toMillis: () => { throw new Error("bad"); } } },
  ];

  for (const record of invalid) {
    assert.equal(activePaidPostEntitlement(record, NOW), null);
  }
});
