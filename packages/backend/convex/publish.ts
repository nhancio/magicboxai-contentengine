import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getProvider } from "./lib/providers/registry";
import {
  BadBodyError,
  NotEnoughScopesError,
  ProviderDeferredError,
  RefreshTokenError,
  RetryableError,
  type ProviderToken,
} from "./lib/providers/types";

/**
 * The publish engine.
 *
 * Core design: a post FANS OUT to one independent attempt per destination
 * account. Publishing to Instagram succeeding and LinkedIn failing is a normal,
 * representable outcome ("partially published") — not an all-or-nothing rollback.
 * Each destination records its own status, permalink and error, so the UI can
 * offer per-destination retry.
 *
 * The engine never names a platform. It resolves a provider from the registry,
 * calls `publish`, and reacts to the TYPED ERROR the provider throws:
 *   RefreshTokenError    -> refresh the token, retry once, else mark reconnect
 *   NotEnoughScopesError -> mark the account `expired` (user must reconnect)
 *   BadBodyError         -> terminal failure for this destination, no retry
 *   RetryableError       -> leave retriable so the scheduler backs off
 */

export type DestinationResult = {
  accountId: string;
  platform: string;
  status: "published" | "failed" | "needs_reconnect";
  externalId?: string;
  permalink?: string;
  creationId?: string;
  error?: string;
  retriable?: boolean;
};

export const loadPostContext = internalQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post) return null;

    const destinations = [];
    for (const accountId of post.socialAccountIds) {
      const account = await ctx.db.get(accountId as Id<"socialAccounts">);
      // Re-verify tenant ownership at publish time: a stale/tampered post must
      // never publish through another user's account.
      if (!account || account.userId !== post.userId) continue;
      if (account.status !== "active") {
        destinations.push({ account, token: null });
        continue;
      }
      const token = await ctx.db
        .query("socialTokens")
        .withIndex("by_socialAccountId", (q) => q.eq("socialAccountId", account._id))
        .unique();
      destinations.push({ account, token });
    }
    return { post, destinations };
  },
});

export const markAccountStatus = internalMutation({
  args: {
    accountId: v.id("socialAccounts"),
    status: v.union(v.literal("active"), v.literal("disconnected"), v.literal("expired")),
  },
  handler: async (ctx, { accountId, status }) => {
    await ctx.db.patch(accountId, { status });
  },
});

export const saveToken = internalMutation({
  args: { accountId: v.id("socialAccounts"), token: v.any() },
  handler: async (ctx, { accountId, token }) => {
    const row = await ctx.db
      .query("socialTokens")
      .withIndex("by_socialAccountId", (q) => q.eq("socialAccountId", accountId))
      .unique();
    const t = token as ProviderToken;
    const patch = {
      encryptedAccessToken: t.accessToken,
      encryptedRefreshToken: t.refreshToken,
      expiresAt: t.expiresAt,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, patch);
  },
});

export const saveCreationId = internalMutation({
  args: {
    postId: v.id("posts"),
    accountId: v.string(),
    creationId: v.string(),
  },
  handler: async (ctx, { postId, accountId, creationId }) => {
    const post = await ctx.db.get(postId);
    if (!post) return;
    const results = [...((post.results as DestinationResult[] | undefined) ?? [])];
    const idx = results.findIndex((r) => r.accountId === accountId);
    if (idx >= 0) {
      results[idx] = { ...results[idx], creationId };
    } else {
      results.push({
        accountId,
        platform: "instagram",
        status: "failed",
        creationId,
      });
    }
    await ctx.db.patch(postId, { results, updatedAt: Date.now() });
  },
});

export const finishPost = internalMutation({
  args: {
    postId: v.id("posts"),
    results: v.array(v.any()),
    anyRetriable: v.boolean(),
  },
  handler: async (
    ctx,
    { postId, results, anyRetriable },
  ): Promise<{ status: string; published: number; of: number }> => {
    const post = await ctx.db.get(postId);
    // Deleted mid-flight (e.g. user cancelled while we were publishing).
    if (!post) return { status: "failed", published: 0, of: 0 };

    const rawRs = results as DestinationResult[];
    const rs = rawRs.map((r) => {
      const existing = (post.results as DestinationResult[] | undefined)?.find(
        (old) => old.accountId === r.accountId,
      );
      return {
        ...r,
        creationId: r.creationId ?? existing?.creationId,
      };
    });
    const published = rs.filter((r) => r.status === "published").length;
    const attempts = (post.attempts ?? 0) + 1;
    const exhausted = attempts >= (post.maxAttempts ?? 3);

    // All good -> posted. Nothing worked but something might later -> back off.
    // Otherwise it's terminal (fully failed, or partially published with
    // permanent failures we won't keep retrying).
    let status: "posted" | "scheduled" | "failed";
    if (published === rs.length && rs.length > 0) status = "posted";
    else if (published === 0 && anyRetriable && !exhausted) status = "scheduled";
    else status = published > 0 ? "posted" : "failed";

    const backoffMs = attempts === 1 ? 2 * 60_000 : 10 * 60_000;

    await ctx.db.patch(postId, {
      status,
      results: rs,
      attempts,
      claimedAt: undefined,
      claimToken: undefined,
      nextAttemptAt: status === "scheduled" ? Date.now() + backoffMs : undefined,
      error:
        status === "failed"
          ? rs.find((r) => r.error)?.error?.slice(0, 300) ?? "publish failed"
          : undefined,
      updatedAt: Date.now(),
    });

    // Keep the originating Maya suggestion's state honest.
    if (post.suggestionId) {
      const s = await ctx.db.get(post.suggestionId);
      if (s) {
        await ctx.db.patch(s._id, {
          status: status === "posted" ? "published" : status === "failed" ? "failed" : s.status,
          updatedAt: Date.now(),
        });
      }
    }
    return { status, published, of: rs.length };
  },
});

