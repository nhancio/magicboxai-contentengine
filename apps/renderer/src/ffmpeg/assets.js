import dns from "node:dns/promises";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { validateCompositionManifest } from "./manifest.js";

const ROLE_LIMITS = {
  video: 250 * 1024 * 1024,
  image: 20 * 1024 * 1024,
  logo: 20 * 1024 * 1024,
  voice: 100 * 1024 * 1024,
  music: 100 * 1024 * 1024,
};

const MIME_EXTENSIONS = new Map([
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/webm", ".webm"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["audio/mpeg", ".mp3"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["audio/mp4", ".m4a"],
  ["audio/aac", ".aac"],
  ["audio/ogg", ".ogg"],
]);

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateAddress(address) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return true;
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function hostAllowed(hostname, allowedHosts) {
  if (allowedHosts.length === 0) return true;
  return allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

async function assertPublicHttps(rawUrl, allowedHosts) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("remote assets must use credential-free HTTPS URLs on the default port");
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostAllowed(hostname, allowedHosts)) {
    throw new Error(`asset host is not allowlisted: ${hostname}`);
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error(`asset host resolves to a private or invalid address: ${hostname}`);
  }
  return url;
}

function expectedMime(role, contentType) {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (role === "video" && !mime.startsWith("video/")) throw new Error("video asset is not a video");
  if ((role === "image" || role === "logo") && !mime.startsWith("image/")) {
    throw new Error(`${role} asset is not an image`);
  }
  if ((role === "voice" || role === "music") && !mime.startsWith("audio/")) {
    throw new Error(`${role} asset is not audio`);
  }
  return { mime, extension: MIME_EXTENSIONS.get(mime) };
}

async function downloadAsset(rawUrl, destinationBase, role, allowedHosts) {
  let current = await assertPublicHttps(rawUrl, allowedHosts);
  for (let redirect = 0; redirect <= 3; redirect++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "MagicBoxMediaWorker/1.0" },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirect === 3) throw new Error("asset redirect limit exceeded");
        current = await assertPublicHttps(new URL(location, current).toString(), allowedHosts);
        continue;
      }
      if (!response.ok || !response.body) {
        throw new Error(`asset download failed with HTTP ${response.status}`);
      }

      const { extension } = expectedMime(role, response.headers.get("content-type") ?? "");
      if (!extension) throw new Error("asset content type is unsupported");
      const maxBytes = ROLE_LIMITS[role];
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) {
        throw new Error(`${role} asset exceeds ${Math.round(maxBytes / 1024 / 1024)} MB`);
      }

      const destination = `${destinationBase}${extension}`;
      let downloaded = 0;
      const limiter = new Transform({
        transform(chunk, _encoding, callback) {
          downloaded += chunk.length;
          if (downloaded > maxBytes) {
            callback(new Error(`${role} asset exceeded its download limit`));
            return;
          }
          callback(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(response.body),
        limiter,
        (await fs.open(destination, "wx")).createWriteStream(),
      );
      return destination;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("asset download failed");
}

/**
 * Download remote manifest assets into an isolated job directory. Every
 * redirect is revalidated to prevent SSRF and content is bounded by role.
 */
export async function materializeRemoteManifest(rawManifest, options) {
  const manifest = validateCompositionManifest(rawManifest);
  const workspace = path.resolve(options.workspace);
  await fs.mkdir(workspace, { recursive: true });
  const allowedHosts = (options.allowedHosts ?? [])
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  async function remote(source, baseName, role) {
    if (!/^https:\/\//i.test(source)) {
      throw new Error(`${role} source must be an HTTPS URL at the API boundary`);
    }
    return await downloadAsset(source, path.join(workspace, baseName), role, allowedHosts);
  }

  return {
    ...manifest,
    scenes: await Promise.all(
      manifest.scenes.map(async (scene, index) => ({
        ...scene,
        source: await remote(scene.source, `scene-${String(index).padStart(2, "0")}`, scene.kind),
      })),
    ),
    logo: manifest.logo
      ? { ...manifest.logo, source: await remote(manifest.logo.source, "logo", "logo") }
      : undefined,
    audio: {
      ...manifest.audio,
      voice: manifest.audio.voice
        ? {
            ...manifest.audio.voice,
            source: await remote(manifest.audio.voice.source, "voice", "voice"),
          }
        : undefined,
      music: manifest.audio.music
        ? {
            ...manifest.audio.music,
            source: await remote(manifest.audio.music.source, "music", "music"),
          }
        : undefined,
    },
  };
}
