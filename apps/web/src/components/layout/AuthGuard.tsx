import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const dest = `${location.pathname}${location.search}`;
    const to = dest && dest !== "/" ? `/login?redirect=${encodeURIComponent(dest)}` : "/login";
    return <Navigate to={to} replace />;
  }

  return <>{children}</>;
}
