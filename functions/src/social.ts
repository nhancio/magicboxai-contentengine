// Direct OAuth connection for Instagram (via the Meta Graph API), LinkedIn,
// and YouTube (Google OAuth).
// Replaces the Post Bridge aggregator. Two callables build the consent URL and
// disconnect an account; one HTTP endpoint handles the provider redirect.
//
// Access tokens are written to `socialTokens/{accountId}` which is NEVER
// client-readable (see firestore.rules). The client only reads `socialAccounts`.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { createHmac, randomBytes } from "node:crypto";
import { db, requireAuth, stringifyError } from "./core";
import type { SocialProvider, SocialPlatform } from "./core";

export const metaAppId = defineSecret("META_APP_ID");
export const metaAppSecret = defineSecret("META_APP_SECRET");
export const linkedinClientId = defineSecret("LINKEDIN_CLIENT_ID");
export const linkedinClientSecret = defineSecret("LINKEDIN_CLIENT_SECRET");
export const googleOAuthClientId = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
export const googleOAuthClientSecret = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");
export const oauthStateSecret = defineSecret("OAUTH_STATE_SECRET");

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
function callbackUrl(): string {
  if (process.env.OAUTH_CALLBACK_URL) return process.env.OAUTH_CALLBACK_URL;
  const project = process.env.GCLOUD_PROJECT || "magicboxai-50927";
  return `https://us-central1-${project}.cloudfunctions.net/socialOAuthCallback`;
}

// --- signed state (uid + provider, HMAC, short TTL) ---

interface StatePayload {
  uid: string;
  provider: SocialProvider;
  /** App path to return to after the round-trip, e.g. "/onboarding". */
  returnTo?: string;
  n: string;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signState(payload: StatePayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", oauthStateSecret.value()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(token: string): StatePayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("Malformed state");
  const expected = createHmac("sha256", oauthStateSecret.value()).update(body).digest("base64url");
  if (sig !== expected) throw new Error("Bad state signature");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
  if (payload.exp < Date.now()) throw new Error("State expired");
  return payload;
}

// --- storage ---

function accountId(uid: string, provider: SocialProvider, externalId: string): string {
  const safe = externalId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80);
  return `${uid}_${provider}_${safe}`;
}

