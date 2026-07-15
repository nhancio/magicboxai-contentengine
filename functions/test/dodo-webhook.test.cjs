const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const test = require("node:test");
const {
  parseIsoTimestamp,
  verifyStandardWebhook,
} = require("../lib/payments/dodo-webhook");

const secretBytes = Buffer.from("test-webhook-secret");
const secret = `whsec_${secretBytes.toString("base64")}`;
const webhookId = "wh_test_123";
const nowMs = Date.parse("2026-07-15T12:00:00.000Z");
const timestamp = String(nowMs / 1000);
const body = JSON.stringify({ type: "subscription.active", timestamp: new Date(nowMs).toISOString() });
const signature = createHmac("sha256", secretBytes)
  .update(`${webhookId}.${timestamp}.${body}`)
  .digest("base64");

test("accepts a fresh Standard Webhooks signature", () => {
  assert.deepEqual(
    verifyStandardWebhook(
      {
        "webhook-id": webhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": `v1,${signature}`,
      },
      body,
      secret,
      nowMs
    ),
    { ok: true, webhookId, sentAtMs: nowMs }
  );
});

test("rejects stale and modified webhook deliveries", () => {
  const headers = {
    "webhook-id": webhookId,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
  assert.equal(verifyStandardWebhook(headers, body, secret, nowMs + 10 * 60_000).ok, false);
  assert.equal(verifyStandardWebhook(headers, `${body} `, secret, nowMs).ok, false);
});

test("parses only valid ISO timestamps", () => {
  assert.equal(parseIsoTimestamp("2026-07-15T12:00:00Z")?.toISOString(), "2026-07-15T12:00:00.000Z");
  assert.equal(parseIsoTimestamp("not-a-date"), null);
  assert.equal(parseIsoTimestamp(undefined), null);
});
