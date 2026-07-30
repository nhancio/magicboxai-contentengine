import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateCompositionManifest } from "./manifest.js";
import { runProcess } from "./process.js";

const MAX_TOTAL_DURATION_SECONDS = 180;

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function allowedLocalAsset(assetPath, inputRoot) {
  const root = await fs.realpath(inputRoot);
  const resolved = await fs.realpath(path.resolve(assetPath));
  if (!within(root, resolved)) {
    throw new Error(`asset must be inside the renderer input root: ${assetPath}`);
  }
  return resolved;
}

async function probeMedia(filePath, ffprobePath) {
  const { stdout } = await runProcess(ffprobePath, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout);
  const duration = Number(parsed.format?.duration);
  return {
    duration: Number.isFinite(duration) ? duration : undefined,
    streams: Array.isArray(parsed.streams) ? parsed.streams : [],
  };
}

function visualFilter(scene, output, duration) {
  const { width, height, fps } = output;
  const fit =
    scene.fit === "contain"
      ? `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${scene.background}`
      : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const motion =
    scene.kind === "image" && scene.motion === "slow-zoom"
      ? `,zoompan=z='min(zoom+0.0015,1.08)':x='iw/2-(iw/zoom/2)':` +
        `y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps}`
      : "";
  return `${fit}${motion},fps=${fps},trim=duration=${duration},setpts=PTS-STARTPTS,setsar=1,format=yuv420p`;
}

function overlayPosition(position, margin) {
  const horizontal = position.endsWith("left")
    ? `${margin}`
    : position.endsWith("right")
      ? `W-w-${margin}`
      : "(W-w)/2";
  const vertical = position.startsWith("top")
    ? `${margin}`
    : position.startsWith("bottom")
      ? `H-h-${margin}`
      : "(H-h)/2";
  return { x: horizontal, y: vertical };
}

async function renderNormalizedScene({
  scene,
  index,
  output,
  duration,
  destination,
  ffmpegPath,
  onProgress,
}) {
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  if (scene.kind === "image") {
    args.push("-loop", "1", "-framerate", String(output.fps));
  } else if (scene.trimStart > 0) {
    args.push("-ss", String(scene.trimStart));
  }
  args.push("-i", scene.source, "-t", String(duration));
  args.push(
    "-map",
    "0:v:0",
    "-vf",
    visualFilter(scene, output, duration),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    output.preset,
    "-crf",
    String(output.crf),
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(output.fps),
    "-movflags",
    "+faststart",
    destination,
  );
  onProgress?.({ stage: "normalize", scene: index, totalScenes: undefined });
  await runProcess(ffmpegPath, args);
}

async function stitchScenes({ clips, durations, scenes, output, destination, ffmpegPath, onProgress }) {
  if (clips.length === 1) {
    await fs.copyFile(clips[0], destination);
    return durations[0];
  }

  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  for (const clip of clips) args.push("-i", clip);

  const filters = clips.map(
    (_, index) => `[${index}:v]settb=AVTB,setpts=PTS-STARTPTS[v${index}]`,
  );
  let currentLabel = "[v0]";
  let currentDuration = durations[0];

  for (let index = 1; index < clips.length; index++) {
    const transition = scenes[index - 1].transitionToNext;
    const nextLabel = `[v${index}]`;
    const outLabel = `[joined${index}]`;
    if (transition.type === "cut") {
      filters.push(`${currentLabel}${nextLabel}concat=n=2:v=1:a=0${outLabel}`);
      currentDuration += durations[index];
    } else {
      const transitionDuration = Math.min(
        transition.duration,
        Math.max(0.05, currentDuration / 2),
        Math.max(0.05, durations[index] / 2),
      );
      const offset = Math.max(0, currentDuration - transitionDuration);
      filters.push(
        `${currentLabel}${nextLabel}xfade=transition=${transition.type}:` +
          `duration=${transitionDuration}:offset=${offset}${outLabel}`,
      );
      currentDuration += durations[index] - transitionDuration;
    }
    currentLabel = outLabel;
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    currentLabel,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    output.preset,
    "-crf",
    String(output.crf),
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(output.fps),
    "-movflags",
    "+faststart",
    destination,
  );
  onProgress?.({ stage: "stitch", progress: 0 });
  await runProcess(ffmpegPath, args);
  onProgress?.({ stage: "stitch", progress: 1 });
  return currentDuration;
}

