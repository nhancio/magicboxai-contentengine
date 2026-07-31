const test = require("node:test");
const assert = require("node:assert/strict");

const {
  linkedinUploadVideo,
  publishLinkedIn,
} = require("../../lib/publishing.js");

test("linkedinUploadVideo completes full upload pipeline successfully", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options = {}) => {
    if (url === "https://example.com/test-video.mp4") {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4, 5]).buffer,
      };
    }

    if (url === "https://api.linkedin.com/rest/videos?action=initializeUpload") {
      assert.equal(options.method, "POST");
      const body = JSON.parse(options.body);
      assert.equal(body.initializeUploadRequest.owner, "urn:li:person:123");
      assert.equal(body.initializeUploadRequest.fileSizeBytes, 5);

      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            value: {
              video: "urn:li:video:test_urn_123",
              uploadToken: "test_upload_token",
              uploadInstructions: [
                {
                  uploadUrl: "https://upload.linkedin.com/chunk/1",
                  firstByte: 0,
                  lastByte: 4,
                },
              ],
            },
          }),
      };
    }

    if (url === "https://upload.linkedin.com/chunk/1") {
      assert.equal(options.method, "PUT");
      return {
        ok: true,
        status: 200,
        text: async () => "",
        headers: new Map([["etag", '"etag_part_1"']]),
      };
    }

    if (url === "https://api.linkedin.com/rest/videos?action=finalizeUpload") {
      assert.equal(options.method, "POST");
      const body = JSON.parse(options.body);
      assert.equal(body.finalizeUploadRequest.video, "urn:li:video:test_urn_123");
      assert.equal(body.finalizeUploadRequest.uploadToken, "test_upload_token");
      assert.deepEqual(body.finalizeUploadRequest.uploadedPartIds, ["etag_part_1"]);

      return {
        ok: true,
        status: 200,
        text: async () => "",
      };
    }

    if (url === "https://api.linkedin.com/rest/videos/urn%3Ali%3Avideo%3Atest_urn_123") {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "AVAILABLE" }),
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const videoUrn = await linkedinUploadVideo(
      "test_access_token",
      "urn:li:person:123",
      "https://example.com/test-video.mp4"
    );
    assert.equal(videoUrn, "urn:li:video:test_urn_123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publishLinkedIn uploads video and creates video post", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options = {}) => {
    if (url === "https://example.com/my-video.mp4") {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([10, 20]).buffer,
      };
    }

    if (url === "https://api.linkedin.com/rest/videos?action=initializeUpload") {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            value: {
              video: "urn:li:video:vid_999",
              uploadInstructions: [{ uploadUrl: "https://upload.linkedin.com/chunk/1", firstByte: 0, lastByte: 1 }],
            },
          }),
      };
    }

    if (url === "https://upload.linkedin.com/chunk/1") {
      return {
        ok: true,
        status: 200,
        text: async () => "",
        headers: new Map([["etag", "etag_abc"]]),
      };
    }

    if (url === "https://api.linkedin.com/rest/videos?action=finalizeUpload") {
      return {
        ok: true,
        status: 200,
        text: async () => "",
      };
    }

    if (url === "https://api.linkedin.com/rest/videos/urn%3Ali%3Avideo%3Avid_999") {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "AVAILABLE" }),
      };
    }

    if (url === "https://api.linkedin.com/rest/posts") {
      const body = JSON.parse(options.body);
      assert.equal(body.author, "urn:li:person:123");
      assert.equal(body.commentary, "Check out this video");
      assert.deepEqual(body.content, { media: { id: "urn:li:video:vid_999" } });

      return {
        ok: true,
        status: 201,
        text: async () => "",
        headers: new Map([["x-restli-id", "post_urn_555"]]),
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const permalink = await publishLinkedIn(
      { accessToken: "token_123" },
      "urn:li:person:123",
      "Check out this video",
      { url: "https://example.com/my-video.mp4", type: "video" }
    );
    assert.equal(permalink, "https://www.linkedin.com/feed/update/post_urn_555");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("linkedinUploadVideo handles video processing failure error", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (url === "https://example.com/fail-video.mp4") {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      };
    }
    if (url === "https://api.linkedin.com/rest/videos?action=initializeUpload") {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            value: {
              video: "urn:li:video:failed_vid",
              uploadInstructions: [{ uploadUrl: "https://upload.linkedin.com/chunk/1", firstByte: 0, lastByte: 0 }],
            },
          }),
      };
    }
    if (url === "https://upload.linkedin.com/chunk/1") {
      return {
        ok: true,
        status: 200,
        text: async () => "",
        headers: new Map([["etag", "etag_1"]]),
      };
    }
    if (url === "https://api.linkedin.com/rest/videos?action=finalizeUpload") {
      return { ok: true, status: 200, text: async () => "" };
    }
    if (url === "https://api.linkedin.com/rest/videos/urn%3Ali%3Avideo%3Afailed_vid") {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: "PROCESSING_FAILED",
            processingFailureReason: "INVALID_FILE_FORMAT",
          }),
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    await assert.rejects(
      linkedinUploadVideo("token", "urn:li:person:1", "https://example.com/fail-video.mp4"),
      /LinkedIn video processing failed: INVALID_FILE_FORMAT/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
