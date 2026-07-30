import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { composeVideo } from "../src/ffmpeg/composer.js";
import { runProcess } from "../src/ffmpeg/process.js";

async function hasFfmpeg() {
  try {
    await runProcess(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"]);
    await runProcess(process.env.FFPROBE_PATH ?? "ffprobe", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

test("composes two cuts with a logo and supplied voice into a vertical MP4", async (t) => {
  if (!(await hasFfmpeg())) {
    t.skip("FFmpeg and ffprobe are required");
    return;
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "magicbox-ffmpeg-test-"));
  const video = path.join(root, "clip.mp4");
  const image = path.join(root, "still.png");
  const logo = path.join(root, "logo.png");
  const voice = path.join(root, "voice.wav");
  const output = path.join(root, "result.mp4");
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";

  try {
    await runProcess(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x1d4ed8:s=320x180:r=24",
      "-t",
      "1.2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      video,
    ]);
    await runProcess(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0xdc2626:s=160x160",
      "-frames:v",
      "1",
      image,
    ]);
    await runProcess(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0xfacc15:s=120x60",
      "-frames:v",
      "1",
      logo,
    ]);
    await runProcess(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-t",
      "2.2",
      "-c:a",
      "pcm_s16le",
      voice,
    ]);

    const result = await composeVideo({
      manifest: {
        output: { width: 360, height: 640, fps: 24, preset: "ultrafast" },
        scenes: [
          {
            source: video,
            kind: "video",
            duration: 1.1,
            transitionToNext: { type: "fade", duration: 0.2 },
          },
          { source: image, kind: "image", duration: 1, motion: "slow-zoom" },
        ],
        logo: {
          source: logo,
          position: "top-right",
          widthRatio: 0.2,
          opacity: 0.85,
          margin: 16,
        },
        audio: { voice: { source: voice, volume: 0.8 } },
      },
      inputRoot: root,
      outputPath: output,
      workRoot: root,
    });

    const stat = await fs.stat(output);
    assert.ok(stat.size > 5_000);
    assert.equal(result.width, 360);
    assert.equal(result.height, 640);
    assert.equal(result.sceneCount, 2);
    assert.equal(result.videoCodec, "h264");
    assert.equal(result.audioCodec, "aac");
    assert.ok(result.duration > 1.7 && result.duration < 2.2);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

