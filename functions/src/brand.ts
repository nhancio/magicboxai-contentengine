// Extract a full brand kit from a website URL. The user enters ONLY a URL; we
// fetch the page (and its main stylesheets), pull the logo, sample the brand
// mark's dominant colors, read the font stacks, and ask Gemini to infer the
// written profile (company name, industry, audience, tone, hashtags, sample
// captions) so the Brand Kit page can show a complete, editable preview
// before saving.
//
// Color approach ported from g3/super-app audit.py: the app icon / logo image
// is quantized for its dominant colors (the mark defines the brand), CSS hex
// frequency is the fallback signal, theme-color meta is weighted heavily, and
// near-duplicates are collapsed by RGB distance.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { Jimp } from "jimp";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { v4 as uuidv4 } from "uuid";
import {
  AI_RATE_LIMITS,
  callableSecurity,
  createDownloadUrl,
  enforceCallableRateLimit,
  getAI,
  getBucket,
  requireAuth,
  stringifyError,
} from "./core";
import { MODELS } from "./models";

type ExtractReq = { url: string };

export type BrandExtract = {
  companyName: string;
  industry: string;
  audience: string;
  tone: string;
  coreIdentity: string;
  productOffering: string;
  uniqueBenefits: string;
  problemSolution: string;
  mission: string;
  differentiation: string;
  ownedSpace: string;
  hashtags: string[];
  sampleCaptions: string[];
  contentAngles?: string[];
  toneDos?: string[];
  toneDonts?: string[];
  customerSegments?: Array<{ segmentName: string; percentage: number }>;
  competitors?: string[];
  logoUrl: string;
  websiteImages: WebsiteImage[];
  brandedImageUrl: string;
  brandedImageSource: "website" | "generated" | "";
  colors: { primary?: string; secondary?: string; accent?: string };
  fonts: string[];
};

export type RGB = [number, number, number];
type LogoCandidate = { url: string; kind: "logo-img" | "apple-touch-icon" | "favicon" | "social" };
export type WebsiteImage = {
  url: string;
  alt: string;
  kind: "product" | "hero" | "social" | "content";
};

// ── URL safety ───────────────────────────────────────────────────────────────

// Every URL in this feature comes from an untrusted website. Validate the
// initial URL *and every redirect/linked asset* before the function performs a
// server-side request, otherwise this endpoint becomes an SSRF primitive.
function normalizeUrl(raw: string): URL {
  let candidate = (raw ?? "").trim();
  if (!candidate) throw new HttpsError("invalid-argument", "Enter a website URL.");
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new HttpsError("invalid-argument", "That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "Only http(s) URLs are supported.");
  }
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) {
    throw new HttpsError("invalid-argument", "That URL is not allowed.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) throw new HttpsError("invalid-argument", "That host isn't reachable.");
  return url;
}

const BOT_HEADERS = { "User-Agent": "MagicBoxBot/1.0 (+https://magicboxai.in)" };

function isPrivateAddress(address: string): boolean {
  const value = address.toLowerCase();
  if (isIP(value) === 4) {
    const octets = value.split(".").map(Number);
    return (
      octets[0] === 0 ||
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      octets[0] >= 224
    );
  }
  if (isIP(value) !== 6) return true;
  if (value === "::" || value === "::1") return true;
  if (/^(fc|fd|fe[89ab])/.test(value)) return true; // unique-local + link-local
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateAddress(mapped[1]) : false;
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const directIp = isIP(host);
  if (directIp) {
    if (isPrivateAddress(host)) {
      throw new HttpsError("invalid-argument", "That host isn't reachable.");
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new HttpsError("unavailable", "That host could not be resolved.");
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new HttpsError("invalid-argument", "That host isn't reachable.");
  }
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpsError("resource-exhausted", "The remote file is too large.");
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new HttpsError("resource-exhausted", "The remote file is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function fetchPublicUrl(
  initialUrl: string,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: string }> {
  let current = normalizeUrl(initialUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    await assertPublicHost(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal,
      headers: BOT_HEADERS,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current.toString() };
    }
    const location = response.headers.get("location");
    if (!location) throw new HttpsError("unavailable", "The site returned an invalid redirect.");
    current = normalizeUrl(new URL(location, current).toString());
  }
  throw new HttpsError("unavailable", "The site redirected too many times.");
}

async function fetchText(url: string, maxBytes: number, timeoutMs: number): Promise<{ body: string; contentType: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { response: res, finalUrl } = await fetchPublicUrl(url, controller.signal);
    if (!res.ok) throw new HttpsError("unavailable", `Could not load the site (${res.status}).`);
    const body = (await readLimitedBody(res, maxBytes)).toString("utf8");
    return { body, contentType: res.headers.get("content-type") ?? "", finalUrl };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBinary(url: string, maxBytes: number, timeoutMs: number): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { response: res } = await fetchPublicUrl(url, controller.signal);
    if (!res.ok) return null;
    if (!/^image\/(?:avif|bmp|gif|jpeg|png|webp|x-icon)/i.test(res.headers.get("content-type") ?? "")) {
      return null;
    }
    return await readLimitedBody(res, maxBytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

/** All opening tags of `tagName` in the document, as attribute maps. */
export function findTags(html: string, tagName: string): Array<Record<string, string>> {
  const tags: Array<Record<string, string>> = [];
  const re = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs: Record<string, string> = {};
    const attrRe = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[1]))) {
      attrs[a[1].toLowerCase()] = (a[2] ?? a[3] ?? a[4] ?? "").trim();
    }
    tags.push(attrs);
  }
  return tags;
}

