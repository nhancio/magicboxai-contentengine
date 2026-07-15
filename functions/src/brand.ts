// Extract a brand profile (company name, industry, audience, tone) from a
// website URL using Gemini. The user enters only a URL; we fetch the page,
// distil the visible text, and ask the model to return structured JSON so the
// onboarding form can auto-fill.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getAI, requireAuth, stringifyError } from "./core";

type ExtractReq = { url: string };
type BrandFields = {
  companyName: string;
  industry: string;
  audience: string;
  tone: string;
};

// Reject non-http(s) and obvious internal/loopback hosts (basic SSRF guard —
// this runs server-side with the function's egress).
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
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
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
Return ONLY a JSON object with exactly these string keys: "companyName", "industry", "audience", "tone".
- companyName: the brand/company name.
- industry: a short phrase (e.g. "B2B SaaS", "DTC skincare", "3PL logistics").
- audience: who they sell to, in one concise sentence.
- tone: their brand voice in 3-6 words (e.g. "Confident, plain-spoken, no hype").
If a field is genuinely unknowable from the text, use an empty string. Do not invent facts.
No markdown, no commentary — JSON only.`;

function parseBrandJson(text: string): BrandFields {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as Partial<BrandFields>;
  const str = (v: unknown, max: number) => (v == null ? "" : String(v)).slice(0, max);
  return {
    companyName: str(parsed.companyName, 120),
    industry: str(parsed.industry, 120),
    audience: str(parsed.audience, 300),
    tone: str(parsed.tone, 200),
  };
}

export const extractBrandFromWebsite = onCall(
  { cors: true, timeoutSeconds: 60, memory: "512MiB" },
  async (request: CallableRequest<ExtractReq>): Promise<BrandFields> => {
    requireAuth(request);
    const url = normalizeUrl(request.data?.url ?? "");

    let html: string;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "MagicBoxBot/1.0 (+https://magicbox.ai)" },
      });
      clearTimeout(timer);
      if (!res.ok) throw new HttpsError("unavailable", `Could not load the site (${res.status}).`);
      const ct = res.headers.get("content-type") ?? "";
      if (ct && !/text\/html|application\/xhtml/i.test(ct)) {
        throw new HttpsError("invalid-argument", "That URL isn't a web page.");
      }
      html = (await res.text()).slice(0, 500_000);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("unavailable", `Could not reach that site: ${stringifyError(err)}`);
    }

    const text = htmlToText(html);
    const contentLen = text.replace(/^(TITLE|DESCRIPTION|CONTENT):/gm, "").trim().length;
    if (contentLen < 40) {
      throw new HttpsError("failed-precondition", "That page had too little text to analyze.");
    }

    try {
      const ai = getAI();
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-001",
        contents: text,
        config: { systemInstruction: SYSTEM },
      });
      return parseBrandJson(result.text ?? "");
    } catch (err) {
      throw new HttpsError("internal", `Could not analyze the site: ${stringifyError(err)}`);
    }
  }
);