async function storeAccount(
  uid: string,
  provider: SocialProvider,
  profile: {
    externalId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  },
  token: {
    accessToken: string;
    refreshToken?: string;
    expiresInSeconds?: number;
    igUserId?: string;
    pageId?: string;
    channelId?: string;
  }
): Promise<void> {
  const id = accountId(uid, provider, profile.externalId);
  const platform: SocialPlatform = provider; // instagram|linkedin|youtube map 1:1

  await db.collection("socialAccounts").doc(id).set(
    {
      userId: uid,
      provider,
      platform,
      externalId: profile.externalId,
      username: profile.username,
      displayName: profile.displayName || profile.username,
      avatarUrl: profile.avatarUrl ?? "",
      status: "active",
      linkedAt: FieldValue.serverTimestamp(),
      lastSyncedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection("socialTokens").doc(id).set(
    {
      userId: uid,
      provider,
      accessToken: token.accessToken,
      ...(token.refreshToken ? { refreshToken: token.refreshToken } : {}),
      ...(token.expiresInSeconds
        ? { expiresAt: Timestamp.fromMillis(Date.now() + token.expiresInSeconds * 1000) }
        : {}),
      ...(token.igUserId ? { igUserId: token.igUserId } : {}),
      ...(token.pageId ? { pageId: token.pageId } : {}),
      ...(token.channelId ? { channelId: token.channelId } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// --- callables ---

export const getSocialConnectUrl = onCall(
  { cors: true, secrets: [metaAppId, linkedinClientId, googleOAuthClientId, oauthStateSecret] },
  async (request: CallableRequest<{ provider: SocialProvider; returnTo?: string }>) => {
    const uid = requireAuth(request);
    const provider = request.data?.provider;
    if (provider !== "instagram" && provider !== "linkedin" && provider !== "youtube") {
      throw new HttpsError(
        "invalid-argument",
        "provider must be 'instagram', 'linkedin' or 'youtube'"
      );
    }

    // Only accept a same-app relative path to avoid open-redirects.
    const rawReturn = request.data?.returnTo;
    const returnTo = rawReturn && /^\/[A-Za-z0-9/_-]*$/.test(rawReturn) ? rawReturn : undefined;

    const state = signState({
      uid,
      provider,
      ...(returnTo ? { returnTo } : {}),
      n: randomBytes(8).toString("hex"),
      exp: Date.now() + 600_000,
    });
    const redirect = callbackUrl();

    let url: string;
    if (provider === "instagram") {
      const scope = [
        "instagram_basic",
        "instagram_content_publish",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
      ].join(",");
      const params = new URLSearchParams({
        client_id: metaAppId.value(),
        redirect_uri: redirect,
        state,
        response_type: "code",
        scope,
      });
      url = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
    } else if (provider === "youtube") {
      const params = new URLSearchParams({
        client_id: googleOAuthClientId.value(),
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
    } else {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: linkedinClientId.value(),
        redirect_uri: redirect,
        state,
        scope: "openid profile w_member_social",
      });
      url = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    }

    return { url };
  }
);

export const disconnectSocialAccount = onCall(
  { cors: true },
  async (request: CallableRequest<{ accountId: string }>) => {
    const uid = requireAuth(request);
    const id = (request.data?.accountId ?? "").toString().trim();
    if (!id) throw new HttpsError("invalid-argument", "accountId is required");

    // Prefer direct doc id (deterministic: `{uid}_{provider}_{externalId}`).
    let ref = db.collection("socialAccounts").doc(id);
    let snap = await ref.get();

    // Fallback: client may send an older/external id — resolve among this user's rows.
    if (!snap.exists || snap.data()?.userId !== uid) {
      const owned = await db
        .collection("socialAccounts")
        .where("userId", "==", uid)
        .get();
      const match = owned.docs.find(
        (d) =>
          d.id === id ||
          d.data()?.externalId === id ||
          `${d.data()?.provider}` === id ||
          `${d.data()?.platform}` === id
      );
      if (!match) {
        console.warn("disconnectSocialAccount: not found", {
          uid,
          id,
          owned: owned.docs.map((d) => d.id),
        });
        throw new HttpsError("not-found", "Account not found");
      }
      ref = match.ref;
      snap = match;
    }

    const accountId = snap.id;
    await db.collection("socialTokens").doc(accountId).delete().catch(() => {});
    // Soft-mark first so a partial failure still hides the channel in the UI.
    await ref.set({ status: "disconnected" }, { merge: true }).catch(() => {});
    await ref.delete();
    return { success: true, accountId };
  }
);

// --- provider token exchange + profile ---

async function graphJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`Meta Graph error (${res.status}): ${text}`);
  return JSON.parse(text) as T;
}

async function connectInstagram(uid: string, code: string): Promise<void> {
  const redirect = callbackUrl();
  // 1) short-lived token
  const short = await graphJson<{ access_token: string }>(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        client_id: metaAppId.value(),
        client_secret: metaAppSecret.value(),
        redirect_uri: redirect,
        code,
      }).toString()
  );
  // 2) long-lived user token (~60 days)
  const long = await graphJson<{ access_token: string; expires_in?: number }>(
    `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: metaAppId.value(),
        client_secret: metaAppSecret.value(),
        fb_exchange_token: short.access_token,
      }).toString()
  );
  // 3) pages the user manages, with the connected IG business account
  const pages = await graphJson<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: {
        id: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      };
    }>;
  }>(
    `${GRAPH}/me/accounts?` +
      new URLSearchParams({
        fields:
          "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
        access_token: long.access_token,
      }).toString()
  );

  const withIg = pages.data.filter((p) => p.instagram_business_account?.id);
  if (withIg.length === 0) {
    throw new Error(
      "no_ig_business_account: connect an Instagram Business or Creator account to a Facebook Page first"
    );
  }

  for (const page of withIg) {
    const ig = page.instagram_business_account!;
    await storeAccount(
      uid,
      "instagram",
      {
        externalId: ig.id,
        username: ig.username ?? page.name,
        displayName: ig.name ?? ig.username ?? page.name,
        avatarUrl: ig.profile_picture_url,
      },
      {
        // page access token is what's used for content publishing
        accessToken: page.access_token,
        expiresInSeconds: long.expires_in,
        igUserId: ig.id,
        pageId: page.id,
      }
    );
  }
}

async function connectLinkedIn(uid: string, code: string): Promise<void> {
  const redirect = callbackUrl();
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      client_id: linkedinClientId.value(),
      client_secret: linkedinClientSecret.value(),
    }).toString(),
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) throw new Error(`LinkedIn token error (${tokenRes.status}): ${tokenText}`);
  const token = JSON.parse(tokenText) as { access_token: string; expires_in?: number };

  const infoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const infoText = await infoRes.text();
  if (!infoRes.ok) throw new Error(`LinkedIn userinfo error (${infoRes.status}): ${infoText}`);
  const info = JSON.parse(infoText) as {
    sub: string;
    name?: string;
    picture?: string;
    email?: string;
  };

  await storeAccount(
    uid,
    "linkedin",
    {
      externalId: `urn:li:person:${info.sub}`,
      username: info.name ?? info.email ?? "LinkedIn member",
      displayName: info.name ?? "LinkedIn member",
      avatarUrl: info.picture,
    },
    { accessToken: token.access_token, expiresInSeconds: token.expires_in }
  );
}

async function connectYouTube(uid: string, code: string): Promise<void> {
  const redirect = callbackUrl();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      client_id: googleOAuthClientId.value(),
      client_secret: googleOAuthClientSecret.value(),
    }).toString(),
  });
  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) throw new Error(`Google token error (${tokenRes.status}): ${tokenText}`);
  const token = JSON.parse(tokenText) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${token.access_token}` } }
  );
  const channelText = await channelRes.text();
  if (!channelRes.ok) {
    throw new Error(`YouTube channels error (${channelRes.status}): ${channelText}`);
  }
  const channels = JSON.parse(channelText) as {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        customUrl?: string;
        thumbnails?: { default?: { url?: string } };
      };
    }>;
  };
  const channel = channels.items?.[0];
  if (!channel) {
    throw new Error("no_youtube_channel: this Google account has no YouTube channel");
  }

  await storeAccount(
    uid,
    "youtube",
    {
      externalId: channel.id,
      username: channel.snippet.customUrl ?? channel.snippet.title,
      displayName: channel.snippet.title,
      avatarUrl: channel.snippet.thumbnails?.default?.url,
    },
    {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresInSeconds: token.expires_in,
      channelId: channel.id,
    }
  );
}

