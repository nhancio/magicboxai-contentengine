"use strict";
// Thin client for Brevo (formerly Sendinblue) transactional email.
// When BREVO_API_KEY is not configured the client runs in dry-run mode:
// it logs and returns a deterministic fake instead of calling the API, so
// lifecycle emails never break sign-up or quota enforcement in local /
// emulator or unconfigured environments.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.brevoApiKey = void 0;
exports.sendOnboardingEmail = sendOnboardingEmail;
exports.sendUsageLimitEmail = sendUsageLimitEmail;
const params_1 = require("firebase-functions/params");
const logger = __importStar(require("firebase-functions/logger"));
exports.brevoApiKey = (0, params_1.defineSecret)("BREVO_API_KEY");
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const SENDER = { name: "MagicBox", email: "hello@magicboxai.in" };
const SUPPORT_EMAIL = "hello@magicboxai.in";
const APP_URL = "https://app.magicboxai.in";
const PRICING_URL = "https://app.magicboxai.in/pricing";
// --- Editorial brand palette ---
const INK = "#171614"; // near-black header band / headings
const OFF_WHITE = "#faf9f7"; // warm page background
const PURPLE = "#9333ea"; // CTA / accent
const PURPLE_TINT = "#f3e8ff"; // light purple callout fill
const BODY_TEXT = "#3d3a35";
const BORDER = "#ece8e1";
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Arial,Helvetica,sans-serif";
/** Resolve the Brevo API key from the bound secret, falling back to env. */
function resolveApiKey() {
    var _a;
    try {
        const fromSecret = exports.brevoApiKey.value();
        if (fromSecret)
            return fromSecret;
    }
    catch (_b) {
        // secret not bound in this context — fall through to env
    }
    return (_a = process.env.BREVO_API_KEY) !== null && _a !== void 0 ? _a : "";
}
/** Pull a friendly first name out of a full display name / email. */
function firstName(name, email) {
    var _a;
    const trimmed = (name !== null && name !== void 0 ? name : "").trim();
    if (trimmed)
        return trimmed.split(/\s+/)[0];
    const localPart = (_a = email.split("@")[0]) !== null && _a !== void 0 ? _a : "";
    const guess = localPart.split(/[._-]+/)[0];
    if (!guess)
        return "there";
    return guess.charAt(0).toUpperCase() + guess.slice(1);
}
/** Minimal HTML escaping for interpolated user-provided values. */
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
/**
 * Core transactional send. Dry-run fallback when no API key is configured:
 * logs and returns a deterministic fake WITHOUT throwing. On a live call a
 * non-2xx response throws; callers wrap the live path in try/catch so a
 * failed email can never break the user-facing flow.
 */
