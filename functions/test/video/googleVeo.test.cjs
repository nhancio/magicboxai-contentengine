const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateVeoVideo,
  normalizeGcsDirectoryUri,
  parseGcsUri,
} = require("../../lib/video/googleVeo.js");

test("uses the typed Veo request/poll contract and returned GCS object", async () => {
  const pending = { name: "operations/video-1", done: false };
  const completed = {
    name: pending.name,
    done: true,
    response: {
      generatedVideos: [
        {
          video: {
            uri: "gs://magicbox-test/posts/post-1/job-1/generated-video.mp4",
            mimeType: "video/mp4",
          },
        },
      ],
    },
  };

  let submittedRequest;
  let pollParameters;
  const ai = {
    models: {
      generateVideos: async (request) => {
        submittedRequest = request;
        return pending;
      },
    },
    operations: {
      getVideosOperation: async (parameters) => {
        pollParameters = parameters;
        return completed;
      },
    },
  };

  const result = await generateVeoVideo({
    ai,
    prompt: "A product demo",
    outputGcsUri: "gs://magicbox-test/posts/post-1/job-1",
    durationSeconds: 8,
    sourceImage: {
      gcsUri: "gs://magicbox-test/users/user-1/avatar.jpg",
      mimeType: "image/jpeg",
    },
    polling: { intervalMs: 0, maxAttempts: 1, sleep: async () => {} },
  });

  assert.equal(submittedRequest.config.outputGcsUri, "gs://magicbox-test/posts/post-1/job-1/");
  assert.equal(Object.hasOwn(submittedRequest.config, "outputUri"), false);
  assert.equal(submittedRequest.config.numberOfVideos, 1);
  assert.deepEqual(submittedRequest.source.image, {
    gcsUri: "gs://magicbox-test/users/user-1/avatar.jpg",
    mimeType: "image/jpeg",
  });
  assert.deepEqual(Object.keys(pollParameters), ["operation"]);
  assert.equal(pollParameters.operation, pending);
  assert.equal(result.gcsUri, completed.response.generatedVideos[0].video.uri);
  assert.equal(result.storagePath, "posts/post-1/job-1/generated-video.mp4");
  assert.equal(result.pollAttempts, 1);
});

test("rejects a generated URI outside the requested output directory", async () => {
  const ai = {
    models: {
      generateVideos: async () => ({
        name: "operations/video-2",
        done: true,
        response: {
          generatedVideos: [
            { video: { uri: "gs://different-bucket/stolen/video.mp4", mimeType: "video/mp4" } },
          ],
        },
      }),
    },
    operations: {
      getVideosOperation: async () => {
        throw new Error("should not poll a completed operation");
      },
    },
  };

  await assert.rejects(
    generateVeoVideo({
      ai,
      prompt: "A safe test video",
      outputGcsUri: "gs://magicbox-test/posts/post-2/job-1/",
      durationSeconds: 8,
    }),
    /outside the requested Cloud Storage directory/
  );
});

test("stops polling after the configured maximum", async () => {
  const pending = { name: "operations/video-3", done: false };
  let pollCalls = 0;
  let sleepCalls = 0;
  const ai = {
    models: { generateVideos: async () => pending },
    operations: {
      getVideosOperation: async ({ operation }) => {
        assert.equal(operation, pending);
        pollCalls += 1;
        return pending;
      },
    },
  };

  await assert.rejects(
    generateVeoVideo({
      ai,
      prompt: "A bounded polling test",
      outputGcsUri: "gs://magicbox-test/posts/post-3/job-1/",
      durationSeconds: 8,
      polling: {
        intervalMs: 0,
        maxAttempts: 2,
        sleep: async () => {
          sleepCalls += 1;
        },
      },
    }),
    /did not complete after 2 polls/
  );

  assert.equal(pollCalls, 2);
  assert.equal(sleepCalls, 2);
});

test("surfaces Veo safety-filter reasons when no video is returned", async () => {
  const ai = {
    models: {
      generateVideos: async () => ({
        name: "operations/video-4",
        done: true,
        response: {
          generatedVideos: [],
          raiMediaFilteredCount: 1,
          raiMediaFilteredReasons: ["synthetic test safety reason"],
        },
      }),
    },
    operations: {
      getVideosOperation: async () => {
        throw new Error("should not poll a completed operation");
      },
    },
  };

  await assert.rejects(
    generateVeoVideo({
      ai,
      prompt: "A filtered video",
      outputGcsUri: "gs://magicbox-test/posts/post-4/job-1/",
      durationSeconds: 8,
    }),
    /safety-filtered: synthetic test safety reason/
  );
});

test("normalizes and parses Cloud Storage directories", () => {
  assert.equal(
    normalizeGcsDirectoryUri("gs://magicbox-test/users/user-1/videos///"),
    "gs://magicbox-test/users/user-1/videos/"
  );
  assert.deepEqual(parseGcsUri("gs://magicbox-test/users/user-1/video.mp4"), {
    bucketName: "magicbox-test",
    storagePath: "users/user-1/video.mp4",
  });
  assert.throws(() => parseGcsUri("https://storage.googleapis.com/file.mp4"), /Invalid/);
});