// --- redirect handler ---

function redirectHtml(target: string): string {
  const safe = target.replace(/"/g, "%22");
  return `<!doctype html><meta http-equiv="refresh" content="0;url=${safe}"><a href="${safe}">Continue</a>`;
}

export const socialOAuthCallback = onRequest(
  {
    cors: false,
    secrets: [
      metaAppId,
      metaAppSecret,
      linkedinClientId,
      linkedinClientSecret,
      googleOAuthClientId,
      googleOAuthClientSecret,
      oauthStateSecret,
    ],
  },
  async (req, res) => {
    const done = (params: Record<string, string>, path = "/settings") => {
      const q = new URLSearchParams(params).toString();
      res.status(200).send(redirectHtml(`${APP_BASE_URL}${path}?${q}`));
    };

    const err = req.query.error as string | undefined;
    if (err) {
      done({ social: "error", reason: String(req.query.error_description ?? err) });
      return;
    }

    const code = req.query.code as string | undefined;
    const stateRaw = req.query.state as string | undefined;
    if (!code || !stateRaw) {
      done({ social: "error", reason: "missing_code_or_state" });
      return;
    }

    let state: StatePayload;
    try {
      state = verifyState(stateRaw);
    } catch (e: unknown) {
      done({ social: "error", reason: `invalid_state: ${stringifyError(e)}` });
      return;
    }

    const returnPath = state.returnTo || "/settings";
    try {
      if (state.provider === "instagram") {
        await connectInstagram(state.uid, code);
      } else if (state.provider === "youtube") {
        await connectYouTube(state.uid, code);
      } else {
        await connectLinkedIn(state.uid, code);
      }
      done({ social: "connected", provider: state.provider }, returnPath);
    } catch (e: unknown) {
      console.error("[socialOAuthCallback] failed:", e);
      done({ social: "error", provider: state.provider, reason: stringifyError(e) }, returnPath);
    }
  }
);
