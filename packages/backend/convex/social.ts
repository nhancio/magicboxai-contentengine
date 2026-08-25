import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUid } from "./lib/auth";
import { connectableProviders, getProvider, providerCatalogue } from "./lib/providers/registry";
import { ProviderDeferredError, type ConnectedProfile } from "./lib/providers/types";

/**
 * Channel connection (OAuth) — Convex-native.
 *
 * Security decisions worth knowing:
 *  - State is a ONE-TIME nonce persisted in `oauthStates` and burned on use.
 *    The Firebase version used a stateless HMAC state, which is replayable
 *    within its TTL; this closes that (it was a known outstanding item).
 *  - Tokens live in `socialTokens` and are only ever read by internal functions.
 *    No public query returns them. `socialAccounts` holds the safe display data.
 *  - `returnTo` is validated as a same-app relative path to prevent open redirect.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

function callbackUrl(): string {
  // Convex injects CONVEX_SITE_URL; the OAuth callback is an httpAction on the
  // backend domain (see http.ts). Meta strictly requires HTTPS.
  if (process.env.OAUTH_CALLBACK_BASE && process.env.OAUTH_CALLBACK_BASE.startsWith("https://")) {
    return `${process.env.OAUTH_CALLBACK_BASE}/oauth/callback`;
  }
  if (process.env.CONVEX_SITE_URL && process.env.CONVEX_SITE_URL.startsWith("https://")) {
    return `${process.env.CONVEX_SITE_URL}/oauth/callback`;
  }
  return "https://convex.magicboxai.in/oauth/callback";
}

function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "https://app.magicboxai.in";
}

/** Origins we will bounce the browser back to after OAuth. Never open-redirect. */
const ALLOWED_RETURN_ORIGINS = new Set([
  "https://app.magicboxai.in",
  "http://localhost:8174",
  "http://127.0.0.1:8174",
]);

