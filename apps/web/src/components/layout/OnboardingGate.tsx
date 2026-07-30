import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@shared/lib/firebase";
import { useAuth } from "@shared/lib/auth";

/**
 * Redirects new signed-in users to the one-time onboarding attempt. Users may
 * defer that attempt and enter the app, but feature-level gates (notably Maya)
 * continue to enforce their real website + active-channel requirements.
 * Wrap protected routes with this INSIDE AuthGuard.
 */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user || !db) return;
    setAccessGranted(null);
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const data = snap.data();
        if (!cancelled) {
          setAccessGranted(
            data?.onboardingComplete === true || data?.onboardingDeferred === true,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setAccessGranted(true); // fail open — never lock users out
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (accessGranted === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!accessGranted && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
