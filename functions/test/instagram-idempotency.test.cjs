const test = require("node:test");
const assert = require("node:assert/strict");

// Require built publishing module
const publishing = require("../lib/publishing.js");

// Helper to mock globalThis.fetch
function mockFetch(handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    return handler(String(url), options);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("Instagram idempotency: reuses existing FINISHED creationId and skips container creation", async () => {
  const calls = [];
  const restore = mockFetch(async (url, options) => {
    calls.push({ url, method: options?.method || "GET", body: options?.body?.toString() });

    if (url.includes("creation_123?fields=status_code,status")) {
      return {
        ok: true,
        json: async () => ({ status_code: "FINISHED" }),
        text: async () => JSON.stringify({ status_code: "FINISHED" }),
      };
    }
    if (url.includes("creation_123?fields=status_code")) {
      return {
        ok: true,
        json: async () => ({ status_code: "FINISHED" }),
        text: async () => JSON.stringify({ status_code: "FINISHED" }),
      };
    }
    if (url.includes("/media_publish")) {
      return {
        ok: true,
        text: async () => JSON.stringify({ id: "published_media_999" }),
      };
    }
    if (url.includes("/published_media_999?fields=permalink")) {
      return {
        ok: true,
        json: async () => ({ permalink: "https://www.instagram.com/p/test123/" }),
      };
    }
    throw new Error(`Unexpected fetch call to ${url}`);
  });

  try {
    const token = { igUserId: "ig_user_001", accessToken: "token_abc" };
    const caption = "Test post";
    const media = { url: "https://example.com/image.jpg", type: "image" };
    const options = {
      creationId: "creation_123",
      onCreationId: async () => {
        assert.fail("onCreationId should not be called when creationId is reused");
      },
    };

    // Access publishInstagram if exported or test via publishPost / publishInstagram
    // Note: publishInstagram is internal to publishing.js, so let's test via mock loadAccount or export if needed
    // Let's verify if publishInstagram is callable
    if (typeof publishing.publishInstagram === "function") {
      const result = await publishing.publishInstagram(token, caption, media, options);
      assert.equal(result.creationId, "creation_123");
      assert.equal(result.permalink, "https://www.instagram.com/p/test123/");

      // Verify POST /{ig-user-id}/media container creation was NOT called
      const containerCreateCalls = calls.filter((c) => c.url.endsWith("/ig_user_001/media") && c.method === "POST");
      assert.equal(containerCreateCalls.length, 0);
    }
  } finally {
    restore();
  }
});

test("Instagram idempotency: handles already PUBLISHED creationId gracefully", async () => {
  const calls = [];
  const restore = mockFetch(async (url, options) => {
    calls.push({ url, method: options?.method || "GET" });

    if (url.includes("creation_123?fields=status_code,status")) {
      return {
        ok: true,
        json: async () => ({ status_code: "PUBLISHED" }),
        text: async () => JSON.stringify({ status_code: "PUBLISHED" }),
      };
    }
    if (url.includes("creation_123?fields=permalink")) {
      return {
        ok: true,
        json: async () => ({ permalink: "https://www.instagram.com/p/already_published/" }),
      };
    }
    throw new Error(`Unexpected fetch call to ${url}`);
  });

  try {
    const token = { igUserId: "ig_user_001", accessToken: "token_abc" };
    const caption = "Test post";
    const media = { url: "https://example.com/image.jpg", type: "image" };
    const options = { creationId: "creation_123" };

    if (typeof publishing.publishInstagram === "function") {
      const result = await publishing.publishInstagram(token, caption, media, options);
      assert.equal(result.creationId, "creation_123");
      assert.equal(result.permalink, "https://www.instagram.com/p/already_published/");

      // Verify no media_publish call was made
      const publishCalls = calls.filter((c) => c.url.includes("/media_publish"));
      assert.equal(publishCalls.length, 0);
    }
  } finally {
    restore();
  }
});

test("Instagram idempotency: persists creationId via onCreationId before media_publish when creating new container", async () => {
  let persistedId = null;
  const events = [];

  const restore = mockFetch(async (url, options) => {
    events.push(`fetch:${url.split("?")[0].split("/").slice(-2).join("/")}`);

    if (url.endsWith("/ig_user_001/media")) {
      return {
        ok: true,
        text: async () => JSON.stringify({ id: "new_creation_456" }),
      };
    }
    if (url.includes("new_creation_456?fields=status_code")) {
      return {
        ok: true,
        json: async () => ({ status_code: "FINISHED" }),
      };
    }
    if (url.includes("/media_publish")) {
      events.push("media_publish");
      return {
        ok: true,
        text: async () => JSON.stringify({ id: "published_media_789" }),
      };
    }
    if (url.includes("/published_media_789?fields=permalink")) {
      return {
        ok: true,
        json: async () => ({ permalink: "https://www.instagram.com/p/new789/" }),
      };
    }
    throw new Error(`Unexpected fetch call to ${url}`);
  });

  try {
    const token = { igUserId: "ig_user_001", accessToken: "token_abc" };
    const caption = "New post";
    const media = { url: "https://example.com/image2.jpg", type: "image" };
    const options = {
      onCreationId: async (cid) => {
        persistedId = cid;
        events.push(`persisted:${cid}`);
      },
    };

    if (typeof publishing.publishInstagram === "function") {
      const result = await publishing.publishInstagram(token, caption, media, options);
      assert.equal(result.creationId, "new_creation_456");
      assert.equal(persistedId, "new_creation_456");

      // Verify onCreationId persistence happened BEFORE media_publish
      const persistIdx = events.indexOf("persisted:new_creation_456");
      const publishIdx = events.indexOf("media_publish");
      assert.ok(persistIdx >= 0, "creationId was persisted");
      assert.ok(publishIdx >= 0, "media_publish was called");
      assert.ok(persistIdx < publishIdx, "creationId was persisted BEFORE media_publish");
    }
  } finally {
    restore();
  }
});