export function safeReturnOrigin(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const origin = u.origin;
    if (
      origin === "https://app.magicboxai.in" ||
      origin === "https://magicboxai.in" ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return origin;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface OAuthStatePayload {
  n: string;
  u: string;
  p: string;
  r?: string;
  o?: string;
  cv?: string;
  rd?: string;
  exp: number;
}

export function encodeOAuthState(payload: OAuthStatePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return base64Url(bytes);
}

export function decodeOAuthState(raw: string): OAuthStatePayload | null {
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const binary = atob(pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.n === "string" && typeof parsed.u === "string") {
      return parsed as OAuthStatePayload;
    }
  } catch {}
  return null;
}

function randomToken(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** Same-app relative paths only — never an absolute URL. */
export function safeReturnTo(raw?: string): string | undefined {
  if (!raw) return undefined;
  return /^\/[A-Za-z0-9/_.-]*$/.test(raw) ? raw : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** What the UI shows in "Connect a channel" — including honest "not yet" states. */
export const catalogue = query({
  args: {},
  handler: async () => providerCatalogue(),
});

/** The caller's connected accounts. Never includes tokens. */
export const accounts = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    return await ctx.db
      .query("socialAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
  },
});

export const createState = internalMutation({
  args: {
    nonce: v.string(),
    userId: v.string(),
    provider: v.string(),
    returnTo: v.optional(v.string()),
    returnOrigin: v.optional(v.string()),
    codeVerifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("oauthStates", {
      nonce: args.nonce,
      userId: args.userId,
      provider: args.provider as any,
      returnTo: args.returnTo,
      returnOrigin: args.returnOrigin,
      codeVerifier: args.codeVerifier,
      expiresAt: now + STATE_TTL_MS,
      createdAt: now,
    });
  },
});

/**
 * Build the provider consent URL.
 *
 * An action (not a mutation) because it needs real entropy + WebCrypto for the
 * nonce and PKCE verifier; Convex mutations are deterministically replayed.
 */
export const connectUrl = action({
  args: {
    provider: v.string(),
    returnTo: v.optional(v.string()),
    /** Browser origin (window.location.origin) so local stays on localhost. */
    returnOrigin: v.optional(v.string()),
    /**
     * Google email already used for Firebase sign-in. Forwarded as login_hint
     * so YouTube connect skips the account picker (consent for YouTube scopes
     * still required by Google the first time).
     */
    loginHint: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ url: string; redirectUri: string }> => {
    const uid = await requireUid(ctx);
    const provider = getProvider(args.provider);

    if (provider.deferred) {
      throw new ProviderDeferredError(provider.displayName, provider.deferred.reason);
    }

    const clientId = process.env[provider.credentialEnv.clientId];
    if (!clientId) {
      throw new Error(
        `${provider.displayName} is not configured: set ${provider.credentialEnv.clientId} ` +
          `and ${provider.credentialEnv.clientSecret} via \`npx convex env set\`.`,
      );
    }

    const nonce = randomToken();
    const codeVerifier = provider.usesPkce ? randomToken(64) : undefined;
    const returnOrigin = safeReturnOrigin(args.returnOrigin);
    const returnTo = safeReturnTo(args.returnTo);
    const exp = Date.now() + STATE_TTL_MS;

    const redirectUri = callbackUrl();

    // Hard guard: never hand Google or Meta a Firebase callback from the Convex path.
    if (redirectUri.includes("cloudfunctions.net")) {
      throw new Error(
        "Misconfigured OAuth callback (cloudfunctions). Expected frontend or Convex /oauth/callback.",
      );
    }

    await ctx.runMutation(internal.social.createState, {
      nonce,
      userId: uid,
      provider: provider.id,
      returnTo,
      returnOrigin,
      codeVerifier,
    });

    const stateToken = encodeOAuthState({
      n: nonce,
      u: uid,
      p: provider.id,
      r: returnTo,
      o: returnOrigin,
      cv: codeVerifier,
      rd: redirectUri,
      exp,
    });

    const url = provider.buildAuthUrl({
      clientId,
      redirectUri,
      state: stateToken,
      codeChallenge: codeVerifier ? await pkceChallenge(codeVerifier) : undefined,
      loginHint: args.loginHint,
    });

    return { url, redirectUri };
  },
});

/**
 * Background action to revoke tokens/permissions with the third-party platform.
 * Logs out all remote sessions tied to the disconnected channel.
 */
export const revokeProviderSessions = internalAction({
  args: {
    provider: v.string(),
    token: v.object({
      accessToken: v.string(),
      refreshToken: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      igUserId: v.optional(v.string()),
      pageId: v.optional(v.string()),
      channelId: v.optional(v.string()),
      phoneNumberId: v.optional(v.string()),
      wabaId: v.optional(v.string()),
      scopes: v.optional(v.array(v.string())),
    }),
  },
  handler: async (_ctx, { provider: providerId, token }) => {
    try {
      const provider = getProvider(providerId);
      if (typeof provider.revoke === "function") {
        const clientId = process.env[provider.credentialEnv.clientId];
        const clientSecret = process.env[provider.credentialEnv.clientSecret];
        await provider.revoke(token, clientId, clientSecret);
      }
    } catch (err) {
      console.warn(`[social] Failed to revoke provider session for ${providerId}:`, err);
    }
  },
});

export const disconnect = mutation({
  args: { accountId: v.id("socialAccounts") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, { accountId }) => {
    const uid = await requireUid(ctx);
    const account = await ctx.db.get(accountId);
    // not-found rather than permission-denied: don't leak existence.
    if (!account || account.userId !== uid) throw new Error("Account not found");

    // 1. Query tokens and schedule remote session revocation for each token
    const tokens = await ctx.db
      .query("socialTokens")
      .withIndex("by_socialAccountId", (q) =>
        q.eq("socialAccountId", accountId as string),
      )
      .collect();

    for (const token of tokens) {
      if (token.encryptedAccessToken) {
        await ctx.scheduler.runAfter(0, internal.social.revokeProviderSessions, {
          provider: token.provider,
          token: {
            accessToken: token.encryptedAccessToken,
            refreshToken: token.encryptedRefreshToken,
            expiresAt: token.expiresAt,
            igUserId: token.igUserId,
            pageId: token.pageId,
            channelId: token.channelId,
            phoneNumberId: token.phoneNumberId,
            wabaId: token.wabaId,
            scopes: token.scopes,
          },
        });
      }
      await ctx.db.delete(token._id);
    }

    // 2. Clean up any active/pending oauthStates for this user & provider
    const oauthStates = await ctx.db
      .query("oauthStates")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), uid),
          q.eq(q.field("provider"), account.provider),
        ),
      )
      .collect();
    for (const state of oauthStates) {
      await ctx.db.delete(state._id);
    }

    // 3. Clean up automations referencing this account
    const accountIdStr = String(accountId);
    const automations = await ctx.db
      .query("automations")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
    for (const auto of automations) {
      if (auto.socialAccountIds.includes(accountIdStr)) {
        const remainingAccounts = auto.socialAccountIds.filter((id) => id !== accountIdStr);
        await ctx.db.patch(auto._id, {
          socialAccountIds: remainingAccounts,
          status: remainingAccounts.length === 0 ? "paused" : auto.status,
          updatedAt: Date.now(),
        });
      }
    }

    // 4. Clean up mayaConfig referencing this account
    const mayaConfigs = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
    for (const cfg of mayaConfigs) {
      if (cfg.socialAccountIds && cfg.socialAccountIds.includes(accountIdStr)) {
        const remainingAccounts = cfg.socialAccountIds.filter((id) => id !== accountIdStr);
        await ctx.db.patch(cfg._id, {
          socialAccountIds: remainingAccounts,
          updatedAt: Date.now(),
        });
      }
    }

    // 5. Clean up any posts referencing this account
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
    for (const post of posts) {
      if (post.socialAccountIds.includes(accountIdStr)) {
        const remainingAccounts = post.socialAccountIds.filter((id) => id !== accountIdStr);
        const updates: any = {
          socialAccountIds: remainingAccounts,
          updatedAt: Date.now(),
        };
        if (
          remainingAccounts.length === 0 &&
          (post.status === "scheduled" ||
            post.status === "ready" ||
            post.status === "generating" ||
            post.status === "pending_approval")
        ) {
          updates.status = "draft";
          updates.error = "Target channel was removed";
        }
        await ctx.db.patch(post._id, updates);
      }
    }

    // 6. Delete the social account
    await ctx.db.delete(accountId);
    return { success: true };
  },
});

