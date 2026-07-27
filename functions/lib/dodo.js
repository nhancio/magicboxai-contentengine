"use strict";
// Dodo Payments integration: authenticated hosted checkout, durable webhook
// entitlement updates, and authenticated customer-portal sessions.
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
exports.dodoWebhook = exports.createDodoPortal = exports.createGuestCheckout = exports.createDodoCheckout = exports.dodoWebhookSecret = exports.dodoApiKey = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const core_1 = require("./core");
const dodo_webhook_1 = require("./payments/dodo-webhook");
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
exports.dodoApiKey = (0, params_1.defineSecret)("DODO_API_KEY");
exports.dodoWebhookSecret = (0, params_1.defineSecret)("DODO_WEBHOOK_SECRET");
const APP_BASE_URL = process.env.APP_BASE_URL || "https://app.magicboxai.in";
const LANDING_BASE_URL = process.env.LANDING_BASE_URL || "https://magicboxai.in";
function dodoApiBase() {
    return process.env.DODO_MODE === "live"
        ? "https://live.dodopayments.com"
        : "https://test.dodopayments.com";
}
function secretValue(secret, envName) {
    var _a;
    try {
        const value = secret.value();
        if (value)
            return value;
    }
    catch (_b) {
        // Local tests/builds can fall back to an ignored .env file.
    }
    return (_a = process.env[envName]) !== null && _a !== void 0 ? _a : "";
}
function requireApiKey() {
    const value = secretValue(exports.dodoApiKey, "DODO_API_KEY");
    if (!value)
        throw new Error("DODO_API_KEY is not configured");
    return value;
}
function configuredProducts() {
    return [
        { productId: process.env.DODO_PRODUCT_PRO_MONTHLY, plan: "pro", billing: "monthly" },
        { productId: process.env.DODO_PRODUCT_PRO_ANNUAL, plan: "pro", billing: "annual" },
        { productId: process.env.DODO_PRODUCT_MAX_MONTHLY, plan: "max", billing: "monthly" },
        { productId: process.env.DODO_PRODUCT_MAX_ANNUAL, plan: "max", billing: "annual" },
    ].filter((entry) => Boolean(entry.productId));
}
function productFor(plan, billing) {
    const match = configuredProducts().find((entry) => entry.plan === plan && entry.billing === billing);
    if (!match)
        throw new Error(`Dodo product is not configured for ${plan}/${billing}`);
    return match;
}
function productById(productId) {
    var _a;
    if (!productId)
        return null;
    return (_a = configuredProducts().find((entry) => entry.productId === productId)) !== null && _a !== void 0 ? _a : null;
}
async function dodoRequest(path, init) {
    var _a;
    const response = await fetch(`${dodoApiBase()}${path}`, Object.assign(Object.assign({}, init), { headers: Object.assign({ Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json" }, ((_a = init.headers) !== null && _a !== void 0 ? _a : {})) }));
    const body = await response.text();
    if (!response.ok) {
        logger.error("[dodo] provider request failed", { path, status: response.status });
        throw new Error(`Dodo request failed with status ${response.status}`);
    }
    try {
        return JSON.parse(body);
    }
    catch (_b) {
        throw new Error("Dodo returned an invalid JSON response");
    }
}
async function createDodoCheckoutSession(opts) {
    var _a;
    const checkout = await dodoRequest("/checkouts", {
        method: "POST",
        body: JSON.stringify(Object.assign(Object.assign({ product_cart: [{ product_id: opts.productId, quantity: 1 }], return_url: opts.returnUrl }, (opts.email ? { customer: { email: opts.email } } : {})), { metadata: opts.metadata })),
    });
    const url = (_a = checkout.checkout_url) !== null && _a !== void 0 ? _a : checkout.payment_link;
    if (!url)
        throw new Error("Dodo did not return a checkout URL");
    return url;
}
exports.createDodoCheckout = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [exports.dodoApiKey] }), async (request) => {
    var _a, _b, _c, _d, _e;
    const uid = (0, core_1.requireAuth)(request);
    const planId = (_a = request.data) === null || _a === void 0 ? void 0 : _a.planId;
    const billing = ((_b = request.data) === null || _b === void 0 ? void 0 : _b.billing) === "annual" ? "annual" : "monthly";
    if (planId !== "pro" && planId !== "max") {
        throw new https_1.HttpsError("invalid-argument", "planId must be 'pro' or 'max'");
    }
    const existing = await core_1.db.collection("subscriptions").doc(uid).get();
    if (((_c = existing.data()) === null || _c === void 0 ? void 0 : _c.status) === "active" && ((_d = existing.data()) === null || _d === void 0 ? void 0 : _d.providerSubscriptionId)) {
        throw new https_1.HttpsError("failed-precondition", "An active subscription already exists. Use Manage billing instead.");
    }
    try {
        const mapping = productFor(planId, billing);
        const url = await createDodoCheckoutSession({
            productId: mapping.productId,
            returnUrl: `${APP_BASE_URL}/pricing?checkout=returned`,
            email: (_e = request.auth) === null || _e === void 0 ? void 0 : _e.token.email,
            metadata: { uid, planId, billing },
        });
        return { url };
    }
    catch (error) {
        logger.error("[createDodoCheckout] failed", {
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
        throw new https_1.HttpsError("internal", "Could not create a checkout session");
    }
});
/**
 * Guest checkout: creates a real Dodo hosted-checkout session for a visitor
 * with no Firebase account yet. The visitor pays with whatever email they
 * enter on Dodo's page; no `uid` is attached at creation time. Entitlement is
 * granted once they sign in with that same (Google-verified) email — the
 * webhook below stores it under `pendingEntitlements/{email}`, and
 * `welcome.ts` claims it into `subscriptions/{uid}` on every login.
 */
exports.createGuestCheckout = (0, https_1.onRequest)({ cors: true, secrets: [exports.dodoApiKey] }, async (req, res) => {
    var _a, _b;
    const planRaw = String((_a = req.query.plan) !== null && _a !== void 0 ? _a : "").toLowerCase();
    const billing = String((_b = req.query.billing) !== null && _b !== void 0 ? _b : "monthly") === "annual" ? "annual" : "monthly";
    if (planRaw !== "pro" && planRaw !== "max") {
        res.redirect(302, `${LANDING_BASE_URL}/#pricing`);
        return;
    }
    const plan = planRaw;
    try {
        const mapping = productFor(plan, billing);
        // Reuses the app's existing "?checkout=returned" handling on /pricing
        // (shows a confirmation toast, refetches the subscription) — the same
        // path an authenticated checkout return already goes through.
        const destination = "/pricing?checkout=returned";
        const url = await createDodoCheckoutSession({
            productId: mapping.productId,
            returnUrl: `${APP_BASE_URL}/login?intent=google&redirect=${encodeURIComponent(destination)}`,
            metadata: { planId: plan, billing, guest: "true" },
        });
        res.set("Cache-Control", "no-store");
        res.redirect(302, url);
    }
    catch (error) {
        logger.error("[createGuestCheckout] failed", {
            plan,
            billing,
            error: error instanceof Error ? error.message : String(error),
        });
        res.redirect(302, `${LANDING_BASE_URL}/#pricing`);
    }
});
exports.createDodoPortal = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [exports.dodoApiKey] }), async (request) => {
    var _a;
    const uid = (0, core_1.requireAuth)(request);
    const snapshot = await core_1.db.collection("subscriptions").doc(uid).get();
    const customerId = (_a = snapshot.data()) === null || _a === void 0 ? void 0 : _a.providerCustomerId;
    if (!customerId) {
        throw new https_1.HttpsError("failed-precondition", "No billing profile is linked yet. Contact support if payment has completed.");
    }
    try {
        const query = new URLSearchParams({
            send_email: "false",
            return_url: `${APP_BASE_URL}/pricing`,
        });
        const session = await dodoRequest(`/customers/${encodeURIComponent(customerId)}/customer-portal/session?${query}`, { method: "POST" });
        if (!session.link)
            throw new Error("Dodo did not return a portal link");
        return { url: session.link };
    }
    catch (error) {
        logger.error("[createDodoPortal] failed", {
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
        throw new https_1.HttpsError("internal", "Could not open the billing portal");
    }
});
function webhookSecret() {
    return secretValue(exports.dodoWebhookSecret, "DODO_WEBHOOK_SECRET");
}
function eventStatus(type, providerStatus) {
    if (providerStatus === "on_hold" || type === "subscription.on_hold")
        return "past_due";
    if (providerStatus === "cancelled" || type === "subscription.cancelled")
        return "cancelled";
    if (providerStatus === "failed" || type === "subscription.failed")
        return "failed";
    if (providerStatus === "expired" || type === "subscription.expired")
        return "expired";
    if (providerStatus === "active" ||
        type === "subscription.active" ||
        type === "subscription.renewed" ||
        type === "subscription.plan_changed") {
        return "active";
    }
    return null;
}
exports.dodoWebhook = (0, https_1.onRequest)({ cors: false, secrets: [exports.dodoWebhookSecret] }, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const rawBody = (_b = (_a = req.rawBody) === null || _a === void 0 ? void 0 : _a.toString("utf8")) !== null && _b !== void 0 ? _b : JSON.stringify(req.body);
    const secret = webhookSecret();
    if (!secret) {
        logger.error("[dodoWebhook] DODO_WEBHOOK_SECRET is not configured");
        res.status(503).send("webhook unavailable");
        return;
    }
    const verification = (0, dodo_webhook_1.verifyStandardWebhook)(req.headers, rawBody, secret);
    if (!verification.ok) {
        logger.warn("[dodoWebhook] rejected delivery", { reason: verification.reason });
        res.status(401).send("invalid signature");
        return;
    }
    let event;
    try {
        event = JSON.parse(rawBody);
    }
    catch (_j) {
        res.status(400).send("bad payload");
        return;
    }
    const type = (_c = event.type) !== null && _c !== void 0 ? _c : "";
    const data = (_d = event.data) !== null && _d !== void 0 ? _d : {};
    const eventDate = (0, dodo_webhook_1.parseIsoTimestamp)(event.timestamp);
    if (!eventDate || !type) {
        res.status(400).send("bad event envelope");
        return;
    }
    const expectedBusinessId = process.env.DODO_BUSINESS_ID;
    const businessMatches = !expectedBusinessId || event.business_id === expectedBusinessId;
    const metadataUid = (_e = data.metadata) === null || _e === void 0 ? void 0 : _e.uid;
    const uid = typeof metadataUid === "string" && metadataUid.length <= 128 ? metadataUid : null;
    const isGuestCheckout = ((_f = data.metadata) === null || _f === void 0 ? void 0 : _f.guest) === "true";
    const guestEmail = ((_h = (_g = data.customer) === null || _g === void 0 ? void 0 : _g.email) === null || _h === void 0 ? void 0 : _h.trim().toLowerCase()) || null;
    const mapping = productById(data.product_id);
    const status = eventStatus(type, data.status);
    const isSubscriptionEvent = type.startsWith("subscription.");
    const eventRef = core_1.db.collection("paymentWebhookEvents").doc(verification.webhookId);
    try {
        const result = await core_1.db.runTransaction(async (tx) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            const seen = await tx.get(eventRef);
            if (seen.exists)
                return "duplicate";
            const baseRecord = {
                provider: "dodo",
                type,
                businessId: (_a = event.business_id) !== null && _a !== void 0 ? _a : null,
                providerEventAt: Timestamp.fromDate(eventDate),
                receivedAt: FieldValue.serverTimestamp(),
            };
            // No Firebase account exists yet for a guest checkout — stash the paid
            // entitlement under the payer's email instead of a uid. `welcome.ts`
            // claims it into `subscriptions/{uid}` the moment that email signs in.
            if (!uid &&
                isGuestCheckout &&
                businessMatches &&
                isSubscriptionEvent &&
                mapping &&
                status === "active") {
                if (!guestEmail) {
                    tx.create(eventRef, Object.assign(Object.assign({}, baseRecord), { outcome: "ignored", reason: "guest-missing-email" }));
                    return "ignored";
                }
                const periodEnd = (0, dodo_webhook_1.parseIsoTimestamp)(data.next_billing_date);
                if (!periodEnd) {
                    tx.create(eventRef, Object.assign(Object.assign({}, baseRecord), { outcome: "ignored", reason: "missing-period-end" }));
                    return "ignored";
                }
                const pendingRef = core_1.db.collection("pendingEntitlements").doc(guestEmail);
                const pending = await tx.get(pendingRef);
                // Same guarantee as the subscriptions branch below: an out-of-order
                // webhook must not clobber a newer one already recorded.
                const pendingEventAt = (_b = pending.data()) === null || _b === void 0 ? void 0 : _b.providerEventAt;
                if (pendingEventAt && pendingEventAt.toMillis() > eventDate.getTime()) {
                    tx.create(eventRef, Object.assign(Object.assign({}, baseRecord), { outcome: "ignored", reason: "out-of-order" }));
                    return "out-of-order";
                }
                tx.set(pendingRef, {
                    plan: mapping.plan,
                    billing: mapping.billing,
                    status: "paid",
                    provider: "dodo",
                    providerProductId: mapping.productId,
                    providerSubscriptionId: (_c = data.subscription_id) !== null && _c !== void 0 ? _c : null,
                    providerCustomerId: (_e = (_d = data.customer) === null || _d === void 0 ? void 0 : _d.customer_id) !== null && _e !== void 0 ? _e : null,
                    currentPeriodEnd: Timestamp.fromDate(periodEnd),
                    providerEventAt: Timestamp.fromDate(eventDate),
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
                tx.create(eventRef, Object.assign(Object.assign({}, baseRecord), { outcome: "applied-guest", guestEmail, productId: mapping.productId }));
                return "applied-guest";
            }
            if (!businessMatches || !isSubscriptionEvent || !uid || !mapping || !status) {
                tx.create(eventRef, Object.assign(Object.assign({}, baseRecord), { outcome: "ignored", reason: !businessMatches
                        ? "business-mismatch"
                        : !isSubscriptionEvent
                            ? "non-subscription-event"
                            : !uid
                                ? "missing-uid"
                                : !mapping
                                    ? "unknown-product"
                                    : "unsupported-status" }));
                return "ignored";
            }
            const subscriptionRef = core_1.db.collection("subscriptions").doc(uid);
            const subscriptionSnapshot = await tx.get(subscriptionRef);
            const existing = (_f = subscriptionSnapshot.data()) !== null && _f !== void 0 ? _f : {};
            const lastEventAt = existing.providerEventAt;
            if (lastEventAt && lastEventAt.toMillis() > eventDate.getTime()) {
                tx.create(eventRef, Object.assign(Object.assign({}, baseRecord), { uid, outcome: "ignored", reason: "out-of-order" }));
                return "out-of-order";
            }
            const providerFields = Object.assign(Object.assign({ provider: "dodo", providerProductId: mapping.productId, providerSubscriptionId: (_h = (_g = data.subscription_id) !== null && _g !== void 0 ? _g : existing.providerSubscriptionId) !== null && _h !== void 0 ? _h : null, providerCustomerId: (_l = (_k = (_j = data.customer) === null || _j === void 0 ? void 0 : _j.customer_id) !== null && _k !== void 0 ? _k : existing.providerCustomerId) !== null && _l !== void 0 ? _l : null }, (data.payment_id ? { providerPaymentId: data.payment_id } : {})), { providerEventAt: Timestamp.fromDate(eventDate), updatedAt: FieldValue.serverTimestamp() });
            if (status === "active") {
                const periodEnd = (0, dodo_webhook_1.parseIsoTimestamp)(data.next_billing_date);
                if (!periodEnd) {
                    tx.create(eventRef, Object.assign(Object.assign({}, baseRecord), { uid, outcome: "ignored", reason: "missing-period-end" }));
                    return "ignored";
                }
                const isNewSubscription = !existing.providerSubscriptionId ||
                    existing.providerSubscriptionId !== data.subscription_id;
                tx.set(subscriptionRef, Object.assign(Object.assign(Object.assign({}, providerFields), { plan: mapping.plan, billing: mapping.billing, status: "active", videosLimit: core_1.PLAN_VIDEO_LIMIT[mapping.plan], currentPeriodEnd: Timestamp.fromDate(periodEnd) }), (type === "subscription.renewed" || isNewSubscription ? { videosUsed: 0 } : {})), { merge: true });
            }
            else if (status === "past_due") {
                tx.set(subscriptionRef, Object.assign(Object.assign({}, providerFields), { status: "past_due", videosLimit: 0 }), { merge: true });
            }
            else {
                tx.set(subscriptionRef, Object.assign(Object.assign({}, providerFields), { plan: "free", status, videosLimit: 0 }), { merge: true });
            }
            tx.create(eventRef, Object.assign(Object.assign({}, baseRecord), { uid, outcome: "applied", providerSubscriptionId: (_m = data.subscription_id) !== null && _m !== void 0 ? _m : null, providerCustomerId: (_p = (_o = data.customer) === null || _o === void 0 ? void 0 : _o.customer_id) !== null && _p !== void 0 ? _p : null, productId: mapping.productId }));
            return "applied";
        });
        res.status(200).json({ received: true, result });
    }
    catch (error) {
        logger.error("[dodoWebhook] processing failed", {
            webhookId: verification.webhookId,
            type,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).send("processing failed");
    }
});
//# sourceMappingURL=dodo.js.map