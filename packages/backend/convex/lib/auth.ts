import { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Resolve the calling Firebase uid, or throw. Every tenant-scoped function must
 * call this first so unauthenticated / foreign-tenant access fails closed.
 */
export async function requireUid(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  // `subject` is the Firebase uid (the JWT `sub`).
  return identity.subject;
}