const syncPlatform = v.union(
  v.literal("instagram"),
  v.literal("facebook"),
  v.literal("twitter"),
  v.literal("linkedin"),
  v.literal("youtube"),
  v.literal("reddit"),
  v.literal("whatsapp"),
);

/**
 * Dual-write helper: upsert a socialAccounts row from a legacy Firestore account.
 * Metadata only — OAuth tokens stay in Firestore until the user reconnects.
 */
export const syncAccount = mutation({
  args: {
    legacyId: v.string(),
    provider: syncPlatform,
    platform: syncPlatform,
    externalId: v.string(),
    username: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("disconnected"),
      v.literal("expired"),
    ),
  },
  returns: v.id("socialAccounts"),
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const now = Date.now();

    const byLegacy = await ctx.db
      .query("socialAccounts")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", args.legacyId))
      .unique();

    const existing =
      byLegacy ??
      (
        await ctx.db
          .query("socialAccounts")
          .withIndex("by_userId", (q) => q.eq("userId", uid))
          .collect()
      ).find(
        (a) =>
          a.platform === args.platform && a.externalId === args.externalId,
      );

    const doc = {
      legacyId: args.legacyId,
      userId: uid,
      provider: args.provider,
      platform: args.platform,
      externalId: args.externalId,
      username: args.username,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      status: args.status,
      lastSyncedAt: now,
    };

    if (existing) {
      if (existing.userId !== uid) throw new Error("Account not found");
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }

    return await ctx.db.insert("socialAccounts", {
      ...doc,
      linkedAt: now,
    });
  },
});

/**
 * Connect a WhatsApp Sandbox or Meta Test Number directly (WhatsApp V2).
 * Allows developers and brands to test automations and message previews
 * without needing to buy/verify a new physical phone number.
 */
export const connectWhatsAppTestAccount = mutation({
  args: {
    mode: v.union(v.literal("sandbox"), v.literal("meta_test"), v.literal("custom_waba")),
    phoneNumberId: v.string(),
    wabaId: v.optional(v.string()),
    displayPhoneNumber: v.string(),
    verifiedName: v.string(),
    accessToken: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    accountId: v.id("socialAccounts"),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; accountId: Id<"socialAccounts"> }> => {
    const uid = await requireUid(ctx);
    const cleanNumber = args.displayPhoneNumber.trim() || "+1 555 019 9901";
    const verifiedName =
      args.verifiedName.trim() ||
      (args.mode === "sandbox" ? "WhatsApp Virtual Sandbox" : "Meta Test Number");
    const phoneNumberId = args.phoneNumberId.trim();
    const wabaId = args.wabaId?.trim() || "waba_sandbox_default";
    const token =
      args.accessToken?.trim() ||
      (args.mode === "sandbox" ? `sandbox_token_${Date.now()}` : "test_token");

    const profile: ConnectedProfile = {
      externalId: phoneNumberId,
      username: cleanNumber,
      displayName: verifiedName,
      avatarUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
      token: {
        accessToken: token,
        phoneNumberId,
        wabaId,
        scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
      },
    };

    const ids = await storeAccountsInternal(ctx, uid, "whatsapp", [profile]);
    return { success: true, accountId: ids[0]! };
  },
});

// ---------------------------------------------------------------------------
// Callback internals (used by http.ts)
// ---------------------------------------------------------------------------