function resolveHref(href: string | undefined, baseUrl: string): string {
  if (!href || href.startsWith("data:") || href.startsWith("javascript:")) return "";
  try {
    const url = new URL(href, baseUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

// ── Logo extraction ──────────────────────────────────────────────────────────

/** Every asset on the page that could be the brand mark, tagged by kind. */
export function collectLogoCandidates(html: string, baseUrl: string): LogoCandidate[] {
  const found: LogoCandidate[] = [];
  const seen = new Set<string>();
  const order: Record<LogoCandidate["kind"], number> = {
    "logo-img": 0, "apple-touch-icon": 1, favicon: 2, social: 3,
  };
  const add = (href: string | undefined, kind: LogoCandidate["kind"]) => {
    const url = resolveHref(href, baseUrl);
    if (!url) return;
    const existing = found.find((c) => c.url === url);
    if (existing) {
      if (order[kind] < order[existing.kind]) {
        existing.kind = kind;
      }
      return;
    }
    seen.add(url);
    found.push({ url, kind });
  };

  // 1. Schema.org JSON-LD logos
  try {
    const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdBlocks) {
      for (const block of jsonLdBlocks) {
        const rawJson = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
        const parsed = JSON.parse(rawJson);
        const searchLd = (item: any) => {
          if (!item || typeof item !== "object") return;
          if (item.logo) {
            const l = typeof item.logo === "string" ? item.logo : item.logo?.url;
            if (typeof l === "string") add(l, "logo-img");
          }
          if (Array.isArray(item["@graph"])) {
            item["@graph"].forEach(searchLd);
          }
        };
        searchLd(parsed);
      }
    }
  } catch {}

  for (const link of findTags(html, "link")) {
    const rel = (link.rel ?? "").toLowerCase();
    const href = (link.href ?? "").toLowerCase();
    const isLogo = /logo|brand/i.test(href);
    if (rel.includes("apple-touch-icon")) add(link.href, isLogo ? "logo-img" : "apple-touch-icon");
    else if (rel.includes("icon")) add(link.href, isLogo ? "logo-img" : "favicon");
  }

  for (const meta of findTags(html, "meta")) {
    const key = meta.property ?? meta.name ?? "";
    if (["og:logo", "og:image", "og:image:secure_url", "twitter:image"].includes(key)) {
      add(meta.content, key === "og:logo" ? "logo-img" : "social");
    }
  }

  // <img> tags that look like a logo. Match on class/id/alt (reliable) or the
  // image *filename* — not the full CDN URL, whose hashes/paths cause false
  // positives (a lifestyle photo at /.../logoipsum-hero.jpg is not a logo).
  for (const img of findTags(html, "img")) {
    const hint = [img.class, img.id, img.alt].filter(Boolean).join(" ").toLowerCase();
    const src = img.src || img["data-src"] || "";
    let filename = "";
    try {
      filename = new URL(src, baseUrl).pathname.split("/").pop()?.toLowerCase() ?? "";
    } catch {
      filename = src.split("/").pop()?.toLowerCase() ?? "";
    }
    if (/logo|brand/.test(hint) || /logo|brand/.test(filename)) {
      add(src, "logo-img");
    }
  }

  return found;
}

/** Best asset to DISPLAY as the brand logo. */
export function pickDisplayLogo(candidates: LogoCandidate[], baseUrl?: string): string {
  const order: Record<LogoCandidate["kind"], number> = {
    "logo-img": 0, "apple-touch-icon": 1, favicon: 2, social: 3,
  };
  const best = [...candidates].sort((a, b) => order[a.kind] - order[b.kind])[0]?.url;
  if (best) return best;
  if (baseUrl) {
    try {
      const domain = new URL(baseUrl).hostname.replace(/^www\./, "");
      return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
    } catch {}
  }
  return "";
}

/**
 * Best asset to SAMPLE COLORS from — the app icon is the most reliable brand
 * mark. og:image (and even logo-img) can be lifestyle photos that pollute the
 * palette, so square icons win.
 */
export function pickBrandMark(candidates: LogoCandidate[], baseUrl: string): string {
  const order: Record<LogoCandidate["kind"], number> = {
    "apple-touch-icon": 0, "logo-img": 1, favicon: 2, social: 3,
  };
  const best = [...candidates].sort((a, b) => order[a.kind] - order[b.kind])[0]?.url;
  return best ?? resolveHref("/favicon.ico", baseUrl);
}

/**
 * Find meaningful visual assets that can anchor a social creative. Decorative
 * icons, logos, tracking pixels and tiny thumbnails are deliberately excluded.
 */
export function collectWebsiteImages(html: string, baseUrl: string): WebsiteImage[] {
  const ranked: Array<WebsiteImage & { score: number }> = [];
  const seen = new Set<string>();
  const add = (
    rawUrl: string | undefined,
    alt: string,
    kind: WebsiteImage["kind"],
    score: number,
  ) => {
    const url = resolveHref(rawUrl, baseUrl);
    if (
      !url ||
      seen.has(url) ||
      /\.(?:svg|ico)(?:$|[?#])/i.test(url) ||
      /(?:sprite|spacer|pixel|tracking|favicon|avatar)/i.test(url)
    ) {
      return;
    }
    seen.add(url);
    ranked.push({ url, alt: alt.slice(0, 240), kind, score });
  };

  for (const meta of findTags(html, "meta")) {
    const key = (meta.property ?? meta.name ?? "").toLowerCase();
    if (["og:image", "og:image:secure_url", "twitter:image"].includes(key)) {
      add(meta.content, "Website social image", "social", 80);
    }
  }

  for (const img of findTags(html, "img")) {
    const src =
      img.src ||
      img["data-src"] ||
      img["data-lazy-src"] ||
      (img.srcset ?? img["data-srcset"] ?? "").split(",").pop()?.trim().split(/\s+/)[0] ||
      "";
    const alt = (img.alt ?? "").trim();
    const hints = [img.class, img.id, alt, src].filter(Boolean).join(" ").toLowerCase();
    if (/logo|brand[-_ ]?mark|icon|badge|flag|payment|rating|star/.test(hints)) continue;

    const width = Number.parseInt(img.width ?? "0", 10) || 0;
    const height = Number.parseInt(img.height ?? "0", 10) || 0;
    if ((width && width < 280) || (height && height < 180)) continue;

    const product = /product|packshot|catalog|merch|device|app[-_ ]?screen/.test(hints);
    const hero = /hero|banner|masthead|feature|showcase|cover/.test(hints);
    const screenshot = /screen|dashboard|interface|mockup|demo/.test(hints);
    const dimensionScore = Math.min(25, Math.floor((width * height) / 120_000));
    const kind: WebsiteImage["kind"] = product
      ? "product"
      : hero
        ? "hero"
        : screenshot
          ? "content"
          : "content";
    const score = (product ? 105 : hero ? 95 : screenshot ? 90 : 45) + dimensionScore + (alt ? 5 : 0);
    add(src, alt || (product ? "Product image" : hero ? "Hero image" : "Website image"), kind, score);
  }

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ score: _score, ...image }) => image);
}

export function extractStylesheetUrls(html: string, baseUrl: string): string[] {
  return findTags(html, "link")
    .filter((l) => /stylesheet/i.test(l.rel ?? ""))
    .map((l) => resolveHref(l.href, baseUrl))
    .filter((u) => u && !/fonts\.googleapis\.com/i.test(u))
    .slice(0, 2);
}

// ── Color extraction ─────────────────────────────────────────────────────────

const luminance = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const saturation = ([r, g, b]: RGB) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
const rgbDist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const toHex = (c: RGB) => `#${c.map((n) => n.toString(16).padStart(2, "0")).join("")}`;

function parseHex(raw: string): RGB | null {
  let h = raw.replace(/^#/, "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Quantize a logo/icon image to its dominant colors (alpha flattened onto white). */
export async function colorsFromImageBuffer(buf: Buffer): Promise<RGB[]> {
  try {
    const img = await Jimp.fromBuffer(buf);
    const { data, width, height } = img.bitmap;
    const totalPx = width * height;
    if (!totalPx) return [];
    const step = Math.max(1, Math.floor(totalPx / 40_000));
    const buckets = new Map<number, { sum: [number, number, number]; count: number }>();
    for (let p = 0; p < totalPx; p += step) {
      const i = p * 4;
      const a = data[i + 3] / 255;
      const r = Math.round(data[i] * a + 255 * (1 - a));
      const g = Math.round(data[i + 1] * a + 255 * (1 - a));
      const b = Math.round(data[i + 2] * a + 255 * (1 - a));
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { sum: [0, 0, 0], count: 0 };
      bucket.sum[0] += r; bucket.sum[1] += g; bucket.sum[2] += b; bucket.count += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(({ sum, count }): RGB => [
        Math.round(sum[0] / count), Math.round(sum[1] / count), Math.round(sum[2] / count),
      ]);
  } catch {
    return []; // unsupported format (svg/ico) or corrupt image — CSS colors still apply
  }
}

/** Frequency-rank colors in markup + CSS; theme-color meta is weighted heavily. */
export function colorsFromCss(html: string, css: string): RGB[] {
  const counts = new Map<string, { rgb: RGB; count: number }>();
  const add = (rgb: RGB | null, weight = 1) => {
    if (!rgb) return;
    const key = rgb.join(",");
    const entry = counts.get(key) ?? { rgb, count: 0 };
    entry.count += weight;
    counts.set(key, entry);
  };

  const source = `${html}\n${css}`;
  const hexRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(source))) add(parseHex(m[1]));
  const rgbRe = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;
  while ((m = rgbRe.exec(source))) {
    add([
      Math.min(255, parseInt(m[1], 10)),
      Math.min(255, parseInt(m[2], 10)),
      Math.min(255, parseInt(m[3], 10)),
    ]);
  }

  const themeColor = findTags(html, "meta").find((t) => (t.name ?? "") === "theme-color")?.content;
  if (themeColor) add(parseHex(themeColor.trim()), 50);

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)
    .map((e) => e.rgb);
}

/**
 * Merge image colors (first — the mark defines the brand) with CSS colors,
 * collapse near-duplicates, and fill primary/secondary/accent with colorful
 * picks, falling back to any non-white/non-black shade.
 */
export function buildPalette(imageColors: RGB[], cssColors: RGB[]): { primary?: string; secondary?: string; accent?: string } {
  const distinct: RGB[] = [];
  for (const c of [...imageColors, ...cssColors]) {
    if (distinct.every((k) => rgbDist(c, k) > 42)) distinct.push(c);
    if (distinct.length >= 12) break;
  }

  const colorful = distinct.filter((c) => saturation(c) >= 0.12 && luminance(c) > 0.06 && luminance(c) < 0.92);
  const usable = colorful.length ? colorful : distinct.filter((c) => luminance(c) > 0.04 && luminance(c) < 0.96);

  return {
    primary: usable[0] ? toHex(usable[0]) : undefined,
    secondary: usable[1] ? toHex(usable[1]) : undefined,
    accent: usable[2] ? toHex(usable[2]) : undefined,
  };
}

// ── Font extraction ──────────────────────────────────────────────────────────

const GENERIC_FONTS = new Set([
  "sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui",
  "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "inherit",
  "initial", "unset", "-apple-system", "blinkmacsystemfont", "segoe ui",
  "segoe ui emoji", "segoe ui symbol", "noto color emoji", "apple color emoji",
  "arial", "helvetica", "helvetica neue", "times new roman", "emoji",
]);

/** Font families: Google Fonts URLs first (highest confidence), then declared font-family stacks. */
export function extractFonts(html: string, css: string): string[] {
  const found: string[] = [];
  const push = (name: string) => {
    const clean = name.replace(/["']/g, "").replace(/\+/g, " ").trim();
    if (!clean || clean.startsWith("var(") || GENERIC_FONTS.has(clean.toLowerCase())) return;
    if (!found.some((f) => f.toLowerCase() === clean.toLowerCase())) found.push(clean);
  };

  const gfRe = /fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = gfRe.exec(html))) {
    for (const param of m[1].split("&")) {
      if (param.startsWith("family=")) {
        push(decodeURIComponent(param.slice(7).split(":")[0]));
      }
    }
  }

  const famRe = /font-family\s*:\s*([^;}{"]+)/gi;
  const source = `${html}\n${css}`;
  while ((m = famRe.exec(source))) {
    push(m[1].split(",")[0] ?? "");
    if (found.length >= 6) break;
  }

  return found.slice(0, 3);
}

// ── Text distillation + Gemini profile ───────────────────────────────────────

// Strip scripts/styles/tags → collapsed visible text, plus <title> and the
// meta description (dense signal for what the site is about).
function htmlToText(html: string): string {
  const pick = (re: RegExp) => (html.match(re)?.[1] ?? "").trim();
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [
    title && `TITLE: ${title}`,
    description && `DESCRIPTION: ${description}`,
    `CONTENT: ${body}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

const SYSTEM = `You are a brand analyst. Given the text content of a company's website, infer its brand profile.
Return ONLY a JSON object with exactly these keys:
- "companyName": string — the brand/company name.
- "industry": string — a short phrase (e.g. "B2B SaaS", "DTC skincare", "3PL logistics").
- "audience": string — who they sell to, in one concise sentence.
- "tone": string — their brand voice in 3-6 words (e.g. "Confident, plain-spoken, no hype").
- "coreIdentity": string — what the company essentially is and does.
- "productOffering": string — the main products or services they offer.
- "uniqueBenefits": string — the key benefits that their products provide.
- "problemSolution": string — the problem they solve for their customers.
- "mission": string — the overarching goal or mission of the brand.
- "differentiation": string — how they distinguish themselves from competitors.
- "ownedSpace": string — the unique category or space they own in the market.
- "contentAngles": array of exactly 3 concise content pillar titles
- "toneDos": array of up to 5 concise tone Do's
- "toneDonts": array of up to 5 concise tone Don'ts
- "customerSegments": array of objects with "segmentName" (string) and "percentage" (number, total 100)
- "competitors": array of string competitor names
- "hashtags": array of 5-8 lowercase hashtag words WITHOUT the # (e.g. ["supplychain","manufacturing"]), relevant to their industry and audience.
- "sampleCaptions": array of exactly 2 short social captions (max 140 chars each) written in the brand's voice about what they do.
If a field is genuinely unknowable from the text, use an empty string or empty array. Do not invent facts.
No markdown, no commentary — JSON only.`;

type GeminiProfile = Pick<BrandExtract, "companyName" | "industry" | "audience" | "tone" | "hashtags" | "sampleCaptions" | "coreIdentity" | "productOffering" | "uniqueBenefits" | "problemSolution" | "mission" | "differentiation" | "ownedSpace" | "contentAngles" | "toneDos" | "toneDonts" | "customerSegments" | "competitors">;

export function parseBrandJson(text: string): GeminiProfile {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as Partial<Record<keyof GeminiProfile, unknown>>;
  const str = (v: unknown, max: number) => (v == null ? "" : String(v)).slice(0, max);
  return {
    companyName: str(parsed.companyName, 120),
    industry: str(parsed.industry, 120),
    audience: str(parsed.audience, 300),
    tone: str(parsed.tone, 200),
    coreIdentity: str(parsed.coreIdentity, 500),
    productOffering: str(parsed.productOffering, 500),
    uniqueBenefits: str(parsed.uniqueBenefits, 500),
    problemSolution: str(parsed.problemSolution, 500),
    mission: str(parsed.mission, 500),
    differentiation: str(parsed.differentiation, 500),
    ownedSpace: str(parsed.ownedSpace, 500),
    contentAngles: Array.isArray(parsed.contentAngles) ? parsed.contentAngles.map(x => str(x, 100)) : [],
    toneDos: Array.isArray(parsed.toneDos) ? parsed.toneDos.map(x => str(x, 100)) : [],
    toneDonts: Array.isArray(parsed.toneDonts) ? parsed.toneDonts.map(x => str(x, 100)) : [],
    customerSegments: Array.isArray(parsed.customerSegments) 
      ? parsed.customerSegments.map(x => ({ 
          segmentName: str(x?.segmentName, 100), 
          percentage: typeof x?.percentage === 'number' ? x.percentage : 0 
        }))
      : [],
    competitors: Array.isArray(parsed.competitors) ? parsed.competitors.map(x => str(x, 100)) : [],
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.slice(0, 8).map((x) => str(x, 40).replace(/^#/, "")).filter(Boolean)
      : [],
    sampleCaptions: Array.isArray(parsed.sampleCaptions)
      ? parsed.sampleCaptions.slice(0, 2).map((x) => str(x, 200)).filter(Boolean)
      : [],
  };
}

export const extractBrandFromWebsite = onCall(
  { ...callableSecurity, timeoutSeconds: 60, memory: "512MiB" },
  async (request: CallableRequest<ExtractReq>): Promise<BrandExtract> => {
    const uid = requireAuth(request);
    const url = normalizeUrl(request.data?.url ?? "");
    await enforceCallableRateLimit(uid, "brand-extraction", AI_RATE_LIMITS.brandExtraction);

    let html: string;
    let finalUrl: string;
    try {
      const page = await fetchText(url.toString(), 500_000, 10_000);
      if (page.contentType && !/text\/html|application\/xhtml/i.test(page.contentType)) {
        throw new HttpsError("invalid-argument", "That URL isn't a web page.");
      }
      html = page.body;
      finalUrl = page.finalUrl;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("unavailable", `Could not reach that site: ${stringifyError(err)}`);
    }

    const text = htmlToText(html);
    const contentLen = text.replace(/^(TITLE|DESCRIPTION|CONTENT):/gm, "").trim().length;
    if (contentLen < 40) {
      throw new HttpsError("failed-precondition", "That page had too little text to analyze.");
    }

    const logoCandidates = collectLogoCandidates(html, finalUrl);
    const logoUrl = pickDisplayLogo(logoCandidates);
    const brandMarkUrl = pickBrandMark(logoCandidates, finalUrl);
    const websiteImages = collectWebsiteImages(html, finalUrl);

    // Visual identity + written profile in parallel: stylesheets (colors and
    // fonts live there), the brand mark's pixels, and Gemini's read of the
    // page text. Visual failures are non-fatal.
    const [css, imageColors, profile] = await Promise.all([
      (async () => {
        let out = "";
        await Promise.all(
          extractStylesheetUrls(html, finalUrl).map(async (sheetUrl) => {
            try {
              const sheet = await fetchText(sheetUrl, 300_000, 5_000);
              out += `\n${sheet.body}`;
            } catch {
              /* stylesheet fetch is best-effort */
            }
          })
        );
        return out;
      })(),
      (async () => {
        if (!brandMarkUrl) return [] as RGB[];
        const buf = await fetchBinary(brandMarkUrl, 2_000_000, 6_000);
        return buf ? colorsFromImageBuffer(buf) : [];
      })(),
      (async () => {
        try {
          const ai = getAI();
          const result = await ai.models.generateContent({
            model: MODELS.text,
            contents: text,
            config: { systemInstruction: SYSTEM },
          });
          return parseBrandJson(result.text ?? "");
        } catch (err) {
          throw new HttpsError("internal", `Could not analyze the site: ${stringifyError(err)}`);
        }
      })(),
    ]);

    const colors = buildPalette(imageColors, colorsFromCss(html, css));
    const fonts = extractFonts(html, css);

    let brandedImageUrl = "";
    let brandedImageSource: BrandExtract["brandedImageSource"] = "";
    try {
      let sourceBuffer = websiteImages[0]
        ? await fetchBinary(websiteImages[0].url, 6_000_000, 10_000)
        : null;
      brandedImageSource = sourceBuffer ? "website" : "generated";
      if (!sourceBuffer) {
        await enforceCallableRateLimit(uid, "onboarding-branded-image", AI_RATE_LIMITS.imageGeneration);
        const ai = getAI();
        const response = await ai.models.generateImages({
          model: "imagen-3.0-generate-001",
          prompt: [
            "Create a polished square social media photograph or editorial illustration.",
            `Brand: ${profile.companyName || new URL(finalUrl).hostname}.`,
            profile.industry ? `Industry: ${profile.industry}.` : "",
            profile.sampleCaptions[0] ? `Post context: ${profile.sampleCaptions[0]}.` : "",
            "Show a specific, credible subject relevant to the business. No logos, no text, no generic gradient background.",
          ].filter(Boolean).join("\n"),
          config: { numberOfImages: 1, outputMimeType: "image/png", aspectRatio: "1:1" },
        });
        const bytes = response.generatedImages?.[0]?.image?.imageBytes;
        if (bytes) sourceBuffer = Buffer.from(bytes, "base64");
      }
      if (sourceBuffer) {
        const logoBuffer = logoUrl ? await fetchBinary(logoUrl, 2_000_000, 8_000) : null;
        const output = await createBrandedSquare(sourceBuffer, logoBuffer, colors);
        const storagePath = `users/${uid}/brand-creatives/${uuidv4()}.png`;
        await getBucket().file(storagePath).save(output, {
          metadata: { contentType: "image/png", cacheControl: "private, max-age=31536000" },
        });
        brandedImageUrl = await createDownloadUrl(storagePath);
      }
    } catch (error) {
      console.warn("[brand] branded preview generation failed", stringifyError(error));
      brandedImageSource = "";
    }

    return {
      ...profile,
      logoUrl,
      websiteImages,
      brandedImageUrl,
      brandedImageSource,
      colors,
      fonts,
    };
  }
);

type BrandedImageReq = {
  websiteUrl: string;
  assetUrl?: string;
  brandName: string;
  industry?: string;
  caption?: string;
  colors?: { primary?: string; secondary?: string; accent?: string };
};

function safeHex(raw: string | undefined, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(raw ?? "") ? raw! : fallback;
}

async function createBrandedSquare(
  sourceBuffer: Buffer,
  logoBuffer: Buffer | null,
  colors: BrandedImageReq["colors"],
): Promise<Buffer> {
  const canvas = await Jimp.fromBuffer(sourceBuffer);
  canvas.cover({ w: 1080, h: 1080 });

  const primary = safeHex(colors?.primary, "#7c3aed");
  const accent = safeHex(colors?.accent, colors?.secondary ?? "#111827");
  const topRule = new Jimp({ width: 1080, height: 18, color: Number.parseInt(`${accent.slice(1)}ff`, 16) });
  const shade = new Jimp({ width: 1080, height: 250, color: Number.parseInt(`${primary.slice(1)}b8`, 16) });
  canvas.composite(topRule, 0, 0);
  canvas.composite(shade, 0, 830);

  if (logoBuffer) {
    try {
      const logo = await Jimp.fromBuffer(logoBuffer);
      logo.contain({ w: 164, h: 164 });
      const card = new Jimp({ width: 204, height: 204, color: 0xfffffff2 });
      card.composite(logo, 20, 20);
      canvas.composite(card, 56, 842);
    } catch {
      // A malformed/unsupported logo must not discard an otherwise good creative.
    }
  }

  return canvas.getBuffer("image/png");
}

/**
 * Turn a fetched product/hero image into publishable branded media. The asset
 * must still exist on the supplied website, preventing callers from using this
 * server-side fetch as an arbitrary URL proxy.
 */
export const generateBrandedPostImage = onCall(
  { ...callableSecurity, invoker: "public", timeoutSeconds: 120, memory: "1GiB" },
  async (request: CallableRequest<BrandedImageReq>): Promise<{ imageUrl: string; source: "website" | "generated" }> => {
    const uid = requireAuth(request);
    const websiteUrl = normalizeUrl(request.data?.websiteUrl ?? "");
    const brandName = String(request.data?.brandName ?? "").trim().slice(0, 120);
    if (!brandName) throw new HttpsError("invalid-argument", "Brand name is required.");
    await enforceCallableRateLimit(uid, "onboarding-branded-image", AI_RATE_LIMITS.imageGeneration);

    const page = await fetchText(websiteUrl.toString(), 500_000, 10_000);
    const websiteImages = collectWebsiteImages(page.body, page.finalUrl);
    const requestedAsset = request.data?.assetUrl
      ? websiteImages.find((image) => image.url === request.data.assetUrl)
      : websiteImages[0];
    const logoUrl = pickDisplayLogo(collectLogoCandidates(page.body, page.finalUrl));

    let sourceBuffer = requestedAsset
      ? await fetchBinary(requestedAsset.url, 6_000_000, 10_000)
      : null;
    let source: "website" | "generated" = "website";

    if (!sourceBuffer) {
      source = "generated";
      const ai = getAI();
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-001",
        prompt: [
          "Create a polished square social media photograph or editorial illustration.",
          `Brand: ${brandName}.`,
          request.data?.industry ? `Industry: ${String(request.data.industry).slice(0, 160)}.` : "",
          request.data?.caption ? `Post context: ${String(request.data.caption).slice(0, 500)}.` : "",
          "Show a specific, credible subject relevant to the business. No logos, no text, no generic gradient background.",
        ].filter(Boolean).join("\n"),
        config: { numberOfImages: 1, outputMimeType: "image/png", aspectRatio: "1:1" },
      });
      const bytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (!bytes) throw new HttpsError("internal", "No image was generated.");
      sourceBuffer = Buffer.from(bytes, "base64");
    }

    const logoBuffer = logoUrl ? await fetchBinary(logoUrl, 2_000_000, 8_000) : null;
    const output = await createBrandedSquare(sourceBuffer, logoBuffer, request.data?.colors);
    const storagePath = `users/${uid}/brand-creatives/${uuidv4()}.png`;
    await getBucket().file(storagePath).save(output, {
      metadata: { contentType: "image/png", cacheControl: "private, max-age=31536000" },
    });
    return { imageUrl: await createDownloadUrl(storagePath), source };
  },
);
