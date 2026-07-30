import test from "node:test";
import assert from "node:assert/strict";
import { validateCompositionManifest } from "../src/ffmpeg/manifest.js";

test("normalizes a clips, logo, and voice composition", () => {
  const manifest = validateCompositionManifest({
    scenes: [
      { source: "https://cdn.example.com/a.mp4", kind: "video", duration: 2 },
      { source: "https://cdn.example.com/b.png", kind: "image", duration: 1.5 },
    ],
    logo: { source: "https://cdn.example.com/logo.png", position: "bottom-left" },
    audio: { voice: { source: "https://cdn.example.com/voice.wav" } },
  });

  assert.equal(manifest.version, 1);
  assert.equal(manifest.output.width, 1080);
  assert.equal(manifest.output.height, 1920);
  assert.equal(manifest.scenes.length, 2);
  assert.equal(manifest.logo.position, "bottom-left");
  assert.equal(manifest.audio.voice.volume, 1);
});

test("rejects missing image duration and invalid logo position", () => {
  assert.throws(
    () =>
      validateCompositionManifest({
        scenes: [{ source: "x.png", kind: "image" }],
      }),
    /duration is required/,
  );
  assert.throws(
    () =>
      validateCompositionManifest({
        scenes: [{ source: "x.mp4", kind: "video", duration: 1 }],
        logo: { source: "logo.png", position: "under-the-video" },
      }),
    /position is unsupported/,
  );
});

test("bounds scene counts and output dimensions", () => {
  assert.throws(() => validateCompositionManifest({ scenes: [] }), /between 1 and 30/);
  assert.throws(
    () =>
      validateCompositionManifest({
        scenes: [{ source: "x.mp4", kind: "video", duration: 1 }],
        output: { width: 321 },
      }),
    /even integer/,
  );
});

