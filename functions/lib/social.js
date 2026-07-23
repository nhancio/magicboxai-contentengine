"use strict";
// Direct OAuth connection for Instagram (via the Meta Graph API), LinkedIn,
// and YouTube (Google OAuth).
// Replaces the Post Bridge aggregator. Two callables build the consent URL and
// disconnect an account; one HTTP endpoint handles the provider redirect.
//
// Access tokens are written to `socialTokens/{accountId}` which is NEVER
// client-readable (see firestore.rules). The client only reads `socialAccounts`.
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
exports.socialOAuthCallback = exports.disconnectSocialAccount = exports.getSocialConnectUrl = exports.oauthStateSecret = exports.googleOAuthClientSecret = exports.googleOAuthClientId = exports.linkedinClientSecret = exports.linkedinClientId = exports.metaAppSecret = exports.metaAppId = void 0;
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const node_crypto_1 = require("node:crypto");
const core_1 = require("./core");
exports.metaAppId = (0, params_1.defineSecret)("META_APP_ID");
exports.metaAppSecret = (0, params_1.defineSecret)("META_APP_SECRET");
exports.linkedinClientId = (0, params_1.defineSecret)("LINKEDIN_CLIENT_ID");
exports.linkedinClientSecret = (0, params_1.defineSecret)("LINKEDIN_CLIENT_SECRET");
exports.googleOAuthClientId = (0, params_1.defineSecret)("GOOGLE_OAUTH_CLIENT_ID");
exports.googleOAuthClientSecret = (0, params_1.defineSecret)("GOOGLE_OAUTH_CLIENT_SECRET");
exports.oauthStateSecret = (0, params_1.defineSecret)("OAUTH_STATE_SECRET");
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const GRAPH = "https://graph.facebook.com/v21.0";
/** Where the user lands back in the app after the OAuth round-trip. */
const APP_BASE_URL = process.env.APP_BASE_URL || "https://app.magicboxai.in";
/**
 * The public HTTPS URL of the `socialOAuthCallback` function. Must be registered
 * verbatim as an allowed redirect URI in the Meta and LinkedIn app settings.
 * Override with OAUTH_CALLBACK_URL once the function's real URL is known.
 */
