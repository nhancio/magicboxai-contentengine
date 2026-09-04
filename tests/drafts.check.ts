/**
 * Checks the draft readers that decide whether the Drafts section on
 * /automations shows anything.
 *
 *   node --experimental-strip-types --test tests/drafts.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k) : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const {
  automationDraftKey,
  clearStudioDraft,
  readAutomationDraft,
  readStudioDraft,
  studioKey,
  writePersisted,
} = await import("../apps/web/src/lib/drafts.ts");

const UID = "user-1";

test("no stored state means no draft", () => {
  store.clear();
  assert.equal(readAutomationDraft(UID), null);
  assert.equal(readStudioDraft(UID), null);
});

test("an automation draft with only a step is not worth resuming", () => {
  store.clear();
  writePersisted(automationDraftKey(UID), { step: 3, name: "", brief: "" });
  assert.equal(readAutomationDraft(UID), null);

  writePersisted(automationDraftKey(UID), { step: 3, name: "", brief: "Weekly tips" });
  assert.equal(readAutomationDraft(UID)?.step, 3);
});

test("a Studio draft counts when there is a prompt, a caption, or media", () => {
  store.clear();
  writePersisted(studioKey(UID, "prompt"), "   ");
  assert.equal(readStudioDraft(UID), null);

  writePersisted(studioKey(UID, "media"), { type: "image", url: "u", source: "imagen" });
  assert.equal(readStudioDraft(UID)?.hasMedia, true);
});

test("drafts are per user and clear completely", () => {
  store.clear();
  writePersisted(studioKey(UID, "caption"), "hello");
  writePersisted(studioKey(UID, "channel"), "linkedin");
  assert.equal(readStudioDraft("other-user"), null);
  assert.equal(readStudioDraft(UID)?.channel, "linkedin");

  clearStudioDraft(UID);
  assert.equal(readStudioDraft(UID), null);
  assert.equal(store.size, 0);
});
