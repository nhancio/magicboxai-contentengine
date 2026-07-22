import type { Auth } from "convex/server";

/**
 * Resolve the calling Firebase uid, or throw. Every tenant-scoped function must
 * call this first so unauthenticated / foreign-tenant access fails closed.
 *
 * Typed on the `auth` capability rather than a concrete ctx so it works for
 * queries, mutations AND actions (actions need it too — Maya's generator and the
 * Studio pipeline are actions).
 */
export async function requireUid(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  // `subject` is the Firebase uid (the JWT `sub`).
  return identity.subject;
}
