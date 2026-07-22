import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@shared/lib/firebase";
import { useAuth } from "@shared/lib/auth";

/**
 * Redirects signed-in users who haven't finished onboarding to /onboarding.
 * Wrap protected routes with this INSIDE AuthGuard.
 */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [complete, setComplete] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user || !db) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (!cancelled) setComplete(snap.data()?.onboardingComplete === true);
      })
      .catch(() => {
        if (!cancelled) setComplete(true); // fail open — never lock users out
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (complete === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!complete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