async function addBrandAndAudio({
  visualPath,
  manifest,
  duration,
  destination,
  ffmpegPath,
  onProgress,
}) {
  const { output, logo, audio } = manifest;
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", visualPath];
  const filters = [];
  let inputIndex = 1;
  let videoMap = "0:v:0";

  if (logo) {
    args.push("-loop", "1", "-framerate", String(output.fps), "-i", logo.source);
    const logoIndex = inputIndex++;
    const logoWidth = Math.round(output.width * logo.widthRatio);
    const position = overlayPosition(logo.position, logo.margin);
    filters.push(
      `[${logoIndex}:v]scale=${logoWidth}:-2,format=rgba,` +
        `colorchannelmixer=aa=${logo.opacity},setpts=PTS-STARTPTS[brandlogo]`,
    );
    filters.push(
      `[0:v][brandlogo]overlay=x=${position.x}:y=${position.y}:` +
        `eof_action=repeat:shortest=1[vout]`,
    );
    videoMap = "[vout]";
  }

  let voiceIndex;
  let musicIndex;
  if (audio.voice) {
    args.push("-i", audio.voice.source);
    voiceIndex = inputIndex++;
  }
  if (audio.music) {
    if (audio.music.loop) args.push("-stream_loop", "-1");
    args.push("-i", audio.music.source);
    musicIndex = inputIndex++;
  }

  let audioMap;
  if (voiceIndex !== undefined) {
    filters.push(
      `[${voiceIndex}:a]aresample=48000,atrim=0:${duration},asetpts=PTS-STARTPTS,` +
        `apad=pad_dur=${duration},atrim=0:${duration},volume=${audio.voice.volume}[voice]`,
    );
  }
  if (musicIndex !== undefined) {
    filters.push(
      `[${musicIndex}:a]aresample=48000,atrim=0:${duration},asetpts=PTS-STARTPTS,` +
        `apad=pad_dur=${duration},atrim=0:${duration},volume=${audio.music.volume}[music]`,
    );
  }

  if (voiceIndex !== undefined && musicIndex !== undefined) {
    if (audio.duckMusicUnderVoice) {
      filters.push("[voice]asplit=2[voice_sidechain][voice_mix]");
      filters.push(
        "[music][voice_sidechain]sidechaincompress=" +
          "threshold=0.025:ratio=8:attack=20:release=400[duckedmusic]",
      );
      filters.push(
        "[voice_mix][duckedmusic]amix=inputs=2:duration=first:" +
          "dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]",
      );
    } else {
      filters.push(
        "[voice][music]amix=inputs=2:duration=first:" +
          "dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]",
      );
    }
    audioMap = "[aout]";
  } else if (voiceIndex !== undefined) {
    filters.push("[voice]alimiter=limit=0.95[aout]");
    audioMap = "[aout]";
  } else if (musicIndex !== undefined) {
    filters.push("[music]alimiter=limit=0.95[aout]");
    audioMap = "[aout]";
  } else {
    args.push(
      "-f",
      "lavfi",
      "-t",
      String(duration),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
    );
    audioMap = `${inputIndex}:a:0`;
  }

  if (filters.length > 0) args.push("-filter_complex", filters.join(";"));
  args.push("-map", videoMap, "-map", audioMap);
  args.push(
    "-c:v",
    logo ? "libx264" : "copy",
    ...(logo
      ? ["-preset", output.preset, "-crf", String(output.crf), "-pix_fmt", "yuv420p"]
      : []),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-t",
    String(duration),
    "-movflags",
    "+faststart",
    destination,
  );

  onProgress?.({ stage: "brand-and-audio", progress: 0 });
  await runProcess(ffmpegPath, args);
  onProgress?.({ stage: "brand-and-audio", progress: 1 });
}

/**
 * Compose a publishable H.264/AAC MP4 from normalized user assets.
 *
 * Callers must first download remote assets into `inputRoot`; this function
 * accepts local paths only and rejects path traversal.
 */
