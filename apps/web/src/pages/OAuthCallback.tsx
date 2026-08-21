import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@shared/components/ui/button";

export default function OAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Verifying connection...");
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        setErrorMessage(reason);
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: "magicbox_social_error", reason }, "*");
          } catch {}
        }
        setTimeout(() => {
          navigate(`${returnTo}?social=error&reason=${encodeURIComponent(reason)}`, { replace: true });
        }, 2000);
      };

      const succeed = (prov: string) => {
        setIsSuccess(true);
        setStatus(`${prov.charAt(0).toUpperCase() + prov.slice(1)} connected successfully!`);
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: "magicbox_social_connected", provider: prov }, "*");
          } catch {}
          setTimeout(() => {
            window.close();
          }, 1200);
          return;
        }
        setTimeout(() => {
          navigate(`${returnTo}?social=connected&provider=${encodeURIComponent(prov)}`, { replace: true });
        }, 1000);
      };

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

      if (!claim || (!claim.ok && claim.error !== "state_already_used")) {
        return fail(claim?.error ?? "invalid_or_expired_state");
      }

      const { provider, userId, codeVerifier } = claim;
      if (!provider || !userId) {
        if (claim && !claim.ok && claim.error === "state_already_used") {
          return succeed(claim.provider || "channel");
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
          redirectUri: claim.redirectUri,
        });
      } catch (e: any) {
        console.error("[oauth] connect failed", e);
        if (e.message && e.message.includes("already used")) {
          return succeed(provider);
        }
        return fail(e.message || "Connection failed");
      }

      succeed(provider);
    };

    run();
  }, [location, navigate, consumeState, completeConnect]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
      {errorMessage ? (
        <div className="max-w-md space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Connection Error</h2>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button onClick={() => window.close()} variant="outline" size="sm">
            Close Window
          </Button>
        </div>
      ) : isSuccess ? (
        <div className="max-w-md space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">{status}</h2>
          <p className="text-sm text-muted-foreground">
            {window.opener ? "This window will close automatically..." : "Redirecting back to your workspace..."}
          </p>
        </div>
      ) : (
        <div className="max-w-md space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-brand mx-auto mb-4" />
          <h2 className="text-lg font-medium text-foreground">{status}</h2>
          <p className="text-sm text-muted-foreground">Please wait while we securely connect your account.</p>
        </div>
      )}
    </div>
  );
}
