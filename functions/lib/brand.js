"use strict";
// Extract a brand profile (company name, industry, audience, tone) from a
// website URL using Gemini. The user enters only a URL; we fetch the page,
// distil the visible text, and ask the model to return structured JSON so the
// onboarding form can auto-fill.
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBrandFromWebsite = void 0;
const https_1 = require("firebase-functions/v2/https");
const core_1 = require("./core");
// Reject non-http(s) and obvious internal/loopback hosts (basic SSRF guard —
// this runs server-side with the function's egress).
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
    const host = url.hostname.toLowerCase();
    const blocked = host === "localhost" ||
        host === "0.0.0.0" ||
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
Return ONLY a JSON object with exactly these string keys: "companyName", "industry", "audience", "tone".
- companyName: the brand/company name.
- industry: a short phrase (e.g. "B2B SaaS", "DTC skincare", "3PL logistics").
- audience: who they sell to, in one concise sentence.
- tone: their brand voice in 3-6 words (e.g. "Confident, plain-spoken, no hype").
If a field is genuinely unknowable from the text, use an empty string. Do not invent facts.
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
    };
}
exports.extractBrandFromWebsite = (0, https_1.onCall)({ cors: true, timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
    var _a, _b, _c, _d;
    (0, core_1.requireAuth)(request);
    const url = normalizeUrl((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.url) !== null && _b !== void 0 ? _b : "");
    let html;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url.toString(), {
            redirect: "follow",
            signal: controller.signal,
            headers: { "User-Agent": "MagicBoxBot/1.0 (+https://magicbox.ai)" },
        });
        clearTimeout(timer);
        if (!res.ok)
            throw new https_1.HttpsError("unavailable", `Could not load the site (${res.status}).`);
        const ct = (_c = res.headers.get("content-type")) !== null && _c !== void 0 ? _c : "";
        if (ct && !/text\/html|application\/xhtml/i.test(ct)) {
            throw new https_1.HttpsError("invalid-argument", "That URL isn't a web page.");
        }
        html = (await res.text()).slice(0, 500000);
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
    try {
        const ai = (0, core_1.getAI)();
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash-001",
            contents: text,
            config: { systemInstruction: SYSTEM },
        });
        return parseBrandJson((_d = result.text) !== null && _d !== void 0 ? _d : "");
    }
    catch (err) {
        throw new https_1.HttpsError("internal", `Could not analyze the site: ${(0, core_1.stringifyError)(err)}`);
    }
});
//# sourceMappingURL=brand.js.map