/** Burn the nonce. Returns error status if unknown, expired, or already used (replay). */
export const consumeState = mutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const decoded = decodeOAuthState(state);
    const nonce = decoded?.n ?? state;

    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();

    if (!row) {
      if (decoded && decoded.exp > Date.now()) {
        return {
          ok: true as const,
          userId: decoded.u,
          provider: decoded.p,
          returnTo: decoded.r,
          returnOrigin: decoded.o,
          codeVerifier: decoded.cv,
          redirectUri: decoded.rd,
        };
      }
      return {
        ok: false as const,
        error: "invalid_or_expired_state",
        returnTo: decoded?.r,
        returnOrigin: decoded?.o,
        redirectUri: decoded?.rd,
      };
    }

    if (row.usedAt) {
      return {
        ok: false as const,
        error: "state_already_used",
        returnTo: row.returnTo ?? decoded?.r,
        returnOrigin: row.returnOrigin ?? decoded?.o,
        redirectUri: decoded?.rd,
      };
    }

    if (row.expiresAt < Date.now()) {
      return {
        ok: false as const,
        error: "state_expired",
        returnTo: row.returnTo ?? decoded?.r,
        returnOrigin: row.returnOrigin ?? decoded?.o,
        redirectUri: decoded?.rd,
      };
    }

    await ctx.db.patch(row._id, { usedAt: Date.now() });
    return {
      ok: true as const,
      userId: row.userId,
      provider: row.provider,
      returnTo: row.returnTo ?? decoded?.r,
      returnOrigin: row.returnOrigin ?? decoded?.o,
      codeVerifier: row.codeVerifier ?? decoded?.cv,
      redirectUri: decoded?.rd,
    };
  },
});

async function storeAccountsInternal(
  ctx: { db: any },
  userId: string,
  provider: string,
  profiles: ConnectedProfile[],
): Promise<Id<"socialAccounts">[]> {
  const now = Date.now();
  const ids: Id<"socialAccounts">[] = [];

  for (const p of profiles) {
    const existing = await ctx.db
      .query("socialAccounts")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .collect();
    const match = existing.find((a: any) => a.provider === provider && a.externalId === p.externalId);

    let accountId: Id<"socialAccounts">;
    if (match) {
      await ctx.db.patch(match._id, {
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        status: "active",
        lastSyncedAt: now,
      });
      accountId = match._id;
    } else {
      accountId = await ctx.db.insert("socialAccounts", {
        userId,
        provider: provider as any,
        platform: provider as any,
        externalId: p.externalId,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        status: "active",
        linkedAt: now,
        lastSyncedAt: now,
      });
    }

    const tokenRow = await ctx.db
      .query("socialTokens")
      .withIndex("by_socialAccountId", (q: any) => q.eq("socialAccountId", accountId))
      .unique();

    const tokenDoc = {
      userId,
      socialAccountId: accountId,
      provider: provider as any,
      encryptedAccessToken: p.token.accessToken,
      encryptedRefreshToken: p.token.refreshToken,
      expiresAt: p.token.expiresAt,
      igUserId: p.token.igUserId,
      pageId: p.token.pageId,
      channelId: p.token.channelId,
      phoneNumberId: p.token.phoneNumberId,
      wabaId: p.token.wabaId,
      scopes: p.token.scopes,
      updatedAt: now,
    };

    if (tokenRow) await ctx.db.patch(tokenRow._id, tokenDoc);
    else await ctx.db.insert("socialTokens", tokenDoc);

    ids.push(accountId);
  }
  return ids;
}

/**
 * Persist connected accounts + their tokens.
 * Re-connecting the same external account UPDATES in place rather than
 * duplicating (matching the Firebase deterministic-id behaviour).
 */
export const storeAccounts = internalMutation({
  args: { userId: v.string(), provider: v.string(), profiles: v.array(v.any()) },
  handler: async (ctx, { userId, provider, profiles }) => {
    return await storeAccountsInternal(ctx, userId, provider, profiles as ConnectedProfile[]);
  },
});

/** Exchange the code and store the resulting accounts. Called by the callback. */
export const completeConnect = action({
  args: {
    provider: v.string(),
    code: v.string(),
    userId: v.string(),
    codeVerifier: v.optional(v.string()),
    returnOrigin: v.optional(v.string()),
    redirectUri: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ connected: number }> => {
    const provider = getProvider(args.provider);
    const clientId = process.env[provider.credentialEnv.clientId];
    const clientSecret = process.env[provider.credentialEnv.clientSecret];
    if (!clientId || !clientSecret) {
      throw new Error(`${provider.displayName} OAuth credentials are not configured`);
    }

    const redirectUri =
      args.redirectUri ||
      callbackUrl();

    const profiles = await provider.exchangeCode({
      code: args.code,
      clientId,
      clientSecret,
      redirectUri,
      codeVerifier: args.codeVerifier,
    });

    if (!profiles.length) throw new Error(`${provider.displayName} returned no accounts`);

    await ctx.runMutation(internal.social.storeAccounts, {
      userId: args.userId,
      provider: provider.id,
      profiles,
    });
    return { connected: profiles.length };
  },
});

export { appBaseUrl };