function callbackUrl() {
    if (process.env.OAUTH_CALLBACK_URL)
        return process.env.OAUTH_CALLBACK_URL;
    const project = process.env.GCLOUD_PROJECT || "magicboxai-50927";
    return `https://us-central1-${project}.cloudfunctions.net/socialOAuthCallback`;
}
function b64url(input) {
    return Buffer.from(input).toString("base64url");
}
function signState(payload) {
    const body = b64url(JSON.stringify(payload));
    const sig = (0, node_crypto_1.createHmac)("sha256", exports.oauthStateSecret.value()).update(body).digest("base64url");
    return `${body}.${sig}`;
}
function verifyState(token) {
    const [body, sig] = token.split(".");
    if (!body || !sig)
        throw new Error("Malformed state");
    const expected = (0, node_crypto_1.createHmac)("sha256", exports.oauthStateSecret.value()).update(body).digest();
    const provided = Buffer.from(sig, "base64url");
    if (provided.length !== expected.length || !(0, node_crypto_1.timingSafeEqual)(provided, expected)) {
        throw new Error("Bad state signature");
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const now = Date.now();
    if (typeof payload.uid !== "string" ||
        payload.uid.length < 1 ||
        payload.uid.length > 128 ||
        (payload.provider !== "instagram" && payload.provider !== "linkedin" && payload.provider !== "youtube") ||
        typeof payload.n !== "string" ||
        !/^[a-f0-9]{32}$/i.test(payload.n) ||
        !Number.isSafeInteger(payload.exp) ||
        payload.exp < now ||
        payload.exp > now + 11 * 60000 ||
        (payload.returnTo !== undefined && !/^\/[A-Za-z0-9/_-]*$/.test(payload.returnTo))) {
        throw new Error("State expired or invalid");
    }
    return payload;
}
/** State is signed and single-use: burning the nonce closes OAuth callback replay. */
async function consumeState(state) {
    const ref = core_1.db.collection("oauthStates").doc(state.n);
    await core_1.db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.data();
        const expiresAt = data === null || data === void 0 ? void 0 : data.expiresAt;
        if (!snap.exists ||
            (data === null || data === void 0 ? void 0 : data.uid) !== state.uid ||
            (data === null || data === void 0 ? void 0 : data.provider) !== state.provider ||
            !expiresAt ||
            expiresAt.toMillis() < Date.now()) {
            throw new Error("State was already used or expired");
        }
        transaction.delete(ref);
    });
}
// --- storage ---
function accountId(uid, provider, externalId) {
    const safe = externalId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80);
    return `${uid}_${provider}_${safe}`;
}
async function storeAccount(uid, provider, profile, token) {
    var _a;
    const id = accountId(uid, provider, profile.externalId);
    const platform = provider; // instagram|linkedin|youtube map 1:1
    await core_1.db.collection("socialAccounts").doc(id).set({
        userId: uid,
        provider,
        platform,
        externalId: profile.externalId,
        username: profile.username,
        displayName: profile.displayName || profile.username,
        avatarUrl: (_a = profile.avatarUrl) !== null && _a !== void 0 ? _a : "",
        status: "active",
        linkedAt: FieldValue.serverTimestamp(),
        lastSyncedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await core_1.db.collection("socialTokens").doc(id).set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ userId: uid, provider, accessToken: token.accessToken }, (token.refreshToken ? { refreshToken: token.refreshToken } : {})), (token.expiresInSeconds
        ? { expiresAt: Timestamp.fromMillis(Date.now() + token.expiresInSeconds * 1000) }
        : {})), (token.igUserId ? { igUserId: token.igUserId } : {})), (token.pageId ? { pageId: token.pageId } : {})), (token.channelId ? { channelId: token.channelId } : {})), { updatedAt: FieldValue.serverTimestamp() }), { merge: true });
}
// --- callables ---
exports.getSocialConnectUrl = (0, https_1.onCall)(Object.assign(Object.assign({}, core_1.callableSecurity), { secrets: [exports.metaAppId, exports.linkedinClientId, exports.googleOAuthClientId, exports.oauthStateSecret] }), async (request) => {
    var _a, _b;
    const uid = (0, core_1.requireAuth)(request);
    const provider = (_a = request.data) === null || _a === void 0 ? void 0 : _a.provider;
    if (provider !== "instagram" && provider !== "linkedin" && provider !== "youtube") {
        throw new https_1.HttpsError("invalid-argument", "provider must be 'instagram', 'linkedin' or 'youtube'");
    }
    // Only accept a same-app relative path to avoid open-redirects.
    const rawReturn = (_b = request.data) === null || _b === void 0 ? void 0 : _b.returnTo;
    const returnTo = rawReturn && /^\/[A-Za-z0-9/_-]*$/.test(rawReturn) ? rawReturn : undefined;
    const nonce = (0, node_crypto_1.randomBytes)(16).toString("hex");
    const expiresAt = Date.now() + 600000;
    const state = signState(Object.assign(Object.assign({ uid,
        provider }, (returnTo ? { returnTo } : {})), { n: nonce, exp: expiresAt }));
    await core_1.db.collection("oauthStates").doc(nonce).create(Object.assign(Object.assign({ uid,
        provider }, (returnTo ? { returnTo } : {})), { expiresAt: Timestamp.fromMillis(expiresAt), createdAt: FieldValue.serverTimestamp() }));
    const redirect = callbackUrl();
    let url;
    if (provider === "instagram") {
        const scope = [
            "instagram_basic",
            "instagram_content_publish",
            "pages_show_list",
            "pages_read_engagement",
            "business_management",
        ].join(",");
        const params = new URLSearchParams({
            client_id: exports.metaAppId.value(),
            redirect_uri: redirect,
            state,
            response_type: "code",
            scope,
        });
        url = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
    }
    else if (provider === "youtube") {
        const params = new URLSearchParams({
            client_id: exports.googleOAuthClientId.value(),
            redirect_uri: redirect,
            state,
            response_type: "code",
            scope: [
                "https://www.googleapis.com/auth/youtube.upload",
                "https://www.googleapis.com/auth/youtube.readonly",
            ].join(" "),
            // offline + consent so Google always returns a refresh token
            access_type: "offline",
            prompt: "consent",
        });
        url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    else {
        const params = new URLSearchParams({
            response_type: "code",
            client_id: exports.linkedinClientId.value(),
            redirect_uri: redirect,
            state,
            scope: "openid profile w_member_social",
        });
        url = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    }
    return { url };
});
exports.disconnectSocialAccount = (0, https_1.onCall)(Object.assign({}, core_1.callableSecurity), async (request) => {
    var _a, _b, _c;
    const uid = (0, core_1.requireAuth)(request);
    const id = ((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.accountId) !== null && _b !== void 0 ? _b : "").toString().trim();
    if (!id)
        throw new https_1.HttpsError("invalid-argument", "accountId is required");
    // Prefer direct doc id (deterministic: `{uid}_{provider}_{externalId}`).
    let ref = core_1.db.collection("socialAccounts").doc(id);
    let snap = await ref.get();
    // Fallback: client may send an older/external id — resolve among this user's rows.
    if (!snap.exists || ((_c = snap.data()) === null || _c === void 0 ? void 0 : _c.userId) !== uid) {
        const owned = await core_1.db
            .collection("socialAccounts")
            .where("userId", "==", uid)
            .get();
        const match = owned.docs.find((d) => {
            var _a, _b, _c;
            return d.id === id ||
                ((_a = d.data()) === null || _a === void 0 ? void 0 : _a.externalId) === id ||
                `${(_b = d.data()) === null || _b === void 0 ? void 0 : _b.provider}` === id ||
                `${(_c = d.data()) === null || _c === void 0 ? void 0 : _c.platform}` === id;
        });
        if (!match) {
            console.warn("disconnectSocialAccount: not found", {
                uid,
                id,
                owned: owned.docs.map((d) => d.id),
            });
            throw new https_1.HttpsError("not-found", "Account not found");
        }
        ref = match.ref;
        snap = match;
    }
    const accountId = snap.id;
    await core_1.db.collection("socialTokens").doc(accountId).delete().catch(() => { });
    // Soft-mark first so a partial failure still hides the channel in the UI.
    await ref.set({ status: "disconnected" }, { merge: true }).catch(() => { });
    await ref.delete();
    return { success: true, accountId };
});
// --- provider token exchange + profile ---
async function graphJson(url) {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok)
        throw new Error(`Meta Graph error (${res.status}): ${text}`);
    return JSON.parse(text);
}
async function connectInstagram(uid, code) {
    var _a, _b, _c;
    const redirect = callbackUrl();
    // 1) short-lived token
    const short = await graphJson(`${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
            client_id: exports.metaAppId.value(),
            client_secret: exports.metaAppSecret.value(),
            redirect_uri: redirect,
            code,
        }).toString());
    // 2) long-lived user token (~60 days)
    const long = await graphJson(`${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
            grant_type: "fb_exchange_token",
            client_id: exports.metaAppId.value(),
            client_secret: exports.metaAppSecret.value(),
            fb_exchange_token: short.access_token,
        }).toString());
    // 3) pages the user manages, with the connected IG business account
    const pages = await graphJson(`${GRAPH}/me/accounts?` +
        new URLSearchParams({
            fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
            access_token: long.access_token,
        }).toString());
    const withIg = pages.data.filter((p) => { var _a; return (_a = p.instagram_business_account) === null || _a === void 0 ? void 0 : _a.id; });
    if (withIg.length === 0) {
        throw new Error("no_ig_business_account: connect an Instagram Business or Creator account to a Facebook Page first");
    }
    for (const page of withIg) {
        const ig = page.instagram_business_account;
        await storeAccount(uid, "instagram", {
            externalId: ig.id,
            username: (_a = ig.username) !== null && _a !== void 0 ? _a : page.name,
            displayName: (_c = (_b = ig.name) !== null && _b !== void 0 ? _b : ig.username) !== null && _c !== void 0 ? _c : page.name,
            avatarUrl: ig.profile_picture_url,
        }, {
            // page access token is what's used for content publishing
            accessToken: page.access_token,
            expiresInSeconds: long.expires_in,
            igUserId: ig.id,
            pageId: page.id,
        });
    }
}
async function connectLinkedIn(uid, code) {
    var _a, _b, _c;
    const redirect = callbackUrl();
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirect,
            client_id: exports.linkedinClientId.value(),
            client_secret: exports.linkedinClientSecret.value(),
        }).toString(),
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok)
        throw new Error(`LinkedIn token error (${tokenRes.status}): ${tokenText}`);
    const token = JSON.parse(tokenText);
    const infoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const infoText = await infoRes.text();
    if (!infoRes.ok)
        throw new Error(`LinkedIn userinfo error (${infoRes.status}): ${infoText}`);
    const info = JSON.parse(infoText);
    await storeAccount(uid, "linkedin", {
        externalId: `urn:li:person:${info.sub}`,
        username: (_b = (_a = info.name) !== null && _a !== void 0 ? _a : info.email) !== null && _b !== void 0 ? _b : "LinkedIn member",
        displayName: (_c = info.name) !== null && _c !== void 0 ? _c : "LinkedIn member",
        avatarUrl: info.picture,
    }, { accessToken: token.access_token, expiresInSeconds: token.expires_in });
}
async function connectYouTube(uid, code) {
    var _a, _b, _c, _d;
    const redirect = callbackUrl();
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirect,
            client_id: exports.googleOAuthClientId.value(),
            client_secret: exports.googleOAuthClientSecret.value(),
        }).toString(),
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok)
        throw new Error(`Google token error (${tokenRes.status}): ${tokenText}`);
    const token = JSON.parse(tokenText);
    const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const channelText = await channelRes.text();
    if (!channelRes.ok) {
        throw new Error(`YouTube channels error (${channelRes.status}): ${channelText}`);
    }
    const channels = JSON.parse(channelText);
    const channel = (_a = channels.items) === null || _a === void 0 ? void 0 : _a[0];
    if (!channel) {
        throw new Error("no_youtube_channel: this Google account has no YouTube channel");
    }
    await storeAccount(uid, "youtube", {
        externalId: channel.id,
        username: (_b = channel.snippet.customUrl) !== null && _b !== void 0 ? _b : channel.snippet.title,
        displayName: channel.snippet.title,
        avatarUrl: (_d = (_c = channel.snippet.thumbnails) === null || _c === void 0 ? void 0 : _c.default) === null || _d === void 0 ? void 0 : _d.url,
    }, {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresInSeconds: token.expires_in,
        channelId: channel.id,
    });
}
exports.socialOAuthCallback = (0, https_2.onRequest)({
    cors: false,
    secrets: [
        exports.metaAppId,
        exports.metaAppSecret,
        exports.linkedinClientId,
        exports.linkedinClientSecret,
        exports.googleOAuthClientId,
        exports.googleOAuthClientSecret,
        exports.oauthStateSecret,
    ],
}, async (req, res) => {
    var _a;
    const done = (params, path = "/settings") => {
        const q = new URLSearchParams(params).toString();
        res.redirect(303, `${APP_BASE_URL}${path}?${q}`);
    };
    const err = typeof req.query.error === "string" ? req.query.error : undefined;
    if (err) {
        done({ social: "error", reason: String((_a = req.query.error_description) !== null && _a !== void 0 ? _a : err) });
        return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const stateRaw = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!code || !stateRaw) {
        done({ social: "error", reason: "missing_code_or_state" });
        return;
    }
    let state;
    try {
        state = verifyState(stateRaw);
        await consumeState(state);
    }
    catch (e) {
        done({ social: "error", reason: `invalid_state: ${(0, core_1.stringifyError)(e)}` });
        return;
    }
    const returnPath = state.returnTo || "/settings";
    try {
        if (state.provider === "instagram") {
            await connectInstagram(state.uid, code);
        }
        else if (state.provider === "youtube") {
            await connectYouTube(state.uid, code);
        }
        else {
            await connectLinkedIn(state.uid, code);
        }
        done({ social: "connected", provider: state.provider }, returnPath);
    }
    catch (e) {
        console.error("[socialOAuthCallback] failed:", e);
        done({ social: "error", provider: state.provider, reason: (0, core_1.stringifyError)(e) }, returnPath);
    }
});
//# sourceMappingURL=social.js.map