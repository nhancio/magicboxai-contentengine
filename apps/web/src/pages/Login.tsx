import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent } from "@shared/components/ui/card";
import { useAuth } from "@shared/lib/auth";
import { Image, Layers3, Loader2, PlaySquare } from "lucide-react";

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [searchParams] = useSearchParams();
  const redirectRaw = searchParams.get("redirect");
  // Only honor same-app relative paths to avoid open-redirects.
  const redirectTo =
    redirectRaw && /^\/(?!\/)[A-Za-z0-9/?&=_.%-]*$/.test(redirectRaw)
      ? redirectRaw
      : "/";

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign in with Google");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="animate-fade-in">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-foreground text-background font-display text-xl leading-none">
              M
            </div>
            <span className="eyebrow">MagicBox</span>
          </div>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] tracking-tight md:text-6xl">
            Your marketing creation desk.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Sign in with Google and create campaign copy, image prompts, video scripts, and carousel slides from one brief.
          </p>
          <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              { label: "Image pieces", icon: Image },
              { label: "Video scripts", icon: PlaySquare },
              { label: "Carousels", icon: Layers3 },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                <item.icon className="mb-3 h-5 w-5 text-brand" />
                <div className="text-sm font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <Card className="animate-slide-up rounded-lg border-border bg-card shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6">
              <span className="eyebrow">Sign in</span>
              <div className="mt-3 font-display text-2xl">Continue to MagicBox</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Google login keeps every generated brief tied to your workspace.
              </p>
            </div>
            <Button
              onClick={handleSignIn}
              disabled={signingIn}
              className="h-12 w-full"
            >
              {signingIn ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in
                </>
              ) : (
                <>
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
                </>
              )}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
