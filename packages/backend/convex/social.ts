import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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
  // .convex.site domain (see http.ts). Overridable for custom domains.
  const base = process.env.OAUTH_CALLBACK_BASE ?? process.env.CONVEX_SITE_URL;
  if (!base) throw new Error("CONVEX_SITE_URL unavailable; cannot build OAuth redirect URI");
  return `${base}/oauth/callback`;
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

function safeReturnOrigin(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const origin = u.origin;
    return ALLOWED_RETURN_ORIGINS.has(origin) ? origin : undefined;
  } catch {
    return undefined;
  }
}

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
function safeReturnTo(raw?: string): string | undefined {
  if (!raw) return undefined;
  return /^\/[A-Za-z0-9/_-]*$/.test(raw) ? raw : undefined;
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
    const redirectUri = callbackUrl();

    // Hard guard: never hand Google a Firebase callback from the Convex path.
    if (redirectUri.includes("cloudfunctions.net")) {
      throw new Error(
        "Misconfigured OAuth callback (cloudfunctions). Expected *.convex.site/oauth/callback.",
      );
    }

    await ctx.runMutation(internal.social.createState, {
      nonce,
      userId: uid,
      provider: provider.id,
      returnTo: safeReturnTo(args.returnTo),
      returnOrigin: safeReturnOrigin(args.returnOrigin),
      codeVerifier,
    });

    const url = provider.buildAuthUrl({
      clientId,
      redirectUri,
      state: nonce,
      codeChallenge: codeVerifier ? await pkceChallenge(codeVerifier) : undefined,
      loginHint: args.loginHint,
    });

    return { url, redirectUri };
  },
});

export const disconnect = mutation({
  args: { accountId: v.id("socialAccounts") },
  handler: async (ctx, { accountId }) => {
    const uid = await requireUid(ctx);
    const account = await ctx.db.get(accountId);
    // not-found rather than permission-denied: don't leak existence.
    if (!account || account.userId !== uid) throw new Error("Account not found");

    // socialAccountId is stored as a string; collect() so duplicate token rows
    // can't make .unique() throw and abort the disconnect.
    const tokens = await ctx.db
      .query("socialTokens")
      .withIndex("by_socialAccountId", (q) =>
        q.eq("socialAccountId", accountId as string),
      )
      .collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    await ctx.db.delete(accountId);
    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Callback internals (used by http.ts)
// ---------------------------------------------------------------------------

/** Burn the nonce. Returns null if unknown, expired, or already used (replay). */
export const consumeState = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, { nonce }) => {
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row) return null;
    if (row.usedAt) return null;
    if (row.expiresAt < Date.now()) return null;

    await ctx.db.patch(row._id, { usedAt: Date.now() });
    return {
      userId: row.userId,
      provider: row.provider,
      returnTo: row.returnTo,
      returnOrigin: row.returnOrigin,
      codeVerifier: row.codeVerifier,
    };
  },
});

/**
 * Persist connected accounts + their tokens.
 * Re-connecting the same external account UPDATES in place rather than
 * duplicating (matching the Firebase deterministic-id behaviour).
 */
export const storeAccounts = internalMutation({
  args: { userId: v.string(), provider: v.string(), profiles: v.array(v.any()) },
  handler: async (ctx, { userId, provider, profiles }) => {
    const now = Date.now();
    const ids: Id<"socialAccounts">[] = [];

    for (const p of profiles as ConnectedProfile[]) {
      const existing = await ctx.db
        .query("socialAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const match = existing.find((a) => a.provider === provider && a.externalId === p.externalId);

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
        .withIndex("by_socialAccountId", (q) => q.eq("socialAccountId", accountId))
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
  },
});

/** Exchange the code and store the resulting accounts. Called by the callback. */
export const completeConnect = action({
  args: {
    provider: v.string(),
    code: v.string(),
    userId: v.string(),
    codeVerifier: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ connected: number }> => {
    const provider = getProvider(args.provider);
    const clientId = process.env[provider.credentialEnv.clientId];
    const clientSecret = process.env[provider.credentialEnv.clientSecret];
    if (!clientId || !clientSecret) {
      throw new Error(`${provider.displayName} OAuth credentials are not configured`);
    }

    const profiles = await provider.exchangeCode({
      code: args.code,
      clientId,
      clientSecret,
      redirectUri: callbackUrl(),
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