export async function composeVideo(options) {
  const manifest = validateCompositionManifest(options.manifest);
  const ffmpegPath = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg";
  const ffprobePath = options.ffprobePath ?? process.env.FFPROBE_PATH ?? "ffprobe";
  const inputRoot = path.resolve(options.inputRoot);
  const outputPath = path.resolve(options.outputPath);
  const workRoot = path.resolve(options.workRoot ?? os.tmpdir());
  await fs.mkdir(workRoot, { recursive: true });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const workspace = await fs.mkdtemp(path.join(workRoot, "magicbox-compose-"));

  try {
    const localizedScenes = [];
    const durations = [];
    for (let index = 0; index < manifest.scenes.length; index++) {
      const scene = manifest.scenes[index];
      const localSource = await allowedLocalAsset(scene.source, inputRoot);
      const media = await probeMedia(localSource, ffprobePath);
      const available =
        scene.kind === "video" && media.duration !== undefined
          ? Math.max(0, media.duration - scene.trimStart)
          : undefined;
      const duration = scene.duration ?? available;
      if (!duration || duration < 0.25) {
        throw new Error(`could not determine a usable duration for scene ${index}`);
      }
      if (available !== undefined && duration > available + 0.15) {
        throw new Error(`scene ${index} requests ${duration}s but only ${available.toFixed(2)}s remain`);
      }
      localizedScenes.push({ ...scene, source: localSource });
      durations.push(duration);
    }

    const requestedTotal = durations.reduce((sum, value) => sum + value, 0);
    if (requestedTotal > MAX_TOTAL_DURATION_SECONDS) {
      throw new Error(`composition exceeds ${MAX_TOTAL_DURATION_SECONDS} seconds`);
    }

    const localizedManifest = {
      ...manifest,
      scenes: localizedScenes,
      logo: manifest.logo
        ? { ...manifest.logo, source: await allowedLocalAsset(manifest.logo.source, inputRoot) }
        : undefined,
      audio: {
        ...manifest.audio,
        voice: manifest.audio.voice
          ? {
              ...manifest.audio.voice,
              source: await allowedLocalAsset(manifest.audio.voice.source, inputRoot),
            }
          : undefined,
        music: manifest.audio.music
          ? {
              ...manifest.audio.music,
              source: await allowedLocalAsset(manifest.audio.music.source, inputRoot),
            }
          : undefined,
      },
    };

    const clips = [];
    for (let index = 0; index < localizedScenes.length; index++) {
      const destination = path.join(workspace, `scene-${String(index).padStart(2, "0")}.mp4`);
      await renderNormalizedScene({
        scene: localizedScenes[index],
        index,
        output: manifest.output,
        duration: durations[index],
        destination,
        ffmpegPath,
        onProgress: options.onProgress,
      });
      clips.push(destination);
    }

    const visualPath = path.join(workspace, "visual.mp4");
    const stitchedDuration = await stitchScenes({
      clips,
      durations,
      scenes: localizedScenes,
      output: manifest.output,
      destination: visualPath,
      ffmpegPath,
      onProgress: options.onProgress,
    });

    await addBrandAndAudio({
      visualPath,
      manifest: localizedManifest,
      duration: stitchedDuration,
      destination: outputPath,
      ffmpegPath,
      onProgress: options.onProgress,
    });

    const result = await probeMedia(outputPath, ffprobePath);
    const video = result.streams.find((stream) => stream.codec_type === "video");
    const audio = result.streams.find((stream) => stream.codec_type === "audio");
    if (!video || Number(video.width) !== manifest.output.width || Number(video.height) !== manifest.output.height) {
      throw new Error("rendered file failed dimension verification");
    }
    if (!audio) throw new Error("rendered file is missing its platform-compatible audio track");

    return {
      outputPath,
      duration: result.duration ?? stitchedDuration,
      width: Number(video.width),
      height: Number(video.height),
      videoCodec: video.codec_name,
      audioCodec: audio.codec_name,
      sceneCount: localizedScenes.length,
    };
  } finally {
    if (!options.keepWorkspace) {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  }
}