async function sendViaBrevo(args) {
    var _a;
    const apiKey = resolveApiKey();
    if (!apiKey) {
        logger.info("[brevo] dry-run: BREVO_API_KEY not set, skipping email", {
            to: args.email,
            subject: args.subject,
        });
        return { id: "dry-run", dryRun: true };
    }
    const response = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: {
            "api-key": apiKey,
            "Content-Type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender: SENDER,
            to: [{ email: args.email, name: args.toName }],
            subject: args.subject,
            htmlContent: args.html,
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Brevo send failed (${response.status}): ${text}`);
    }
    const data = (await response.json().catch(() => ({})));
    return { id: (_a = data.messageId) !== null && _a !== void 0 ? _a : "sent", dryRun: false };
}
// --- Shared, email-client-safe layout primitives -----------------------------
/** Purple CTA button (table-based for Outlook compatibility). */
function ctaButton(label, url) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="border-radius:10px; background-color:${PURPLE};">
<a href="${url}" target="_blank" style="display:inline-block; padding:14px 32px; font-family:${SANS}; font-size:16px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:10px;">${label}</a>
</td>
</tr>
</table>`;
}
/** Light-purple callout box with a left purple border. */
function calloutBox(innerHtml) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PURPLE_TINT}; border-left:4px solid ${PURPLE}; border-radius:8px;">
<tr>
<td style="padding:16px 20px; font-family:${SERIF}; font-size:16px; line-height:1.55; color:${INK};">${innerHtml}</td>
</tr>
</table>`;
}
/**
 * Full responsive HTML document: a dark near-black header band with a white
 * title over a white body card on the warm off-white page, plus footer.
 */
function renderShell(args) {
    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0; padding:0; width:100%; background-color:${OFF_WHITE};">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; font-size:1px; line-height:1px; color:${OFF_WHITE};">${escapeHtml(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${OFF_WHITE};">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background-color:#ffffff; border:1px solid ${BORDER}; border-radius:16px; overflow:hidden;">
<tr>
<td style="background-color:${INK}; padding:32px 40px;">
<img src="https://app.magicboxai.in/logo.png" width="44" height="44" alt="MagicBox" style="display:block; border-radius:10px; margin-bottom:16px;" />
<div style="font-family:${SERIF}; font-size:13px; letter-spacing:1.5px; text-transform:uppercase; color:${PURPLE}; font-weight:bold;">MagicBox</div>
<h1 style="margin:12px 0 0 0; font-family:${SERIF}; font-size:28px; line-height:1.25; color:#ffffff; font-weight:normal;">${escapeHtml(args.headerTitle)}</h1>
</td>
</tr>
<tr>
<td style="padding:36px 40px 40px 40px;">${args.bodyHtml}</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%;">
<tr>
<td align="center" style="padding:20px 40px;">
<p style="margin:0; font-family:${SANS}; font-size:12px; color:#b4afa5;">&copy; ${new Date().getFullYear()} MagicBox &middot; magicboxai.in</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}
/** Standard body paragraph. */
function p(html) {
    return `<p style="margin:0 0 18px 0; font-family:${SERIF}; font-size:17px; line-height:1.6; color:${BODY_TEXT};">${html}</p>`;
}
// --- Onboarding email ---------------------------------------------------------
function buildOnboardingHtml(name) {
    const steps = [
        ["Connect a channel", "Link Instagram, X, or LinkedIn in a couple of clicks."],
        ["Describe your brand & campaign", "Tell MagicBox who you are and what you want to say."],
        ["Approve, then let it autopilot", "Review the first drafts, then let MagicBox publish on schedule."],
    ]
        .map(([heading, detail], i) => `<tr>
<td valign="top" style="padding:0 14px 18px 0; width:34px;">
<div style="width:30px; height:30px; border-radius:50%; background-color:${PURPLE}; color:#ffffff; font-family:${SANS}; font-size:15px; font-weight:bold; text-align:center; line-height:30px;">${i + 1}</div>
</td>
<td valign="top" style="padding:0 0 18px 0;">
<div style="font-family:${SERIF}; font-size:17px; color:${INK}; font-weight:bold;">${escapeHtml(heading)}</div>
<div style="font-family:${SERIF}; font-size:15px; line-height:1.5; color:${BODY_TEXT};">${escapeHtml(detail)}</div>
</td>
</tr>`)
        .join("\n");
    const bodyHtml = `${p(`Hey ${escapeHtml(name)},`)}
