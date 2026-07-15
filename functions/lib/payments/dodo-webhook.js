"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyStandardWebhook = verifyStandardWebhook;
exports.parseIsoTimestamp = parseIsoTimestamp;
const node_crypto_1 = require("node:crypto");
const DEFAULT_TOLERANCE_MS = 5 * 60000;
function safeEqualBase64(actual, expected) {
    try {
        const actualBytes = Buffer.from(actual, "base64");
        const expectedBytes = Buffer.from(expected, "base64");
        return (actualBytes.length === expectedBytes.length &&
            (0, node_crypto_1.timingSafeEqual)(actualBytes, expectedBytes));
    }
    catch (_a) {
        return false;
    }
}
/** Verify Dodo's Standard Webhooks signature and reject replayed timestamps. */
function verifyStandardWebhook(headers, rawBody, secretRaw, nowMs = Date.now(), toleranceMs = DEFAULT_TOLERANCE_MS) {
    const webhookId = headers["webhook-id"];
    const timestamp = headers["webhook-timestamp"];
    const signatureHeader = headers["webhook-signature"];
    if (!webhookId || !timestamp || !signatureHeader) {
        return { ok: false, reason: "missing-header" };
    }
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds))
        return { ok: false, reason: "bad-timestamp" };
    const sentAtMs = timestampSeconds * 1000;
    if (Math.abs(nowMs - sentAtMs) > toleranceMs)
        return { ok: false, reason: "stale" };
    const encodedSecret = secretRaw.startsWith("whsec_") ? secretRaw.slice(6) : secretRaw;
    let secret;
    try {
        secret = Buffer.from(encodedSecret, "base64");
    }
    catch (_a) {
        return { ok: false, reason: "bad-signature" };
    }
    if (!secret.length)
        return { ok: false, reason: "bad-signature" };
    const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
    const expected = (0, node_crypto_1.createHmac)("sha256", secret).update(signedContent).digest("base64");
    const valid = signatureHeader.split(" ").some((part) => {
        const versioned = part.split(",");
        const signature = versioned.length > 1 ? versioned[1] : versioned[0];
        return Boolean(signature && safeEqualBase64(signature, expected));
    });
    return valid
        ? { ok: true, webhookId, sentAtMs }
        : { ok: false, reason: "bad-signature" };
}
function parseIsoTimestamp(value) {
    if (typeof value !== "string")
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
//# sourceMappingURL=dodo-webhook.js.map