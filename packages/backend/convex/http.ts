import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

/**
 * Public HTTP surface. Lives on the `.convex.site` domain.
 *
 * The OAuth callback URL to register in every provider's developer console is:
 *   https://<deployment>.convex.site/oauth/callback
 * (for this dev deployment: https://beloved-lyrebird-288.convex.site/oauth/callback)
 */
const http = httpRouter();

function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { Location: to } });
}

const DEFAULT_APP_BASE = () => process.env.APP_BASE_URL ?? "https://app.magicboxai.in";

/**
 * OAuth redirect target for every provider.
 *
 * Always redirects back into the app rather than rendering an error page — a
 * user who denied consent should land on Settings with a message, not a stack
 * trace. Failure detail goes to `?social=error&reason=`.
 *
 * Prefer `returnOrigin` from the oauth state (localhost when testing locally)
 * so we don't dump the user onto production, which still has the legacy
 * Firebase connect path.
 */
http.route({
  path: "/oauth/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    // Burn the one-time nonce early so we know the intended origin for errors too.
    const claim = state
      ? await ctx.runMutation(internal.social.consumeState, { nonce: state })
      : null;
    const base = claim?.returnOrigin || DEFAULT_APP_BASE();

    const fail = (reason: string, returnTo = "/settings") =>
      redirect(`${base}${returnTo}?social=error&reason=${encodeURIComponent(reason)}`);

    // User denied consent (or the provider rejected the request).
    if (oauthError) return fail(oauthError);
    if (!code || !state) return fail("missing_code_or_state");
    if (!claim) return fail("invalid_or_expired_state");

    try {
      await ctx.runAction(api.social.completeConnect, {
        provider: claim.provider,
        code,
        userId: claim.userId,
        codeVerifier: claim.codeVerifier,
      });
    } catch (e) {
      console.error("[oauth] connect failed", e);
      return fail(String(e).slice(0, 120), claim.returnTo ?? "/settings");
    }

    const returnTo = claim.returnTo ?? "/settings";
    return redirect(
      `${base}${returnTo}?social=connected&provider=${encodeURIComponent(claim.provider)}`,
    );
  }),
});

/** Liveness probe — handy for verifying the deployment + callback host. */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => Response.json({ ok: true, service: "magicbox-convex" })),
});

export default http;