${p("I'm thrilled you're here. We built MagicBox so that great social marketing no longer has to mean living inside a content calendar.")}
${p("In short: describe your brand once, and MagicBox turns a simple prompt into on-brand posts and images, then auto-publishes them to Instagram, X, and LinkedIn on the schedule you choose.")}
<p style="margin:0 0 14px 0; font-family:${SERIF}; font-size:18px; color:${INK}; font-weight:bold;">Get your first post live in 2 minutes</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
${steps}
</table>
${calloutBox("<strong>For the next 7 days, trial every feature free.</strong> Explore automations, AI images, scheduling, and multi-channel publishing with no limits.")}
<div style="height:24px; line-height:24px;">&nbsp;</div>
${p("When you're ready, choose a plan &mdash; <strong>Starter, Growth, or Scale</strong> &mdash; for unlimited posts, more channels, and analytics.")}
${ctaButton("Open MagicBox", APP_URL)}
<div style="height:28px; line-height:28px;">&nbsp;</div>
${p(`Questions? Just reply, or reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${PURPLE}; text-decoration:none;">${SUPPORT_EMAIL}</a>. A real human will help.`)}
<p style="margin:8px 0 0 0; font-family:${SERIF}; font-size:17px; line-height:1.6; color:${BODY_TEXT};">To your success,<br /><strong style="color:${INK};">The MagicBox team</strong></p>`;
    return renderShell({
        title: "Welcome to MagicBox",
        headerTitle: "Welcome to MagicBox ✨",
        preheader: "Get your first post live in 2 minutes. Connect a channel, describe your brand, and let MagicBox autopilot.",
        bodyHtml,
    });
}
/**
 * Send the onboarding / thank-you email via Brevo. Personalizes with the
 * user's first name and keeps the dry-run fallback.
 */
async function sendOnboardingEmail(args) {
    var _a;
    const given = firstName(args.name, args.email);
    return sendViaBrevo({
        email: args.email,
        toName: ((_a = args.name) === null || _a === void 0 ? void 0 : _a.trim()) || given,
        subject: "Welcome to MagicBox",
        html: buildOnboardingHtml(given),
    });
}
// --- Usage-limit / upgrade email ----------------------------------------------
function buildUsageLimitHtml(name, plan) {
    const prettyPlan = plan.charAt(0).toUpperCase() + plan.slice(1);
    const unlocks = [
        "Unlimited AI-generated posts",
        "More connected channels",
        "Content calendar & analytics",
        "Priority support",
        "Multiple brand workspaces (on Scale)",
    ]
        .map((item) => `<tr><td valign="top" style="padding:0 10px 10px 0; font-family:${SANS}; color:${PURPLE}; font-size:16px; line-height:1.5;">&bull;</td><td valign="top" style="padding:0 0 10px 0; font-family:${SERIF}; font-size:16px; line-height:1.5; color:${BODY_TEXT};">${escapeHtml(item)}</td></tr>`)
        .join("\n");
    const bodyHtml = `${p(`Hey ${escapeHtml(name)},`)}
${p(`You've reached the post/generation limit on your <strong style="color:${INK};">${escapeHtml(prettyPlan)}</strong> plan.`)}
${p("You're clearly shipping &mdash; let's keep the momentum going.")}
<p style="margin:0 0 14px 0; font-family:${SERIF}; font-size:18px; color:${INK}; font-weight:bold;">Upgrading unlocks</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
${unlocks}
</table>
${calloutBox("<strong>Plans start at just $39/month.</strong>")}
<div style="height:24px; line-height:24px;">&nbsp;</div>
${ctaButton("View plans", PRICING_URL)}
<div style="height:28px; line-height:28px;">&nbsp;</div>
<p style="margin:8px 0 0 0; font-family:${SERIF}; font-size:17px; line-height:1.6; color:${BODY_TEXT};">To your success,<br /><strong style="color:${INK};">The MagicBox team</strong></p>`;
    return renderShell({
        title: "Time to upgrade your MagicBox plan",
        headerTitle: "You've hit your plan limit — time to upgrade",
        preheader: "You're shipping fast. Upgrade to keep publishing without limits.",
        bodyHtml,
    });
}
/**
 * Send the usage-limit / upgrade nudge via Brevo. Keeps the dry-run fallback
 * and HTML-escapes the interpolated name and plan.
 */
async function sendUsageLimitEmail(args) {
    var _a;
    const given = firstName(args.name, args.email);
    return sendViaBrevo({
        email: args.email,
        toName: ((_a = args.name) === null || _a === void 0 ? void 0 : _a.trim()) || given,
        subject: "You've hit your plan limit — time to upgrade",
        html: buildUsageLimitHtml(given, args.plan),
    });
}
//# sourceMappingURL=brevo.js.map