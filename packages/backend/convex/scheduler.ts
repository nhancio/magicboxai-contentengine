import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * The publish scheduler — Convex-native replacement for Firebase's `postingTick`.
 *
 * Runs every minute (see crons.ts) and drains due posts.
 *
 * DOUBLE-POST SAFETY: claiming is a transactional lease. Convex mutations are
 * serializable, so `claimDuePosts` reading + patching in one mutation cannot
 * interleave with another tick — two overlapping runs can never claim the same
 * post. A crashed run's lease expires (CLAIM_TTL) and the post is retried
 * rather than being stranded forever, which was an explicit gap in the Firebase
 * version ("stuck-claim recovery after process crashes").
 */

const CLAIM_TTL_MS = 10 * 60 * 1000; // a publish attempt should never exceed this
const BATCH = 10; // posts per tick; keeps a tick well under time limits

export const claimDuePosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const due = await ctx.db
      .query("posts")
      .withIndex("by_status_scheduledFor", (q) =>
        q.eq("status", "scheduled").lte("scheduledFor", now),
      )
      .take(BATCH * 3);

    const claimed: Id<"posts">[] = [];
    for (const post of due) {
      // Respect retry backoff set by finishPost.
      if (post.nextAttemptAt && post.nextAttemptAt > now) continue;

      // Skip posts already claimed by a live run; reclaim expired leases.
      if (post.claimedAt && now - post.claimedAt < CLAIM_TTL_MS) continue;

      if ((post.attempts ?? 0) >= (post.maxAttempts ?? 3)) {
        await ctx.db.patch(post._id, {
          status: "failed",
          error: post.error ?? "max attempts exceeded",
          claimedAt: undefined,
          claimToken: undefined,
          updatedAt: now,
        });
        continue;
      }

      await ctx.db.patch(post._id, {
        status: "posting",
        claimedAt: now,
        claimToken: `${now}_${post._id}`,
        updatedAt: now,
      });
      claimed.push(post._id);
      if (claimed.length >= BATCH) break;
    }
    return claimed;
  },
});

/** Return posts whose lease expired mid-flight back to the queue. */
export const recoverStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stuck = await ctx.db
      .query("posts")
      .withIndex("by_status_scheduledFor", (q) => q.eq("status", "posting"))
      .take(50);

    let recovered = 0;
    for (const post of stuck) {
      if (!post.claimedAt || now - post.claimedAt < CLAIM_TTL_MS) continue;
      await ctx.db.patch(post._id, {
        status: "scheduled",
        claimedAt: undefined,
        claimToken: undefined,
        attempts: (post.attempts ?? 0) + 1,
        updatedAt: now,
      });
      recovered++;
    }
    return recovered;
  },
});

/**
 * One tick: recover stragglers, claim what's due, publish each.
 * Publishing runs sequentially so one tick can't stampede a provider's rate limit.
 */
export const publishTick = internalAction({
  args: {},
  handler: async (ctx): Promise<{ claimed: number; recovered: number }> => {
    const recovered = await ctx.runMutation(internal.scheduler.recoverStuck, {});
    const claimed: Id<"posts">[] = await ctx.runMutation(internal.scheduler.claimDuePosts, {});

    for (const postId of claimed) {
      try {
        await ctx.runAction(internal.publish.runPost, { postId });
      } catch (e) {
        // runPost handles destination errors internally; reaching here means
        // something structural broke. Release the lease so it retries.
        console.error(`[scheduler] runPost crashed for ${postId}`, e);
        await ctx.runMutation(internal.scheduler.releaseClaim, {
          postId,
          error: String(e).slice(0, 200),
        });
      }
    }

    if (claimed.length || recovered) {
      console.log(`[scheduler] claimed ${claimed.length}, recovered ${recovered}`);
    }
    return { claimed: claimed.length, recovered };
  },
});

export const releaseClaim = internalMutation({
  args: { postId: v.id("posts"), error: v.optional(v.string()) },
  handler: async (ctx, { postId, error }) => {
    const post = await ctx.db.get(postId);
    if (!post) return;
    const attempts = (post.attempts ?? 0) + 1;
    const exhausted = attempts >= (post.maxAttempts ?? 3);
    await ctx.db.patch(postId, {
      status: exhausted ? "failed" : "scheduled",
      attempts,
      error,
      claimedAt: undefined,
      claimToken: undefined,
      nextAttemptAt: exhausted ? undefined : Date.now() + 5 * 60_000,
      updatedAt: Date.now(),
    });
  },
});

/** "Post now" — bypass the schedule and publish immediately. */
export const publishNow = internalAction({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }): Promise<{ status: string; published: number; of: number }> => {
    return await ctx.runAction(internal.publish.runPost, { postId });
  },
});
