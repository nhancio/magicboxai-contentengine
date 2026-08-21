import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@shared/components/ui/button";
import { useAuth, isPopupCancelledError } from "@shared/lib/auth";
import { captureEvent, PRODUCT_EVENTS } from "@shared/lib/analytics";
import { Loader2 } from "lucide-react";
import "./login.css";

const LoginLottie = lazy(() => import("./LoginLottie"));

/**
 * Landing CTAs link here with `intent=google` so the visitor goes straight to
 * the Google account chooser instead of meeting a second "Sign in" button.
 * Survives one round-trip in sessionStorage: if the visitor comes back still
 * signed out (they cancelled, or the handler failed), we must not bounce them
 * to Google again — show the normal card instead.
 */
const AUTO_SIGNIN_ATTEMPTED = "mb_auto_signin_attempted";

// Safari private mode and locked-down profiles throw on sessionStorage access.
// Losing the loop guard is survivable; crashing the sign-in page is not.
function readAttempted(): boolean {
  try {
    return sessionStorage.getItem(AUTO_SIGNIN_ATTEMPTED) === "1";
  } catch {
    return false;
  }
}

function writeAttempted(value: boolean) {
  try {
    if (value) sessionStorage.setItem(AUTO_SIGNIN_ATTEMPTED, "1");
    else sessionStorage.removeItem(AUTO_SIGNIN_ATTEMPTED);
  } catch {
    /* no-op */
  }
}

export default function Login() {
  const { user, loading, redirecting, canAutoRedirect, signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [searchParams] = useSearchParams();
  const redirectRaw = searchParams.get("redirect");
  // Only honor same-app relative paths to avoid open-redirects.
  const redirectTo =
    redirectRaw && /^\/(?!\/)[A-Za-z0-9/?&=_.%-]*$/.test(redirectRaw)
      ? redirectRaw
      : "/";

  const wantsAutoSignIn = searchParams.get("intent") === "google";
  const autoStarted = useRef(false);
  // Decided once, before the effect can flip the sessionStorage flag, so the
  // first render already knows whether to paint the card or the handoff screen.
  const [autoPending, setAutoPending] = useState(
    () => wantsAutoSignIn && canAutoRedirect && !readAttempted(),
  );

  useEffect(() => {
    if (user) {
      writeAttempted(false);
      return;
    }
    // `loading` covers the redirect round-trip too — firing before it settles
    // would send an already-authenticated visitor back to Google.
    if (!autoPending || loading || autoStarted.current) return;
    autoStarted.current = true;
    writeAttempted(true);
    captureEvent(PRODUCT_EVENTS.loginStarted, { method: "google", mode: "auto" });
    signInWithGoogle("redirect")
      .then((result) => {
        if (result !== "cancelled") return;
        captureEvent(PRODUCT_EVENTS.loginCancelled, { method: "google", mode: "auto" });
        writeAttempted(false);
        setAutoPending(false);
      })
      .catch((err) => {
        // The handoff never started — drop back to the card rather than leaving
        // the visitor on a spinner that will never resolve.
        if (isPopupCancelledError(err)) {
          captureEvent(PRODUCT_EVENTS.loginCancelled, { method: "google", mode: "auto" });
          writeAttempted(false);
          setAutoPending(false);
          return;
        }
        captureEvent(PRODUCT_EVENTS.loginFailed, { method: "google", mode: "auto" });
        writeAttempted(false);
        setAutoPending(false);
        toast.error(err instanceof Error ? err.message : "Failed to sign in with Google");
      });
  }, [autoPending, loading, user, signInWithGoogle]);

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (loading || redirecting || autoPending) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        {(redirecting || autoPending) && (
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            Taking you to Google
          </p>
        )}
      </div>
    );
  }

  const handleSignIn = async () => {
    setSigningIn(true);
    captureEvent(PRODUCT_EVENTS.loginStarted, { method: "google", mode: "manual" });
    try {
      const result = await signInWithGoogle();
      if (result === "cancelled") {
        captureEvent(PRODUCT_EVENTS.loginCancelled, { method: "google", mode: "manual" });
      }
    } catch (err) {
      if (isPopupCancelledError(err)) {
        captureEvent(PRODUCT_EVENTS.loginCancelled, { method: "google", mode: "manual" });
        return;
      }
      captureEvent(PRODUCT_EVENTS.loginFailed, { method: "google", mode: "manual" });
      toast.error(err instanceof Error ? err.message : "Failed to sign in with Google");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="lg-page min-h-screen px-5 py-10 text-foreground sm:px-8">
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_400px] lg:gap-14">
        <section>
          <div
            className="lg-reveal mb-7 flex items-center gap-3"
            style={{ animationDelay: "0.05s" }}
          >
            <img
              src="/logo.svg"
              alt="MagicBox"
              width={44}
              height={44}
              className="h-11 w-11 rounded-xl shadow-sm ring-1 ring-foreground/10"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/favicon.svg";
              }}
            />
            <div>
              <div className="font-display text-2xl leading-none tracking-tight">MagicBox</div>
              <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">
                AI marketing suite
              </div>
            </div>
          </div>

          <h1
            className="lg-reveal max-w-xl font-display text-5xl leading-[1.02] tracking-tight md:text-[4.1rem]"
            style={{ animationDelay: "0.12s" }}
          >
            Your brand.
            <br />
            Your weekly social plan.
          </h1>

          <p
            className="lg-reveal mt-5 max-w-lg text-base leading-7 text-muted-foreground md:text-lg"
            style={{ animationDelay: "0.22s" }}
          >
            Sign in to generate on-brand posts, review every draft, and schedule
            publishing to your connected Instagram, LinkedIn, and YouTube accounts.
          </p>

        </section>

        <div className="lg-reveal relative" style={{ animationDelay: "0.28s" }}>
          <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-2xl border border-border bg-secondary/80" />
          <div className="relative rounded-2xl border-[1.5px] border-foreground/75 bg-card/95 p-7 shadow-xl shadow-brand/5 backdrop-blur-sm">
            {signingIn ? (
              <div className="py-2 text-center">
                <Suspense
                  fallback={<Loader2 className="mx-auto h-10 w-10 animate-spin text-brand" />}
                >
                  <LoginLottie />
                </Suspense>
                <p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                  Opening your workspace…
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Finish signing in with the Google window.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-7">
                  <div className="flex items-center gap-2">
                    <span className="lg-dot" />
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                      Sign in
                    </span>
                  </div>
                  <div className="mt-3.5 font-display text-3xl leading-tight">
                    Continue to MagicBox
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                    One Google login — brand kit, automations, and reels stay
                    tied to your workspace.
                  </p>
                </div>
                <Button onClick={handleSignIn} className="h-12 w-full text-[0.95rem]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </Button>
                <p className="mt-6 text-center text-xs leading-6 text-muted-foreground">
                  By continuing, you agree to our{" "}
                  <a
                    href="https://magicboxai.in/terms.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline underline-offset-2 hover:text-brand/80"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://magicboxai.in/privacy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline underline-offset-2 hover:text-brand/80"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
