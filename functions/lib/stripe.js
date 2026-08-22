"use strict";
// Stripe Payments integration: authenticated hosted checkout, durable webhook
// receiver, and guest-checkout (marketing landing page) support.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.createStripePortal = exports.createGuestCheckout = exports.createStripeCheckout = exports.stripeWebhookSecret = exports.stripeApiKey = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firebase_functions_1 = require("firebase-functions");
const core_1 = require("./core");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
exports.stripeApiKey = (0, params_1.defineSecret)("STRIPE_API_KEY");
exports.stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
function getStripe() {
    const key = exports.stripeApiKey.value();
    if (!key)
        throw new Error("STRIPE_API_KEY is not configured");
    return new stripe_1.default(key);
}
function resolveProductId(plan, billing) {
    var _a;
    const catalogue = [
        { productId: process.env.STRIPE_PRODUCT_PRO_MONTHLY, plan: "pro", billing: "monthly" },
        { productId: process.env.STRIPE_PRODUCT_PRO_ANNUAL, plan: "pro", billing: "annual" },
        { productId: process.env.STRIPE_PRODUCT_MAX_MONTHLY, plan: "max", billing: "monthly" },
        { productId: process.env.STRIPE_PRODUCT_MAX_ANNUAL, plan: "max", billing: "annual" },
    ];
    const match = (_a = catalogue.find((c) => c.plan === plan && c.billing === billing)) === null || _a === void 0 ? void 0 : _a.productId;
    if (!match)
        throw new Error(`Stripe product is not configured for ${plan}/${billing}`);
    return match;
}
exports.createStripeCheckout = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [exports.stripeApiKey] }), async (request) => {
    var _a, _b;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    try {
        const { planId, billing } = request.data;
        const stripe = getStripe();
        const priceId = resolveProductId(planId, billing);
        const appBase = (_b = process.env.APP_BASE_URL) !== null && _b !== void 0 ? _b : "https://app.magicboxai.in";
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
        if (!session.url)
            throw new Error("Stripe did not return a checkout URL");
        return { url: session.url };
    }
    catch (error) {
        firebase_functions_1.logger.error("[createStripeCheckout] failed", {
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
        throw new https_1.HttpsError("internal", "Could not create checkout session");
    }
});
exports.createGuestCheckout = (0, https_1.onCall)({ cors: true, secrets: [exports.stripeApiKey] }, async (request) => {
    var _a;
    try {
        const { planId, billing, customerEmail } = request.data;
        const stripe = getStripe();
        const priceId = resolveProductId(planId, billing);
        const appBase = (_a = process.env.APP_BASE_URL) !== null && _a !== void 0 ? _a : "https://app.magicboxai.in";
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
        if (!session.url)
            throw new Error("Stripe did not return a checkout URL");
        return { url: session.url };
    }
    catch (error) {
        firebase_functions_1.logger.error("[createGuestCheckout] failed", {
            error: error instanceof Error ? error.message : String(error),
        });
        throw new https_1.HttpsError("internal", "Could not create guest checkout session");
    }
});
exports.createStripePortal = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [exports.stripeApiKey] }), async (request) => {
    var _a, _b, _c;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    try {
        const stripe = getStripe();
        const snap = await core_1.db.collection("subscriptions").doc(uid).get();
        const customerId = (_b = snap.data()) === null || _b === void 0 ? void 0 : _b.providerCustomerId;
        if (!customerId) {
            throw new Error("No active Stripe customer found");
        }
        const appBase = (_c = process.env.APP_BASE_URL) !== null && _c !== void 0 ? _c : "https://app.magicboxai.in";
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${appBase}/settings`,
        });
        if (!session.url)
            throw new Error("Stripe did not return a portal link");
        return { url: session.url };
    }
    catch (error) {
        firebase_functions_1.logger.error("[createStripePortal] failed", {
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
        throw new https_1.HttpsError("internal", "Could not open billing portal");
    }
});
exports.stripeWebhook = (0, https_1.onRequest)({ cors: false, secrets: [exports.stripeApiKey, exports.stripeWebhookSecret] }, async (req, res) => {
    var _a, _b, _c;
    try {
        const sig = req.headers["stripe-signature"];
        const secret = exports.stripeWebhookSecret.value();
        if (!sig || !secret) {
            res.status(400).send("Missing signature or secret");
            return;
        }
        const stripe = getStripe();
        let event;
        try {
            event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
        }
        catch (err) {
            res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : String(err)}`);
            return;
        }
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const uid = session.client_reference_id;
            const customerId = session.customer;
            const subscriptionId = session.subscription;
            const email = (_b = (_a = session.customer_details) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.toLowerCase().trim();
            // Lookup the subscription to get product details
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const productId = (_c = subscription.items.data[0]) === null || _c === void 0 ? void 0 : _c.price.id;
            // Find matching plan mapping
            const catalogue = [
                { productId: process.env.STRIPE_PRODUCT_PRO_MONTHLY, plan: "pro", billing: "monthly" },
                { productId: process.env.STRIPE_PRODUCT_PRO_ANNUAL, plan: "pro", billing: "annual" },
                { productId: process.env.STRIPE_PRODUCT_MAX_MONTHLY, plan: "max", billing: "monthly" },
                { productId: process.env.STRIPE_PRODUCT_MAX_ANNUAL, plan: "max", billing: "annual" },
            ];
            const mapping = catalogue.find(c => c.productId === productId);
            if (!mapping) {
                firebase_functions_1.logger.warn("[stripeWebhook] unknown product", { productId });
                res.json({ received: true });
                return;
            }
            const periodEnd = new Date((subscription.current_period_end || 0) * 1000);
            if (uid) {
                await core_1.db.collection("subscriptions").doc(uid).set({
                    plan: mapping.plan,
                    billing: mapping.billing,
                    status: "active",
                    provider: "stripe",
                    videosLimit: core_1.PLAN_VIDEO_LIMIT[mapping.plan] || 0,
                    providerSubscriptionId: subscriptionId,
                    providerCustomerId: customerId,
                    providerProductId: productId,
                    currentPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            else if (email) {
                // Guest checkout - park the entitlement
                await core_1.db.collection("pending_entitlements").doc(email).set({
                    plan: mapping.plan,
                    billing: mapping.billing,
                    status: "active",
                    provider: "stripe",
                    providerSubscriptionId: subscriptionId,
                    providerCustomerId: customerId,
                    providerProductId: productId,
                    currentPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }
        else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
            const subscription = event.data.object;
            const customerId = subscription.customer;
            // We need to look up the user by customer ID
            const usersSnapshot = await core_1.db.collection("subscriptions")
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
                await doc.ref.set(Object.assign(Object.assign({ status }, (isCancelled ? { plan: "free", videosLimit: 0 } : {})), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
            }
        }
        res.json({ received: true });
    }
    catch (error) {
        firebase_functions_1.logger.error("[stripeWebhook] processing failed", {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).send("processing failed");
    }
});
//# sourceMappingURL=stripe.js.map