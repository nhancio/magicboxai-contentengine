const assert = require("node:assert/strict");
const test = require("node:test");

const { buildOnboardingHtml } = require("../lib/brevo.js");

test("welcome email follows the website-first onboarding policy", () => {
  const html = buildOnboardingHtml("Nithin");

  assert.match(html, /Link your website/);
  assert.match(html, /Connect one social channel/);
  assert.match(html, /Review and approve/);
  assert.match(html, /Maya activates after both setup steps are complete/);
  assert.match(html, /Complete your setup/);
  assert.match(html, /https:\/\/app\.magicboxai\.in\/onboarding/);
  assert.doesNotMatch(html, /trial every feature free/i);
  assert.doesNotMatch(html, /with no limits/i);
});

test("welcome email escapes the recipient name", () => {
  const html = buildOnboardingHtml("<script>alert('x')</script>");

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
