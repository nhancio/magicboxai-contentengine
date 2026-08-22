// Stripe Payments integration: authenticated hosted checkout, durable webhook
// receiver, and guest-checkout (marketing landing page) support.

import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { db, callableSecurity, PLAN_VIDEO_LIMIT } from "./core";
import * as admin from "firebase-admin";
import Stripe from "stripe";

export const stripeApiKey = defineSecret("STRIPE_API_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

function getStripe(): Stripe {
  const key = stripeApiKey.value();
  if (!key) throw new Error("STRIPE_API_KEY is not configured");
  return new Stripe(key);
}

function resolveProductId(plan: "pro" | "max", billing: "monthly" | "annual"): string {
  const catalogue = [
    { productId: process.env.STRIPE_PRODUCT_PRO_MONTHLY, plan: "pro", billing: "monthly" },
    { productId: process.env.STRIPE_PRODUCT_PRO_ANNUAL, plan: "pro", billing: "annual" },
    { productId: process.env.STRIPE_PRODUCT_MAX_MONTHLY, plan: "max", billing: "monthly" },
    { productId: process.env.STRIPE_PRODUCT_MAX_ANNUAL, plan: "max", billing: "annual" },
  ];
  const match = catalogue.find((c) => c.plan === plan && c.billing === billing)?.productId;
  if (!match) throw new Error(`Stripe product is not configured for ${plan}/${billing}`);
  return match;
}

export const createStripeCheckout = onCall(
  { ...callableSecurity, secrets: [stripeApiKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

    try {
      const { planId, billing } = request.data as {
        planId: "pro" | "max";
        billing: "monthly" | "annual";
      };
      
      const stripe = getStripe();
      const priceId = resolveProductId(planId, billing);
      
      const appBase = process.env.APP_BASE_URL ?? "https://app.magicboxai.in";
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${appBase}/pricing?checkout=returned&plan=${planId}&billing=${billing}`,
        cancel_url: `${appBase}/pricing?checkout=cancelled`,
        client_reference_id: uid,
      });

      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      return { url: session.url };
    } catch (error) {
      logger.error("[createStripeCheckout] failed", {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError("internal", "Could not create checkout session");
    }
  }
);

export const createGuestCheckout = onCall(
  { cors: true, secrets: [stripeApiKey] },
  async (request) => {
    try {
      const { planId, billing, customerEmail } = request.data as {
        planId: "pro" | "max";
        billing: "monthly" | "annual";
        customerEmail?: string;
      };
      
      const stripe = getStripe();
      const priceId = resolveProductId(planId, billing);
      const appBase = process.env.APP_BASE_URL ?? "https://app.magicboxai.in";
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: customerEmail,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${appBase}/login?intent=google`,
        cancel_url: `${appBase}/pricing`,
      });

      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      return { url: session.url };
    } catch (error) {
      logger.error("[createGuestCheckout] failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError("internal", "Could not create guest checkout session");
    }
  }
);

export const createStripePortal = onCall(
  { ...callableSecurity, secrets: [stripeApiKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

    try {
      const stripe = getStripe();
      const snap = await db.collection("subscriptions").doc(uid).get();
      const customerId = snap.data()?.providerCustomerId;
      
      if (!customerId) {
        throw new Error("No active Stripe customer found");
      }
      
      const appBase = process.env.APP_BASE_URL ?? "https://app.magicboxai.in";

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appBase}/settings`,
      });

      if (!session.url) throw new Error("Stripe did not return a portal link");
      return { url: session.url };
    } catch (error) {
      logger.error("[createStripePortal] failed", {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError("internal", "Could not open billing portal");
    }
  }
);

export const stripeWebhook = onRequest(
  { cors: false, secrets: [stripeApiKey, stripeWebhookSecret] },
  async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      const secret = stripeWebhookSecret.value();
      
      if (!sig || !secret) {
        res.status(400).send("Missing signature or secret");
        return;
      }
      
      const stripe = getStripe();
      let event: Stripe.Event;
      
      try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
      } catch (err) {
        res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const email = session.customer_details?.email?.toLowerCase().trim();
        
        // Lookup the subscription to get product details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const productId = subscription.items.data[0]?.price.id;
        
        // Find matching plan mapping
        const catalogue = [
          { productId: process.env.STRIPE_PRODUCT_PRO_MONTHLY, plan: "pro", billing: "monthly" },
          { productId: process.env.STRIPE_PRODUCT_PRO_ANNUAL, plan: "pro", billing: "annual" },
          { productId: process.env.STRIPE_PRODUCT_MAX_MONTHLY, plan: "max", billing: "monthly" },
          { productId: process.env.STRIPE_PRODUCT_MAX_ANNUAL, plan: "max", billing: "annual" },
        ];
        const mapping = catalogue.find(c => c.productId === productId);
        
        if (!mapping) {
          logger.warn("[stripeWebhook] unknown product", { productId });
          res.json({ received: true });
          return;
        }

        const periodEnd = new Date(((subscription as any).current_period_end || 0) * 1000);

        if (uid) {
          await db.collection("subscriptions").doc(uid).set(
            {
              plan: mapping.plan,
              billing: mapping.billing,
              status: "active",
              provider: "stripe",
              videosLimit: PLAN_VIDEO_LIMIT[mapping.plan as "pro" | "max"] || 0,
              providerSubscriptionId: subscriptionId,
              providerCustomerId: customerId,
              providerProductId: productId,
              currentPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } else if (email) {
          // Guest checkout - park the entitlement
          await db.collection("pending_entitlements").doc(email).set(
            {
              plan: mapping.plan,
              billing: mapping.billing,
              status: "active",
              provider: "stripe",
              providerSubscriptionId: subscriptionId,
              providerCustomerId: customerId,
              providerProductId: productId,
              currentPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // We need to look up the user by customer ID
        const usersSnapshot = await db.collection("subscriptions")
          .where("providerCustomerId", "==", customerId)
          .limit(1)
          .get();
          
        if (!usersSnapshot.empty) {
          const doc = usersSnapshot.docs[0];
          const status = subscription.status === "active" || subscription.status === "trialing" 
            ? "active" 
            : subscription.status === "past_due" 
              ? "past_due" 
              : "cancelled";
              
          const isCancelled = status !== "active" && status !== "past_due";
          
          await doc.ref.set(
            {
              status,
              ...(isCancelled ? { plan: "free", videosLimit: 0 } : {}),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }
      
      res.json({ received: true });
    } catch (error) {
      logger.error("[stripeWebhook] processing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).send("processing failed");
    }
  }
);
