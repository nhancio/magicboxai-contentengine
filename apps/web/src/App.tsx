import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@shared/lib/auth";
import { ConvexClientProvider } from "./lib/convex";
import { capturePageview, identifyUser, resetAnalytics } from "@shared/lib/analytics";
import AuthGuard from "./components/layout/AuthGuard";
import OnboardingGate from "./components/layout/OnboardingGate";
import AppLayout from "./components/layout/AppLayout";
import ConsentBanner from "@shared/components/ConsentBanner";
import { ErrorBoundary, PageLoader } from "./components/ErrorBoundary";
import { LEGACY_TOOLS_ENABLED } from "./lib/flags";
import Login from "./pages/Login";

const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Maya = lazy(() => import("./pages/Maya"));
const Automations = lazy(() => import("./pages/Automations"));
const AutomationWizard = lazy(() => import("./pages/AutomationWizard"));
const BrandKit = lazy(() => import("./pages/BrandKit"));
const ContentStudio = lazy(() => import("./pages/ContentStudio"));
const VideoCreator = lazy(() => import("./pages/VideoCreator"));
const Studio = lazy(() => import("./pages/Studio"));
const Carousel = lazy(() => import("./pages/Carousel"));
const Library = lazy(() => import("./pages/Library"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Avatars = lazy(() => import("./pages/Avatars"));
const Settings = lazy(() => import("./pages/Settings"));
const Pricing = lazy(() => import("./pages/Pricing"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

  useEffect(() => {
    capturePageview();
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      // Firebase uid is the pseudonymous analytics identifier. Do not copy
      // email or display name into product analytics.
      identifyUser(user.uid, { app: "web" });
    } else {
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
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/avatars" element={<ProtectedRoute><Avatars /></ProtectedRoute>} />
                <Route path="/studio" element={<ProtectedRoute><Studio /></ProtectedRoute>} />
                <Route path="/carousel" element={<ProtectedRoute><Carousel /></ProtectedRoute>} />
                {LEGACY_TOOLS_ENABLED ? (
                  <>
                    <Route path="/content-studio" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
                    <Route path="/video-creator" element={<ProtectedRoute><VideoCreator /></ProtectedRoute>} />
                    <Route path="/create-video" element={<ProtectedRoute><VideoCreator /></ProtectedRoute>} />
                  </>
                ) : (
                  <>
                    <Route path="/content-studio" element={<Navigate to="/maya" replace />} />
                    <Route path="/video-creator" element={<Navigate to="/studio" replace />} />
                    <Route path="/create-video" element={<Navigate to="/studio" replace />} />
                  </>
                )}
                <Route path="/ad-generator" element={<Navigate to="/studio" replace />} />
                <Route path="/avatar-builder" element={<Navigate to="/avatars?tab=custom" replace />} />
                <Route path="/avatar-creator" element={<Navigate to="/avatars?tab=create" replace />} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
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