/**
 * Publish one post to all of its destinations.
 * Never throws for a destination-level problem — those become results.
 */
export const runPost = internalAction({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }): Promise<{ status: string; published: number; of: number }> => {
    const loaded = await ctx.runQuery(internal.publish.loadPostContext, { postId });
    if (!loaded) return { status: "failed", published: 0, of: 0 };
    const { post, destinations } = loaded;

    const results: DestinationResult[] = [];
    let anyRetriable = false;

    for (const dest of destinations) {
      const account: any = dest.account;
      const base: DestinationResult = {
        accountId: account._id,
        platform: account.platform,
        status: "failed",
      };

      if (!dest.token?.encryptedAccessToken) {
        results.push({
          ...base,
          status: "needs_reconnect",
          error: "no stored token — reconnect required",
        });
        continue;
      }

      let token: ProviderToken = {
        accessToken: dest.token.encryptedAccessToken,
        refreshToken: dest.token.encryptedRefreshToken,
        expiresAt: dest.token.expiresAt,
        igUserId: dest.token.igUserId,
        pageId: dest.token.pageId,
        channelId: dest.token.channelId,
        phoneNumberId: dest.token.phoneNumberId,
        wabaId: dest.token.wabaId,
        scopes: dest.token.scopes,
      };

      const perPlatform = (post.content?.perPlatform ?? {}) as Record<
        string,
        Record<string, unknown> | undefined
      >;
      const waOpts = (perPlatform.whatsapp ?? {}) as Record<string, unknown>;

      const existingResult = (post.results as DestinationResult[] | undefined)?.find(
        (r) => r.accountId === account._id,
      );
      const existingCreationId = existingResult?.creationId;

      const input = {
        caption: post.content?.caption ?? "",
        hashtags: post.content?.hashtags ?? [],
        media: (post.media ?? []).map((m: any) => ({ type: m.type, url: m.url })),
        creationId: existingCreationId,
        onCreationId: async (cid: string) => {
          await ctx.runMutation(internal.publish.saveCreationId, {
            postId,
            accountId: account._id,
            creationId: cid,
          });
        },
        options: {
          ...waOpts,
          recipients: waOpts.recipients,
          to: waOpts.to,
          templateName: waOpts.templateName,
          templateLanguage: waOpts.templateLanguage,
        },
      };

      const attemptPublish = async () => {
        const provider = getProvider(account.provider);
        return await provider.publish(token, input);
      };

      try {
        const r = await attemptPublish();
        results.push({
          ...base,
          status: "published",
          externalId: r.externalId,
          permalink: r.permalink,
          creationId: r.creationId ?? existingCreationId,
        });
        continue;
      } catch (e) {
        // --- Expired token: refresh once, then retry. -------------------
        if (e instanceof RefreshTokenError) {
          try {
            const provider = getProvider(account.provider);
            const clientId = process.env[provider.credentialEnv.clientId]!;
            const clientSecret = process.env[provider.credentialEnv.clientSecret]!;
            token = await provider.refresh(token, clientId, clientSecret);
            await ctx.runMutation(internal.publish.saveToken, {
              accountId: account._id,
              token,
            });
            const r = await attemptPublish();
            results.push({
              ...base,
              status: "published",
              externalId: r.externalId,
              permalink: r.permalink,
              creationId: r.creationId ?? existingCreationId,
            });
            continue;
          } catch (refreshErr) {
            // Providers that can't refresh (IG/LinkedIn) throw NotEnoughScopes
            // here — which correctly means "make the user reconnect".
            await ctx.runMutation(internal.publish.markAccountStatus, {
              accountId: account._id,
              status: "expired",
            });
            results.push({
              ...base,
              status: "needs_reconnect",
              error: String(refreshErr).slice(0, 200),
              creationId: existingCreationId,
            });
            continue;
          }
        }

        // --- Revoked/missing scope: force reconnect. --------------------
        if (e instanceof NotEnoughScopesError) {
          await ctx.runMutation(internal.publish.markAccountStatus, {
            accountId: account._id,
            status: "expired",
          });
          results.push({
            ...base,
            status: "needs_reconnect",
            error: String(e).slice(0, 200),
            creationId: existingCreationId,
          });
          continue;
        }

        // --- Deterministic bad request: terminal, don't burn quota. -----
        if (e instanceof BadBodyError || e instanceof ProviderDeferredError) {
          results.push({
            ...base,
            status: "failed",
            error: String(e).slice(0, 200),
            creationId: existingCreationId,
          });
          continue;
        }

        // --- Transient: let the scheduler back off and try again. -------
        if (e instanceof RetryableError) {
          anyRetriable = true;
          results.push({
            ...base,
            status: "failed",
            error: String(e).slice(0, 200),
            retriable: true,
            creationId: existingCreationId,
          });
          continue;
        }

        // Unknown error: treat as retriable — safer than declaring permanent
        // failure on something we don't understand.
        anyRetriable = true;
        results.push({
          ...base,
          status: "failed",
          error: String(e).slice(0, 200),
          retriable: true,
          creationId: existingCreationId,
        });
      }
    }

    return await ctx.runMutation(internal.publish.finishPost, {
      postId,
      results,
      anyRetriable,
    });
  },
});
