import { useCallback, useMemo, type ReactNode } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import { auth as firebaseAuth } from "@shared/lib/firebase";

/**
 * Convex client + Firebase-auth bridge.
 *
 * Firebase Auth stays the identity provider during the migration. The client
 * hands Convex the Firebase ID token; Convex validates it as an OIDC JWT
 * (issuer `https://securetoken.google.com/<project>`, audience `<project>`) per
 * `packages/backend/convex/auth.config.ts`, and exposes the uid to every
 * function via `ctx.auth.getUserIdentity().subject` (see `convex/lib/auth.ts`).
 *
 * The deployment URL is public by design — it ships in the client bundle and is
 * not a secret. Authorization is enforced server-side on every Convex function.
 */

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

/**
 * `null` when unconfigured so the app still boots (and Firebase-only screens keep
 * working) instead of crashing at import time on a missing env var.
 */
export const convex: ConvexReactClient | null = convexUrl
  ? new ConvexReactClient(convexUrl)
  : null;

export const isConvexConfigured = !!convex;

/**
 * Adapts our Firebase `AuthProvider` to the shape `ConvexProviderWithAuth` wants.
 * Convex calls `fetchAccessToken({ forceRefreshToken: true })` when a token is
 * rejected, so we must honour the flag rather than always returning a cached one.
 */
function useAuthFromFirebase() {
  const { user, loading } = useAuth();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const current = firebaseAuth?.currentUser;
      if (!current) return null;
      try {
        return await current.getIdToken(forceRefreshToken);
      } catch (e) {
        console.warn("[convex] failed to fetch Firebase ID token", e);
        return null;
      }
    },
    // Rebind when the signed-in identity changes so Convex re-authenticates
    // instead of holding a token for the previous user.
    [user?.uid],
  );

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken],
  );
}

/**
 * Must render INSIDE `AuthProvider` — the bridge reads Firebase auth state via
 * `useAuth()`. When Convex is unconfigured this is a transparent pass-through.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromFirebase}>
      {children}
    </ConvexProviderWithAuth>
  );
}
