const POSITIONS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "center",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);
const TRANSITIONS = new Set(["cut", "fade", "fadeblack", "wipeleft", "wiperight", "slideleft"]);
const FITS = new Set(["cover", "contain"]);
const MOTIONS = new Set(["static", "slow-zoom"]);

function finiteNumber(value, fallback, name, min, max) {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(resolved) || resolved < min || resolved > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return resolved;
}

function evenInteger(value, fallback, name, min, max) {
  const resolved = Math.round(finiteNumber(value, fallback, name, min, max));
  if (resolved % 2 !== 0) throw new Error(`${name} must be an even integer`);
  return resolved;
}

function source(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 4_096) {
    throw new Error(`${name} must be a non-empty asset path or HTTPS URL`);
  }
  return value.trim();
}

function optionalTrack(raw, name, defaults) {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${name} must be an object`);
  return {
    source: source(raw.source, `${name}.source`),
    volume: finiteNumber(raw.volume, defaults.volume, `${name}.volume`, 0, 2),
    loop: Boolean(raw.loop ?? defaults.loop),
  };
}

/**
 * Validate and normalize the declarative editing contract accepted by the
 * FFmpeg worker. The output is deliberately boring JSON so it can be stored as
 * a durable job and replayed deterministically.
 */
export function validateCompositionManifest(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("manifest must be an object");
  }
  if (!Array.isArray(raw.scenes) || raw.scenes.length < 1 || raw.scenes.length > 30) {
    throw new Error("manifest.scenes must contain between 1 and 30 scenes");
  }

  const outputRaw = raw.output && typeof raw.output === "object" ? raw.output : {};
  const output = {
    width: evenInteger(outputRaw.width, 1080, "output.width", 320, 2160),
    height: evenInteger(outputRaw.height, 1920, "output.height", 320, 3840),
    fps: Math.round(finiteNumber(outputRaw.fps, 30, "output.fps", 24, 60)),
    crf: Math.round(finiteNumber(outputRaw.crf, 20, "output.crf", 14, 30)),
    preset: ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium"].includes(
      outputRaw.preset,
    )
      ? outputRaw.preset
      : "veryfast",
  };

  const scenes = raw.scenes.map((sceneRaw, index) => {
    if (!sceneRaw || typeof sceneRaw !== "object" || Array.isArray(sceneRaw)) {
      throw new Error(`scenes[${index}] must be an object`);
    }
    const kind = sceneRaw.kind;
    if (kind !== "video" && kind !== "image") {
      throw new Error(`scenes[${index}].kind must be video or image`);
    }
    const fit = sceneRaw.fit ?? "cover";
    const motion = sceneRaw.motion ?? "static";
    if (!FITS.has(fit)) throw new Error(`scenes[${index}].fit is unsupported`);
    if (!MOTIONS.has(motion)) throw new Error(`scenes[${index}].motion is unsupported`);
    if (kind === "video" && motion !== "static") {
      throw new Error(`scenes[${index}].motion is only supported for images`);
    }

    const transitionRaw =
      sceneRaw.transitionToNext && typeof sceneRaw.transitionToNext === "object"
        ? sceneRaw.transitionToNext
        : {};
    const transitionType = transitionRaw.type ?? "cut";
    if (!TRANSITIONS.has(transitionType)) {
      throw new Error(`scenes[${index}].transitionToNext.type is unsupported`);
    }

    const duration =
      sceneRaw.duration === undefined
        ? undefined
        : finiteNumber(sceneRaw.duration, undefined, `scenes[${index}].duration`, 0.25, 60);
    if (kind === "image" && duration === undefined) {
      throw new Error(`scenes[${index}].duration is required for images`);
    }

    return {
      source: source(sceneRaw.source, `scenes[${index}].source`),
      kind,
      duration,
      trimStart: finiteNumber(
        sceneRaw.trimStart,
        0,
        `scenes[${index}].trimStart`,
        0,
        3_600,
      ),
      fit,
      motion,
      background:
        typeof sceneRaw.background === "string" && /^#[0-9a-f]{6}$/i.test(sceneRaw.background)
          ? sceneRaw.background
          : "#000000",
      transitionToNext: {
        type: transitionType,
        duration:
          transitionType === "cut"
            ? 0
            : finiteNumber(
                transitionRaw.duration,
                0.25,
                `scenes[${index}].transitionToNext.duration`,
                0.05,
                1.5,
              ),
      },
    };
  });

  let logo;
  if (raw.logo !== undefined && raw.logo !== null) {
    if (typeof raw.logo !== "object" || Array.isArray(raw.logo)) {
      throw new Error("logo must be an object");
    }
    const position = raw.logo.position ?? "top-right";
    if (!POSITIONS.has(position)) throw new Error("logo.position is unsupported");
    logo = {
      source: source(raw.logo.source, "logo.source"),
      position,
      widthRatio: finiteNumber(raw.logo.widthRatio, 0.18, "logo.widthRatio", 0.05, 0.4),
      opacity: finiteNumber(raw.logo.opacity, 0.92, "logo.opacity", 0.05, 1),
      margin: Math.round(finiteNumber(raw.logo.margin, 48, "logo.margin", 0, 400)),
    };
  }

  const audioRaw = raw.audio && typeof raw.audio === "object" ? raw.audio : {};
  const voice = optionalTrack(audioRaw.voice, "audio.voice", { volume: 1, loop: false });
  const music = optionalTrack(audioRaw.music, "audio.music", { volume: 0.18, loop: true });

  return {
    version: 1,
    output,
    scenes,
    logo,
    audio: {
      voice,
      music,
      duckMusicUnderVoice: Boolean(audioRaw.duckMusicUnderVoice ?? true),
    },
  };
}

