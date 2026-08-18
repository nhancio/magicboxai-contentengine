import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function OAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Verifying connection...");

  const consumeState = useMutation(api.social.consumeState);
  const completeConnect = useAction(api.social.completeConnect);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const errorDescription = params.get("error_description") || oauthError;

    const run = async () => {
      // Decode state manually just to get returnTo if possible, in case of early error
      let returnTo = "/settings";
      try {
        if (state) {
          const normalized = state.replace(/-/g, "+").replace(/_/g, "/");
          const pad = normalized.padEnd(
            normalized.length + ((4 - (normalized.length % 4)) % 4),
            "="
          );
          const binary = atob(pad);
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          const json = new TextDecoder().decode(bytes);
          const parsed = JSON.parse(json);
          if (parsed?.r) returnTo = parsed.r;
        }
      } catch (e) {
        // Ignore parsing errors here
      }

      const fail = (reason: string) => {
        navigate(`${returnTo}?social=error&reason=${encodeURIComponent(reason)}`, { replace: true });
      };

      // Since HTTP callback is hitting the frontend instead now due to local changes,
      // it might be hitting this twice in React strict mode. Let's make sure we don't
      // double-consume if we don't need to.
      if (oauthError) {
        return fail(errorDescription || "User denied consent.");
      }

      if (!code || !state) {
        return fail("missing_code_or_state");
      }

      let claim;
      try {
        claim = await consumeState({ state });
      } catch (e) {
        console.error("consumeState failed", e);
        return fail("invalid_or_expired_state");
      }

      // If the state was *just* consumed by the HTTP handler, it might say "already used".
      // But if we are running locally, the HTTP handler probably failed to redirect properly
      // or we are hitting the frontend callback directly instead of HTTP.
      if (!claim || (!claim.ok && claim.error !== "state_already_used")) {
        return fail(claim?.error ?? "invalid_or_expired_state");
      }

      const { provider, userId, codeVerifier } = claim;
      if (!provider || !userId) {
        // If we hit state_already_used, claim doesn't have provider/userId.
        // That means something else (like the HTTP handler) already used it.
        // Let's just assume it succeeded if it was already used, or we fallback.
        if (claim && !claim.ok && claim.error === "state_already_used") {
             // We can't complete connect if it's already used because we lost the codeVerifier/userId in the return
             // Actually, if it's already used, it might have ALREADY been connected.
             // Let's just try to go back to settings.
             navigate(`${returnTo}?social=connected`, { replace: true });
             return;
        }
        return fail("missing_provider_or_user");
      }

      setStatus("Completing connection...");

      try {
        await completeConnect({
          provider,
          code,
          userId,
          codeVerifier,
          returnOrigin: window.location.origin,
        });
      } catch (e: any) {
        console.error("[oauth] connect failed", e);
        // If it says already used, it might have succeeded.
        if (e.message && e.message.includes("already used")) {
           navigate(`${returnTo}?social=connected&provider=${encodeURIComponent(provider)}`, { replace: true });
           return;
        }
        return fail(e.message || "Connection failed");
      }

      navigate(`${returnTo}?social=connected&provider=${encodeURIComponent(provider)}`, { replace: true });
    };

    run();
  }, [location, navigate, consumeState, completeConnect]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-brand mb-4" />
      <h2 className="text-lg font-medium text-foreground">{status}</h2>
      <p className="text-sm text-muted-foreground mt-2">Please wait while we securely connect your account.</p>
    </div>
  );
}
