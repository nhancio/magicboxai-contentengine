import { createHmac, timingSafeEqual } from "node:crypto";

export interface StandardWebhookHeaders {
  "webhook-id"?: string;
  "webhook-timestamp"?: string;
  "webhook-signature"?: string;
}

export type WebhookVerification =
  | { ok: true; webhookId: string; sentAtMs: number }
  | { ok: false; reason: "missing-header" | "bad-timestamp" | "stale" | "bad-signature" };

const DEFAULT_TOLERANCE_MS = 5 * 60_000;

function safeEqualBase64(actual: string, expected: string): boolean {
  try {
    const actualBytes = Buffer.from(actual, "base64");
    const expectedBytes = Buffer.from(expected, "base64");
    return (
      actualBytes.length === expectedBytes.length &&
      timingSafeEqual(actualBytes, expectedBytes)
    );
  } catch {
    return false;
  }
}

/** Verify Dodo's Standard Webhooks signature and reject replayed timestamps. */
export function verifyStandardWebhook(
  headers: StandardWebhookHeaders,
  rawBody: string,
  secretRaw: string,
  nowMs = Date.now(),
  toleranceMs = DEFAULT_TOLERANCE_MS
): WebhookVerification {
  const webhookId = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatureHeader = headers["webhook-signature"];
  if (!webhookId || !timestamp || !signatureHeader) {
    return { ok: false, reason: "missing-header" };
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return { ok: false, reason: "bad-timestamp" };
  const sentAtMs = timestampSeconds * 1000;
  if (Math.abs(nowMs - sentAtMs) > toleranceMs) return { ok: false, reason: "stale" };

  const encodedSecret = secretRaw.startsWith("whsec_") ? secretRaw.slice(6) : secretRaw;
  let secret: Buffer;
  try {
    secret = Buffer.from(encodedSecret, "base64");
  } catch {
    return { ok: false, reason: "bad-signature" };
  }
  if (!secret.length) return { ok: false, reason: "bad-signature" };

  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedContent).digest("base64");
  const valid = signatureHeader.split(" ").some((part) => {
    const versioned = part.split(",");
    const signature = versioned.length > 1 ? versioned[1] : versioned[0];
    return Boolean(signature && safeEqualBase64(signature, expected));
  });

  return valid
    ? { ok: true, webhookId, sentAtMs }
    : { ok: false, reason: "bad-signature" };
}

export function parseIsoTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
