// Dodo Payments integration: authenticated hosted checkout, durable webhook
// entitlement updates, and authenticated customer-portal sessions.

import { onCall, HttpsError, onRequest, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { db, requireAuth, PLAN_VIDEO_LIMIT, type PlanId } from "./core";
import {
  parseIsoTimestamp,
  verifyStandardWebhook,
  type StandardWebhookHeaders,
} from "./payments/dodo-webhook";

const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

export const dodoApiKey = defineSecret("DODO_API_KEY");
export const dodoWebhookSecret = defineSecret("DODO_WEBHOOK_SECRET");

type Billing = "monthly" | "annual";

interface ProductMapping {
  productId: string;
  plan: PlanId;
  billing: Billing;
}

interface DodoSubscriptionData {
  payload_type?: string;
  metadata?: Record<string, unknown>;
  customer?: { customer_id?: string; email?: string };
  subscription_id?: string;
  payment_id?: string;
  product_id?: string;
  next_billing_date?: string;
  status?: string;
}

interface DodoEvent {
  business_id?: string;
  type?: string;
  timestamp?: string;
  data?: DodoSubscriptionData;
}

const APP_BASE_URL = process.env.APP_BASE_URL || "https://app.magicboxai.in";
const LANDING_BASE_URL = process.env.LANDING_BASE_URL || "https://magicboxai.in";

function dodoApiBase(): string {
  return process.env.DODO_MODE === "live"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

function secretValue(secret: ReturnType<typeof defineSecret>, envName: string): string {
  try {
    const value = secret.value();
    if (value) return value;
  } catch {
    // Local tests/builds can fall back to an ignored .env file.
  }
  return process.env[envName] ?? "";
}

function requireApiKey(): string {
  const value = secretValue(dodoApiKey, "DODO_API_KEY");
  if (!value) throw new Error("DODO_API_KEY is not configured");
  return value;
}

function configuredProducts(): ProductMapping[] {
  return [
    { productId: process.env.DODO_PRODUCT_PRO_MONTHLY, plan: "pro", billing: "monthly" },
    { productId: process.env.DODO_PRODUCT_PRO_ANNUAL, plan: "pro", billing: "annual" },
    { productId: process.env.DODO_PRODUCT_MAX_MONTHLY, plan: "max", billing: "monthly" },
    { productId: process.env.DODO_PRODUCT_MAX_ANNUAL, plan: "max", billing: "annual" },
  ].filter((entry): entry is ProductMapping => Boolean(entry.productId));
}

function productFor(plan: PlanId, billing: Billing): ProductMapping {
  const match = configuredProducts().find(
    (entry) => entry.plan === plan && entry.billing === billing
  );
  if (!match) throw new Error(`Dodo product is not configured for ${plan}/${billing}`);
  return match;
}

function productById(productId: string | undefined): ProductMapping | null {
  if (!productId) return null;
  return configuredProducts().find((entry) => entry.productId === productId) ?? null;
}

async function dodoRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${dodoApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    logger.error("[dodo] provider request failed", { path, status: response.status });
    throw new Error(`Dodo request failed with status ${response.status}`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Dodo returned an invalid JSON response");
  }
}

async function createDodoCheckoutSession(opts: {
  productId: string;
  returnUrl: string;
  metadata: Record<string, string>;
  email?: string;
}): Promise<string> {
  const checkout = await dodoRequest<{ checkout_url?: string; payment_link?: string }>(
    "/checkouts",
    {
      method: "POST",
      body: JSON.stringify({
        product_cart: [{ product_id: opts.productId, quantity: 1 }],
        return_url: opts.returnUrl,
        ...(opts.email ? { customer: { email: opts.email } } : {}),
        metadata: opts.metadata,
      }),
    }
  );
  const url = checkout.checkout_url ?? checkout.payment_link;
  if (!url) throw new Error("Dodo did not return a checkout URL");
  return url;
}

export const createDodoCheckout = onCall(
  { cors: true, secrets: [dodoApiKey] },
  async (request: CallableRequest<{ planId: PlanId; billing?: Billing }>) => {
    const uid = requireAuth(request);
    const planId = request.data?.planId;
    const billing: Billing = request.data?.billing === "annual" ? "annual" : "monthly";
    if (planId !== "pro" && planId !== "max") {
      throw new HttpsError("invalid-argument", "planId must be 'pro' or 'max'");
    }

    const existing = await db.collection("subscriptions").doc(uid).get();
    if (existing.data()?.status === "active" && existing.data()?.providerSubscriptionId) {
      throw new HttpsError(
        "failed-precondition",
        "An active subscription already exists. Use Manage billing instead."
      );
    }

    try {
      const mapping = productFor(planId, billing);
      const url = await createDodoCheckoutSession({
        productId: mapping.productId,
        returnUrl: `${APP_BASE_URL}/pricing?checkout=returned`,
        email: request.auth?.token.email as string | undefined,
        metadata: { uid, planId, billing },
      });
      return { url };
    } catch (error: unknown) {
      logger.error("[createDodoCheckout] failed", {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError("internal", "Could not create a checkout session");
    }
  }
);

/**
 * Anonymous checkout is deliberately disabled: payment entitlements must be
 * attached to a verified Firebase uid before money is accepted.
 */
export const createGuestCheckout = onRequest({ cors: true }, async (req, res) => {
  const plan = String(req.query.plan ?? "").toLowerCase();
  const billing: Billing =
    String(req.query.billing ?? "monthly") === "annual" ? "annual" : "monthly";
  if (plan !== "pro" && plan !== "max") {
    res.redirect(302, `${LANDING_BASE_URL}/#pricing`);
    return;
  }
  const destination = `/pricing?plan=${plan}&billing=${billing}`;
  res.set("Cache-Control", "no-store");
  res.redirect(302, `${APP_BASE_URL}/login?redirect=${encodeURIComponent(destination)}`);
});

export const createDodoPortal = onCall(
  { cors: true, secrets: [dodoApiKey] },
  async (request: CallableRequest<Record<string, never>>) => {
    const uid = requireAuth(request);
    const snapshot = await db.collection("subscriptions").doc(uid).get();
    const customerId = snapshot.data()?.providerCustomerId as string | undefined;
    if (!customerId) {
      throw new HttpsError(
        "failed-precondition",
        "No billing profile is linked yet. Contact support if payment has completed."
      );
    }

    try {
      const query = new URLSearchParams({
        send_email: "false",
        return_url: `${APP_BASE_URL}/pricing`,
      });
      const session = await dodoRequest<{ link?: string }>(
        `/customers/${encodeURIComponent(customerId)}/customer-portal/session?${query}`,
        { method: "POST" }
      );
      if (!session.link) throw new Error("Dodo did not return a portal link");
      return { url: session.link };
    } catch (error: unknown) {
      logger.error("[createDodoPortal] failed", {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError("internal", "Could not open the billing portal");
    }
  }
);

function webhookSecret(): string {
  return secretValue(dodoWebhookSecret, "DODO_WEBHOOK_SECRET");
}

function eventStatus(type: string, providerStatus: string | undefined): string | null {
  if (providerStatus === "on_hold" || type === "subscription.on_hold") return "past_due";
  if (providerStatus === "cancelled" || type === "subscription.cancelled") return "cancelled";
  if (providerStatus === "failed" || type === "subscription.failed") return "failed";
  if (providerStatus === "expired" || type === "subscription.expired") return "expired";
  if (
    providerStatus === "active" ||
    type === "subscription.active" ||
    type === "subscription.renewed" ||
    type === "subscription.plan_changed"
  ) {
    return "active";
  }
  return null;
}

export const dodoWebhook = onRequest(
  { cors: false, secrets: [dodoWebhookSecret] },
  async (req, res) => {
    const rawBody =
      (req as unknown as { rawBody?: Buffer }).rawBody?.toString("utf8") ??
      JSON.stringify(req.body);
    const secret = webhookSecret();
    if (!secret) {
      logger.error("[dodoWebhook] DODO_WEBHOOK_SECRET is not configured");
      res.status(503).send("webhook unavailable");
      return;
    }

    const verification = verifyStandardWebhook(
      req.headers as StandardWebhookHeaders,
      rawBody,
      secret
    );
    if (!verification.ok) {
      logger.warn("[dodoWebhook] rejected delivery", { reason: verification.reason });
      res.status(401).send("invalid signature");
      return;
    }

    let event: DodoEvent;
    try {
      event = JSON.parse(rawBody) as DodoEvent;
    } catch {
      res.status(400).send("bad payload");
      return;
    }

    const type = event.type ?? "";
    const data = event.data ?? {};
    const eventDate = parseIsoTimestamp(event.timestamp);
    if (!eventDate || !type) {
      res.status(400).send("bad event envelope");
      return;
    }

    const expectedBusinessId = process.env.DODO_BUSINESS_ID;
    const businessMatches = !expectedBusinessId || event.business_id === expectedBusinessId;
    const metadataUid = data.metadata?.uid;
    const uid = typeof metadataUid === "string" && metadataUid.length <= 128 ? metadataUid : null;
    const mapping = productById(data.product_id);
    const status = eventStatus(type, data.status);
    const isSubscriptionEvent = type.startsWith("subscription.");
    const eventRef = db.collection("paymentWebhookEvents").doc(verification.webhookId);

    try {
      const result = await db.runTransaction(async (tx) => {
        const seen = await tx.get(eventRef);
        if (seen.exists) return "duplicate" as const;

        const baseRecord = {
          provider: "dodo",
          type,
          businessId: event.business_id ?? null,
          providerEventAt: Timestamp.fromDate(eventDate),
          receivedAt: FieldValue.serverTimestamp(),
        };

        if (!businessMatches || !isSubscriptionEvent || !uid || !mapping || !status) {
          tx.create(eventRef, {
            ...baseRecord,
            outcome: "ignored",
            reason: !businessMatches
              ? "business-mismatch"
              : !isSubscriptionEvent
                ? "non-subscription-event"
                : !uid
                  ? "missing-uid"
                  : !mapping
                    ? "unknown-product"
                    : "unsupported-status",
          });
          return "ignored" as const;
        }

        const subscriptionRef = db.collection("subscriptions").doc(uid);
        const subscriptionSnapshot = await tx.get(subscriptionRef);
        const existing = subscriptionSnapshot.data() ?? {};
        const lastEventAt = existing.providerEventAt as admin.firestore.Timestamp | undefined;
        if (lastEventAt && lastEventAt.toMillis() > eventDate.getTime()) {
          tx.create(eventRef, { ...baseRecord, uid, outcome: "ignored", reason: "out-of-order" });
          return "out-of-order" as const;
        }

        const providerFields = {
          provider: "dodo",
          providerProductId: mapping.productId,
          providerSubscriptionId: data.subscription_id ?? existing.providerSubscriptionId ?? null,
          providerCustomerId: data.customer?.customer_id ?? existing.providerCustomerId ?? null,
          ...(data.payment_id ? { providerPaymentId: data.payment_id } : {}),
          providerEventAt: Timestamp.fromDate(eventDate),
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (status === "active") {
          const periodEnd = parseIsoTimestamp(data.next_billing_date);
          if (!periodEnd) {
            tx.create(eventRef, {
              ...baseRecord,
              uid,
              outcome: "ignored",
              reason: "missing-period-end",
            });
            return "ignored" as const;
          }
          const isNewSubscription =
            !existing.providerSubscriptionId ||
            existing.providerSubscriptionId !== data.subscription_id;
          tx.set(
            subscriptionRef,
            {
              ...providerFields,
              plan: mapping.plan,
              billing: mapping.billing,
              status: "active",
              videosLimit: PLAN_VIDEO_LIMIT[mapping.plan],
              currentPeriodEnd: Timestamp.fromDate(periodEnd),
              ...(type === "subscription.renewed" || isNewSubscription ? { videosUsed: 0 } : {}),
            },
            { merge: true }
          );
        } else if (status === "past_due") {
          tx.set(
            subscriptionRef,
            { ...providerFields, status: "past_due", videosLimit: 0 },
            { merge: true }
          );
        } else {
          tx.set(
            subscriptionRef,
            {
              ...providerFields,
              plan: "free",
              status,
              videosLimit: 0,
            },
            { merge: true }
          );
        }

        tx.create(eventRef, {
          ...baseRecord,
          uid,
          outcome: "applied",
          providerSubscriptionId: data.subscription_id ?? null,
          providerCustomerId: data.customer?.customer_id ?? null,
          productId: mapping.productId,
        });
        return "applied" as const;
      });

      res.status(200).json({ received: true, result });
    } catch (error: unknown) {
      logger.error("[dodoWebhook] processing failed", {
        webhookId: verification.webhookId,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).send("processing failed");
    }
  }
);
