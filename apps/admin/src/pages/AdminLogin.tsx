import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAdminAuth } from "../contexts/AdminAuthContext";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@shared/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const { isAuthenticated, login, loading, isAdmin, user } = useAdminAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    setError("");
    setSigningIn(true);
    try {
      await login();
      // After login, the useEffect in AdminAuthContext will check isAdmin
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-zinc-950">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-3xl animate-glow" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        <Card className="bg-zinc-900/80 backdrop-blur-xl border-white/10">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold font-display">Admin Access</CardTitle>
            <CardDescription className="text-white/50">
              MagicBox AI Administration
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 pb-8">
            <div className="space-y-4">
              {user && !isAdmin && !loading && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-center">
                  Access denied. Your account ({user.email}) does not have administrative privileges.
                </div>
              )}
              
              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-center">
                  {error}
                </div>
              )}

              <Button 
                onClick={handleLogin} 
                className="w-full h-12 bg-white text-black hover:bg-white/90 font-bold" 
                disabled={signingIn || (loading && !!user)}
              >
                {signingIn || (loading && !!user) ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Sign in with Google
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
