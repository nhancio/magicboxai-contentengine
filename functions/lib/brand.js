"use strict";
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBrandedPostImage = exports.extractBrandFromWebsite = void 0;
exports.findTags = findTags;
exports.collectLogoCandidates = collectLogoCandidates;
exports.pickDisplayLogo = pickDisplayLogo;
exports.pickBrandMark = pickBrandMark;
exports.collectWebsiteImages = collectWebsiteImages;
exports.extractStylesheetUrls = extractStylesheetUrls;
exports.colorsFromImageBuffer = colorsFromImageBuffer;
exports.colorsFromCss = colorsFromCss;
exports.buildPalette = buildPalette;
exports.extractFonts = extractFonts;
exports.parseBrandJson = parseBrandJson;
const https_1 = require("firebase-functions/v2/https");
const jimp_1 = require("jimp");
const promises_1 = require("node:dns/promises");
const node_net_1 = require("node:net");
const uuid_1 = require("uuid");
const core_1 = require("./core");
const models_1 = require("./models");
// ── URL safety ───────────────────────────────────────────────────────────────
// Every URL in this feature comes from an untrusted website. Validate the
// initial URL *and every redirect/linked asset* before the function performs a
// server-side request, otherwise this endpoint becomes an SSRF primitive.
function normalizeUrl(raw) {
    let candidate = (raw !== null && raw !== void 0 ? raw : "").trim();
    if (!candidate)
        throw new https_1.HttpsError("invalid-argument", "Enter a website URL.");
    if (!/^https?:\/\//i.test(candidate))
        candidate = `https://${candidate}`;
    let url;
    try {
        url = new URL(candidate);
    }
    catch (_a) {
        throw new https_1.HttpsError("invalid-argument", "That doesn't look like a valid URL.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new https_1.HttpsError("invalid-argument", "Only http(s) URLs are supported.");
    }
    if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) {
        throw new https_1.HttpsError("invalid-argument", "That URL is not allowed.");
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const blocked = host === "localhost" ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (blocked)
        throw new https_1.HttpsError("invalid-argument", "That host isn't reachable.");
    return url;
}
const BOT_HEADERS = { "User-Agent": "MagicBoxBot/1.0 (+https://magicboxai.in)" };
function isPrivateAddress(address) {
    const value = address.toLowerCase();
    if ((0, node_net_1.isIP)(value) === 4) {
        const octets = value.split(".").map(Number);
        return (octets[0] === 0 ||
            octets[0] === 10 ||
            octets[0] === 127 ||
            (octets[0] === 169 && octets[1] === 254) ||
            (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
            (octets[0] === 192 && octets[1] === 168) ||
            (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
            octets[0] >= 224);
    }
    if ((0, node_net_1.isIP)(value) !== 6)
        return true;
    if (value === "::" || value === "::1")
        return true;
    if (/^(fc|fd|fe[89ab])/.test(value))
        return true; // unique-local + link-local
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
}
async function assertPublicHost(url) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const directIp = (0, node_net_1.isIP)(host);
    if (directIp) {
        if (isPrivateAddress(host)) {
            throw new https_1.HttpsError("invalid-argument", "That host isn't reachable.");
        }
        return;
    }
    let addresses;
    try {
        addresses = await (0, promises_1.lookup)(host, { all: true, verbatim: true });
    }
    catch (_a) {
        throw new https_1.HttpsError("unavailable", "That host could not be resolved.");
    }
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new https_1.HttpsError("invalid-argument", "That host isn't reachable.");
    }
}
async function readLimitedBody(response, maxBytes) {
    var _a;
    const declaredLength = Number((_a = response.headers.get("content-length")) !== null && _a !== void 0 ? _a : 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new https_1.HttpsError("resource-exhausted", "The remote file is too large.");
    }
    if (!response.body)
        return Buffer.alloc(0);
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                throw new https_1.HttpsError("resource-exhausted", "The remote file is too large.");
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}
async function fetchPublicUrl(initialUrl, signal) {
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
        if (!location)
            throw new https_1.HttpsError("unavailable", "The site returned an invalid redirect.");
        current = normalizeUrl(new URL(location, current).toString());
    }
    throw new https_1.HttpsError("unavailable", "The site redirected too many times.");
}
async function fetchText(url, maxBytes, timeoutMs) {
    var _a;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const { response: res, finalUrl } = await fetchPublicUrl(url, controller.signal);
        if (!res.ok)
            throw new https_1.HttpsError("unavailable", `Could not load the site (${res.status}).`);
        const body = (await readLimitedBody(res, maxBytes)).toString("utf8");
        return { body, contentType: (_a = res.headers.get("content-type")) !== null && _a !== void 0 ? _a : "", finalUrl };
    }
    finally {
        clearTimeout(timer);
    }
}
async function fetchBinary(url, maxBytes, timeoutMs) {
    var _a;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const { response: res } = await fetchPublicUrl(url, controller.signal);
        if (!res.ok)
            return null;
        if (!/^image\/(?:avif|bmp|gif|jpeg|png|webp|x-icon)/i.test((_a = res.headers.get("content-type")) !== null && _a !== void 0 ? _a : "")) {
            return null;
        }
        return await readLimitedBody(res, maxBytes);
    }
    catch (_b) {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
// ── HTML helpers ─────────────────────────────────────────────────────────────
/** All opening tags of `tagName` in the document, as attribute maps. */
function findTags(html, tagName) {
    var _a, _b, _c;
    const tags = [];
    const re = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
    let m;
    while ((m = re.exec(html))) {
        const attrs = {};
        const attrRe = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
        let a;
        while ((a = attrRe.exec(m[1]))) {
            attrs[a[1].toLowerCase()] = ((_c = (_b = (_a = a[2]) !== null && _a !== void 0 ? _a : a[3]) !== null && _b !== void 0 ? _b : a[4]) !== null && _c !== void 0 ? _c : "").trim();
        }
        tags.push(attrs);
    }
    return tags;
}
function resolveHref(href, baseUrl) {
    if (!href || href.startsWith("data:") || href.startsWith("javascript:"))
        return "";
    try {
        const url = new URL(href, baseUrl);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
    }
    catch (_a) {
        return "";
    }
}
// ── Logo extraction ──────────────────────────────────────────────────────────
/** Every asset on the page that could be the brand mark, tagged by kind. */
function collectLogoCandidates(html, baseUrl) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const found = [];
    const seen = new Set();
    const order = {
        "logo-img": 0, "apple-touch-icon": 1, favicon: 2, social: 3,
    };
    const add = (href, kind) => {
        const url = resolveHref(href, baseUrl);
        if (!url)
            return;
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
    for (const link of findTags(html, "link")) {
        const rel = ((_a = link.rel) !== null && _a !== void 0 ? _a : "").toLowerCase();
        const href = ((_b = link.href) !== null && _b !== void 0 ? _b : "").toLowerCase();
        const isLogo = /logo|brand/i.test(href);
        if (rel.includes("apple-touch-icon"))
            add(link.href, isLogo ? "logo-img" : "apple-touch-icon");
        else if (rel.includes("icon"))
            add(link.href, isLogo ? "logo-img" : "favicon");
    }
    for (const meta of findTags(html, "meta")) {
        const key = (_d = (_c = meta.property) !== null && _c !== void 0 ? _c : meta.name) !== null && _d !== void 0 ? _d : "";
        if (["og:image", "og:image:secure_url", "twitter:image"].includes(key)) {
            add(meta.content, "social");
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
            filename = (_f = (_e = new URL(src, baseUrl).pathname.split("/").pop()) === null || _e === void 0 ? void 0 : _e.toLowerCase()) !== null && _f !== void 0 ? _f : "";
        }
        catch (_j) {
            filename = (_h = (_g = src.split("/").pop()) === null || _g === void 0 ? void 0 : _g.toLowerCase()) !== null && _h !== void 0 ? _h : "";
        }
        if (/logo|brand/.test(hint) || /logo|brand/.test(filename)) {
            add(src, "logo-img");
        }
    }
    return found;
}
/** Best asset to DISPLAY as the brand logo. */
function pickDisplayLogo(candidates) {
    var _a, _b;
    const order = {
        "logo-img": 0, "apple-touch-icon": 1, favicon: 2, social: 3,
    };
    return (_b = (_a = [...candidates].sort((a, b) => order[a.kind] - order[b.kind])[0]) === null || _a === void 0 ? void 0 : _a.url) !== null && _b !== void 0 ? _b : "";
}
/**
 * Best asset to SAMPLE COLORS from — the app icon is the most reliable brand
 * mark. og:image (and even logo-img) can be lifestyle photos that pollute the
 * palette, so square icons win.
 */
function pickBrandMark(candidates, baseUrl) {
    var _a;
    const order = {
        "apple-touch-icon": 0, "logo-img": 1, favicon: 2, social: 3,
    };
    const best = (_a = [...candidates].sort((a, b) => order[a.kind] - order[b.kind])[0]) === null || _a === void 0 ? void 0 : _a.url;
    return best !== null && best !== void 0 ? best : resolveHref("/favicon.ico", baseUrl);
}
/**
 * Find meaningful visual assets that can anchor a social creative. Decorative
 * icons, logos, tracking pixels and tiny thumbnails are deliberately excluded.
 */
function collectWebsiteImages(html, baseUrl) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const ranked = [];
    const seen = new Set();
    const add = (rawUrl, alt, kind, score) => {
        const url = resolveHref(rawUrl, baseUrl);
        if (!url ||
            seen.has(url) ||
            /\.(?:svg|ico)(?:$|[?#])/i.test(url) ||
            /(?:sprite|spacer|pixel|tracking|favicon|avatar)/i.test(url)) {
            return;
        }
        seen.add(url);
        ranked.push({ url, alt: alt.slice(0, 240), kind, score });
    };
    for (const meta of findTags(html, "meta")) {
        const key = ((_b = (_a = meta.property) !== null && _a !== void 0 ? _a : meta.name) !== null && _b !== void 0 ? _b : "").toLowerCase();
        if (["og:image", "og:image:secure_url", "twitter:image"].includes(key)) {
            add(meta.content, "Website social image", "social", 80);
        }
    }
    for (const img of findTags(html, "img")) {
        const src = img.src ||
            img["data-src"] ||
            img["data-lazy-src"] ||
            ((_e = ((_d = (_c = img.srcset) !== null && _c !== void 0 ? _c : img["data-srcset"]) !== null && _d !== void 0 ? _d : "").split(",").pop()) === null || _e === void 0 ? void 0 : _e.trim().split(/\s+/)[0]) ||
            "";
        const alt = ((_f = img.alt) !== null && _f !== void 0 ? _f : "").trim();
        const hints = [img.class, img.id, alt, src].filter(Boolean).join(" ").toLowerCase();
        if (/logo|brand[-_ ]?mark|icon|badge|flag|payment|rating|star/.test(hints))
            continue;
        const width = Number.parseInt((_g = img.width) !== null && _g !== void 0 ? _g : "0", 10) || 0;
        const height = Number.parseInt((_h = img.height) !== null && _h !== void 0 ? _h : "0", 10) || 0;
        if ((width && width < 280) || (height && height < 180))
            continue;
        const product = /product|packshot|catalog|merch|device|app[-_ ]?screen/.test(hints);
        const hero = /hero|banner|masthead|feature|showcase|cover/.test(hints);
        const screenshot = /screen|dashboard|interface|mockup|demo/.test(hints);
        const dimensionScore = Math.min(25, Math.floor((width * height) / 120000));
        const kind = product
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
        .map((_a) => {
        var { score: _score } = _a, image = __rest(_a, ["score"]);
        return image;
    });
}
function extractStylesheetUrls(html, baseUrl) {
    return findTags(html, "link")
        .filter((l) => { var _a; return /stylesheet/i.test((_a = l.rel) !== null && _a !== void 0 ? _a : ""); })
        .map((l) => resolveHref(l.href, baseUrl))
        .filter((u) => u && !/fonts\.googleapis\.com/i.test(u))
        .slice(0, 2);
}
// ── Color extraction ─────────────────────────────────────────────────────────
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const saturation = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
const rgbDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const toHex = (c) => `#${c.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
function parseHex(raw) {
    let h = raw.replace(/^#/, "").toLowerCase();
    if (h.length === 3)
        h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}$/.test(h))
        return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** Quantize a logo/icon image to its dominant colors (alpha flattened onto white). */
async function colorsFromImageBuffer(buf) {
    var _a;
    try {
        const img = await jimp_1.Jimp.fromBuffer(buf);
        const { data, width, height } = img.bitmap;
        const totalPx = width * height;
        if (!totalPx)
            return [];
        const step = Math.max(1, Math.floor(totalPx / 40000));
        const buckets = new Map();
        for (let p = 0; p < totalPx; p += step) {
            const i = p * 4;
            const a = data[i + 3] / 255;
            const r = Math.round(data[i] * a + 255 * (1 - a));
            const g = Math.round(data[i + 1] * a + 255 * (1 - a));
            const b = Math.round(data[i + 2] * a + 255 * (1 - a));
            const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
            const bucket = (_a = buckets.get(key)) !== null && _a !== void 0 ? _a : { sum: [0, 0, 0], count: 0 };
            bucket.sum[0] += r;
            bucket.sum[1] += g;
            bucket.sum[2] += b;
            bucket.count += 1;
            buckets.set(key, bucket);
        }
        return [...buckets.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
            .map(({ sum, count }) => [
            Math.round(sum[0] / count), Math.round(sum[1] / count), Math.round(sum[2] / count),
        ]);
    }
    catch (_b) {
        return []; // unsupported format (svg/ico) or corrupt image — CSS colors still apply
    }
}
/** Frequency-rank colors in markup + CSS; theme-color meta is weighted heavily. */
function colorsFromCss(html, css) {
    var _a;
    const counts = new Map();
    const add = (rgb, weight = 1) => {
        var _a;
        if (!rgb)
            return;
        const key = rgb.join(",");
        const entry = (_a = counts.get(key)) !== null && _a !== void 0 ? _a : { rgb, count: 0 };
        entry.count += weight;
        counts.set(key, entry);
    };
    const source = `${html}\n${css}`;
    const hexRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
    let m;
    while ((m = hexRe.exec(source)))
        add(parseHex(m[1]));
    const rgbRe = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;
    while ((m = rgbRe.exec(source))) {
        add([
            Math.min(255, parseInt(m[1], 10)),
            Math.min(255, parseInt(m[2], 10)),
            Math.min(255, parseInt(m[3], 10)),
        ]);
    }
    const themeColor = (_a = findTags(html, "meta").find((t) => { var _a; return ((_a = t.name) !== null && _a !== void 0 ? _a : "") === "theme-color"; })) === null || _a === void 0 ? void 0 : _a.content;
    if (themeColor)
        add(parseHex(themeColor.trim()), 50);
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
function buildPalette(imageColors, cssColors) {
    const distinct = [];
    for (const c of [...imageColors, ...cssColors]) {
        if (distinct.every((k) => rgbDist(c, k) > 42))
            distinct.push(c);
        if (distinct.length >= 12)
            break;
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
function extractFonts(html, css) {
    var _a;
    const found = [];
    const push = (name) => {
        const clean = name.replace(/["']/g, "").replace(/\+/g, " ").trim();
        if (!clean || clean.startsWith("var(") || GENERIC_FONTS.has(clean.toLowerCase()))
            return;
        if (!found.some((f) => f.toLowerCase() === clean.toLowerCase()))
            found.push(clean);
    };
    const gfRe = /fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi;
    let m;
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
        push((_a = m[1].split(",")[0]) !== null && _a !== void 0 ? _a : "");
        if (found.length >= 6)
            break;
    }
    return found.slice(0, 3);
}
// ── Text distillation + Gemini profile ───────────────────────────────────────
// Strip scripts/styles/tags → collapsed visible text, plus <title> and the
// meta description (dense signal for what the site is about).
function htmlToText(html) {
    const pick = (re) => { var _a, _b; return ((_b = (_a = html.match(re)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : "").trim(); };
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
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
function parseBrandJson(text) {
    const cleaned = text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    const parsed = JSON.parse(cleaned);
    const str = (v, max) => (v == null ? "" : String(v)).slice(0, max);
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
                segmentName: str(x === null || x === void 0 ? void 0 : x.segmentName, 100),
                percentage: typeof (x === null || x === void 0 ? void 0 : x.percentage) === 'number' ? x.percentage : 0
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
exports.extractBrandFromWebsite = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { timeoutSeconds: 60, memory: "512MiB" }), async (request) => {
    var _a, _b, _c, _d, _e;
    const uid = (0, core_1.requireAuth)(request);
    const url = normalizeUrl((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.url) !== null && _b !== void 0 ? _b : "");
    await (0, core_1.enforceCallableRateLimit)(uid, "brand-extraction", core_1.AI_RATE_LIMITS.brandExtraction);
    let html;
    let finalUrl;
    try {
        const page = await fetchText(url.toString(), 500000, 10000);
        if (page.contentType && !/text\/html|application\/xhtml/i.test(page.contentType)) {
            throw new https_1.HttpsError("invalid-argument", "That URL isn't a web page.");
        }
        html = page.body;
        finalUrl = page.finalUrl;
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError("unavailable", `Could not reach that site: ${(0, core_1.stringifyError)(err)}`);
    }
    const text = htmlToText(html);
    const contentLen = text.replace(/^(TITLE|DESCRIPTION|CONTENT):/gm, "").trim().length;
    if (contentLen < 40) {
        throw new https_1.HttpsError("failed-precondition", "That page had too little text to analyze.");
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
            await Promise.all(extractStylesheetUrls(html, finalUrl).map(async (sheetUrl) => {
                try {
                    const sheet = await fetchText(sheetUrl, 300000, 5000);
                    out += `\n${sheet.body}`;
                }
                catch (_a) {
                    /* stylesheet fetch is best-effort */
                }
            }));
            return out;
        })(),
        (async () => {
            if (!brandMarkUrl)
                return [];
            const buf = await fetchBinary(brandMarkUrl, 2000000, 6000);
            return buf ? colorsFromImageBuffer(buf) : [];
        })(),
        (async () => {
            var _a;
            try {
                const ai = (0, core_1.getAI)();
                const result = await ai.models.generateContent({
                    model: models_1.MODELS.text,
                    contents: text,
                    config: { systemInstruction: SYSTEM },
                });
                return parseBrandJson((_a = result.text) !== null && _a !== void 0 ? _a : "");
            }
            catch (err) {
                throw new https_1.HttpsError("internal", `Could not analyze the site: ${(0, core_1.stringifyError)(err)}`);
            }
        })(),
    ]);
    const colors = buildPalette(imageColors, colorsFromCss(html, css));
    const fonts = extractFonts(html, css);
    let brandedImageUrl = "";
    let brandedImageSource = "";
    try {
        let sourceBuffer = websiteImages[0]
            ? await fetchBinary(websiteImages[0].url, 6000000, 10000)
            : null;
        brandedImageSource = sourceBuffer ? "website" : "generated";
        if (!sourceBuffer) {
            await (0, core_1.enforceCallableRateLimit)(uid, "onboarding-branded-image", core_1.AI_RATE_LIMITS.imageGeneration);
            const ai = (0, core_1.getAI)();
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
            const bytes = (_e = (_d = (_c = response.generatedImages) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.image) === null || _e === void 0 ? void 0 : _e.imageBytes;
            if (bytes)
                sourceBuffer = Buffer.from(bytes, "base64");
        }
        if (sourceBuffer) {
            const logoBuffer = logoUrl ? await fetchBinary(logoUrl, 2000000, 8000) : null;
            const output = await createBrandedSquare(sourceBuffer, logoBuffer, colors);
            const storagePath = `users/${uid}/brand-creatives/${(0, uuid_1.v4)()}.png`;
            await (0, core_1.getBucket)().file(storagePath).save(output, {
                metadata: { contentType: "image/png", cacheControl: "private, max-age=31536000" },
            });
            brandedImageUrl = await (0, core_1.createDownloadUrl)(storagePath);
        }
    }
    catch (error) {
        console.warn("[brand] branded preview generation failed", (0, core_1.stringifyError)(error));
        brandedImageSource = "";
    }
    return Object.assign(Object.assign({}, profile), { logoUrl,
        websiteImages,
        brandedImageUrl,
        brandedImageSource,
        colors,
        fonts });
});
function safeHex(raw, fallback) {
    return /^#[0-9a-f]{6}$/i.test(raw !== null && raw !== void 0 ? raw : "") ? raw : fallback;
}
async function createBrandedSquare(sourceBuffer, logoBuffer, colors) {
    var _a;
    const canvas = await jimp_1.Jimp.fromBuffer(sourceBuffer);
    canvas.cover({ w: 1080, h: 1080 });
    const primary = safeHex(colors === null || colors === void 0 ? void 0 : colors.primary, "#7c3aed");
    const accent = safeHex(colors === null || colors === void 0 ? void 0 : colors.accent, (_a = colors === null || colors === void 0 ? void 0 : colors.secondary) !== null && _a !== void 0 ? _a : "#111827");
    const topRule = new jimp_1.Jimp({ width: 1080, height: 18, color: Number.parseInt(`${accent.slice(1)}ff`, 16) });
    const shade = new jimp_1.Jimp({ width: 1080, height: 250, color: Number.parseInt(`${primary.slice(1)}b8`, 16) });
    canvas.composite(topRule, 0, 0);
    canvas.composite(shade, 0, 830);
    if (logoBuffer) {
        try {
            const logo = await jimp_1.Jimp.fromBuffer(logoBuffer);
            logo.contain({ w: 164, h: 164 });
            const card = new jimp_1.Jimp({ width: 204, height: 204, color: 0xfffffff2 });
            card.composite(logo, 20, 20);
            canvas.composite(card, 56, 842);
        }
        catch (_b) {
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
exports.generateBrandedPostImage = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { invoker: "public", timeoutSeconds: 120, memory: "1GiB" }), async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const uid = (0, core_1.requireAuth)(request);
    const websiteUrl = normalizeUrl((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.websiteUrl) !== null && _b !== void 0 ? _b : "");
    const brandName = String((_d = (_c = request.data) === null || _c === void 0 ? void 0 : _c.brandName) !== null && _d !== void 0 ? _d : "").trim().slice(0, 120);
    if (!brandName)
        throw new https_1.HttpsError("invalid-argument", "Brand name is required.");
    await (0, core_1.enforceCallableRateLimit)(uid, "onboarding-branded-image", core_1.AI_RATE_LIMITS.imageGeneration);
    const page = await fetchText(websiteUrl.toString(), 500000, 10000);
    const websiteImages = collectWebsiteImages(page.body, page.finalUrl);
    const requestedAsset = ((_e = request.data) === null || _e === void 0 ? void 0 : _e.assetUrl)
        ? websiteImages.find((image) => image.url === request.data.assetUrl)
        : websiteImages[0];
    const logoUrl = pickDisplayLogo(collectLogoCandidates(page.body, page.finalUrl));
    let sourceBuffer = requestedAsset
        ? await fetchBinary(requestedAsset.url, 6000000, 10000)
        : null;
    let source = "website";
    if (!sourceBuffer) {
        source = "generated";
        const ai = (0, core_1.getAI)();
        const response = await ai.models.generateImages({
            model: "imagen-3.0-generate-001",
            prompt: [
                "Create a polished square social media photograph or editorial illustration.",
                `Brand: ${brandName}.`,
                ((_f = request.data) === null || _f === void 0 ? void 0 : _f.industry) ? `Industry: ${String(request.data.industry).slice(0, 160)}.` : "",
                ((_g = request.data) === null || _g === void 0 ? void 0 : _g.caption) ? `Post context: ${String(request.data.caption).slice(0, 500)}.` : "",
                "Show a specific, credible subject relevant to the business. No logos, no text, no generic gradient background.",
            ].filter(Boolean).join("\n"),
            config: { numberOfImages: 1, outputMimeType: "image/png", aspectRatio: "1:1" },
        });
        const bytes = (_k = (_j = (_h = response.generatedImages) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.image) === null || _k === void 0 ? void 0 : _k.imageBytes;
        if (!bytes)
            throw new https_1.HttpsError("internal", "No image was generated.");
        sourceBuffer = Buffer.from(bytes, "base64");
    }
    const logoBuffer = logoUrl ? await fetchBinary(logoUrl, 2000000, 8000) : null;
    const output = await createBrandedSquare(sourceBuffer, logoBuffer, (_l = request.data) === null || _l === void 0 ? void 0 : _l.colors);
    const storagePath = `users/${uid}/brand-creatives/${(0, uuid_1.v4)()}.png`;
    await (0, core_1.getBucket)().file(storagePath).save(output, {
        metadata: { contentType: "image/png", cacheControl: "private, max-age=31536000" },
    });
    return { imageUrl: await (0, core_1.createDownloadUrl)(storagePath), source };
});
//# sourceMappingURL=brand.js.map