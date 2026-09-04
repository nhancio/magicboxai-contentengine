import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { decodeOAuthState, safeReturnOrigin, safeReturnTo } from "./social";

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

    const decoded = state ? decodeOAuthState(state) : null;
    const claim = state
      ? await ctx.runMutation(api.social.consumeState, { state })
      : null;

    const base =
      safeReturnOrigin(claim?.returnOrigin ?? decoded?.o) || DEFAULT_APP_BASE();
    const returnTo =
      safeReturnTo(claim?.returnTo ?? decoded?.r) || "/settings";

    const fail = (reason: string, targetReturnTo = returnTo) =>
      redirect(`${base}${targetReturnTo}?social=error&reason=${encodeURIComponent(reason)}`);

    // User denied consent (or the provider rejected the request).
    if (oauthError) return fail(oauthError, returnTo);
    if (!code || !state) return fail("missing_code_or_state", returnTo);
    if (!claim || !claim.ok) {
      return fail(claim?.error ?? "invalid_or_expired_state", returnTo);
    }

    const provider = claim.provider ?? decoded?.p;
    const userId = claim.userId ?? decoded?.u;
    const codeVerifier = claim.codeVerifier ?? decoded?.cv;

    if (!provider || !userId) {
      return fail("missing_provider_or_user", returnTo);
    }

    try {
      await ctx.runAction(api.social.completeConnect, {
        provider,
        code,
        userId,
        codeVerifier,
        returnOrigin: claim?.returnOrigin ?? decoded?.o,
        redirectUri: claim?.redirectUri ?? decoded?.rd,
      });
    } catch (e) {
      console.error("[oauth] connect failed", e);
      return fail(String(e).slice(0, 120), returnTo);
    }

    return redirect(
      `${base}${returnTo}?social=connected&provider=${encodeURIComponent(provider)}`,
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
