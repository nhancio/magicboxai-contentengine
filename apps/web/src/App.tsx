import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@shared/lib/auth";
import { ConvexClientProvider } from "./lib/convex";
import {
  captureEvent,
  capturePageview,
  identifyUser,
  PRODUCT_EVENTS,
  resetAnalytics,
} from "@shared/lib/analytics";
import AuthGuard from "./components/layout/AuthGuard";
import OnboardingGate from "./components/layout/OnboardingGate";
import AppLayout from "./components/layout/AppLayout";
import ConsentBanner from "@shared/components/ConsentBanner";
import { ErrorBoundary, PageLoader } from "./components/ErrorBoundary";
import Login from "./pages/Login";

const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Maya = lazy(() => import("./pages/Maya"));
const Automations = lazy(() => import("./pages/Automations"));
const AutomationWizard = lazy(() => import("./pages/AutomationWizard"));
const BrandKit = lazy(() => import("./pages/BrandKit"));
const Studio = lazy(() => import("./pages/Studio"));
const Library = lazy(() => import("./pages/Library"));
const Schedule = lazy(() => import("./pages/Schedule"));
const MyVideo = lazy(() => import("./pages/MyVideo"));
const Settings = lazy(() => import("./pages/Settings"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Pricing = lazy(() => import("./pages/Pricing"));
const WarmedUpAccounts = lazy(() => import("./pages/WarmedUpAccounts"));
const Feedback = lazy(() => import("./pages/Feedback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));

function ProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <OnboardingGate>
        <AppLayout>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AppLayout>
      </OnboardingGate>
    </AuthGuard>
  );
}

/** Fires a PostHog pageview on every route change and identifies the user. */
function AnalyticsTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const trackedUser = useRef<string | null>(null);

  useEffect(() => {
    capturePageview();
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      // Firebase uid is the pseudonymous analytics identifier. Do not copy
      // email or display name into product analytics.
      if (trackedUser.current !== user.uid) {
        identifyUser(user.uid, { app: "web" });
        captureEvent(PRODUCT_EVENTS.loginCompleted, {
          method: "google",
          app: "web",
        });
        trackedUser.current = user.uid;
      }
    } else {
      trackedUser.current = null;
      resetAnalytics();
    }
  }, [user]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ConvexClientProvider>
        <BrowserRouter>
          <AnalyticsTracker />
          <ErrorBoundary label="app">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/onboarding"
                  element={
                    <AuthGuard>
                      <Onboarding />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/onboarding/channels"
                  element={
                    <AuthGuard>
                      <Onboarding />
                    </AuthGuard>
                  }
                />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/maya" element={<ProtectedRoute><Maya /></ProtectedRoute>} />
                <Route path="/automations" element={<ProtectedRoute><Automations /></ProtectedRoute>} />
                <Route path="/automations/new" element={<ProtectedRoute><AutomationWizard /></ProtectedRoute>} />
                <Route path="/automations/:id" element={<ProtectedRoute><AutomationWizard /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
                <Route path="/posts" element={<ProtectedRoute><Library /></ProtectedRoute>} />
                <Route path="/brand" element={<ProtectedRoute><BrandKit /></ProtectedRoute>} />
                <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
                <Route path="/analytics" element={<Navigate to="/" replace />} />
                <Route path="/avatars" element={<Navigate to="/" replace />} />
                <Route path="/my-video" element={<ProtectedRoute><MyVideo /></ProtectedRoute>} />
                <Route path="/studio" element={<ProtectedRoute><Studio /></ProtectedRoute>} />
                <Route path="/carousel" element={<Navigate to="/studio?mode=carousel" replace />} />
                <Route path="/content-studio" element={<Navigate to="/studio?mode=post" replace />} />
                <Route path="/video-creator" element={<Navigate to="/studio?mode=video" replace />} />
                <Route path="/create-video" element={<Navigate to="/studio?mode=video" replace />} />
                <Route path="/ad-generator" element={<Navigate to="/studio" replace />} />
                <Route path="/avatar-builder" element={<Navigate to="/" replace />} />
                <Route path="/avatar-creator" element={<Navigate to="/" replace />} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/settings/integrations" element={<Navigate to="/settings?tab=integrations" replace />} />
                <Route path="/settings/connections" element={<Navigate to="/settings?tab=integrations" replace />} />
                <Route path="/settings/channels" element={<Navigate to="/settings?tab=integrations" replace />} />
<<<<<<< HEAD
                <Route path="/integrations" element={<Navigate to="/settings?tab=integrations" replace />} />
=======
                <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
>>>>>>> origin/main
                <Route path="/connections" element={<Navigate to="/settings?tab=integrations" replace />} />
                <Route path="/channels" element={<Navigate to="/settings?tab=integrations" replace />} />
                <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
                <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
                <Route path="/warmed-up-accounts" element={<ProtectedRoute><WarmedUpAccounts /></ProtectedRoute>} />
                <Route path="/oauth/callback" element={<OAuthCallback />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        <ConsentBanner />
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(24, 24, 27, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#fff",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </ConvexClientProvider>
    </AuthProvider>
  );
}
