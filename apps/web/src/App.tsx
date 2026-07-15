import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@shared/lib/auth";
import { capturePageview, identifyUser, resetAnalytics } from "@shared/lib/analytics";
import AuthGuard from "./components/layout/AuthGuard";
import OnboardingGate from "./components/layout/OnboardingGate";
import AppLayout from "./components/layout/AppLayout";
import ConsentBanner from "@shared/components/ConsentBanner";
import { LEGACY_TOOLS_ENABLED } from "./lib/flags";
import Login from "./pages/Login";

const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Automations = lazy(() => import("./pages/Automations"));
const AutomationWizard = lazy(() => import("./pages/AutomationWizard"));
const BrandKit = lazy(() => import("./pages/BrandKit"));
const ContentStudio = lazy(() => import("./pages/ContentStudio"));
const VideoCreator = lazy(() => import("./pages/VideoCreator"));
const Library = lazy(() => import("./pages/Library"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AdGenerator = lazy(() => import("./pages/AdGenerator"));
const AvatarBuilder = lazy(() => import("./pages/AvatarBuilder"));
const AvatarCreator = lazy(() => import("./pages/AvatarCreator"));
const Settings = lazy(() => import("./pages/Settings"));
const Pricing = lazy(() => import("./pages/Pricing"));
const NotFound = lazy(() => import("./pages/NotFound"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OnboardingGate>
        <AppLayout>{children}</AppLayout>
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
      identifyUser(user.uid, {
        email: user.email ?? undefined,
        name: user.displayName ?? undefined,
      });
    } else {
      resetAnalytics();
    }
  }, [user]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnalyticsTracker />
        <Suspense fallback={null}>
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
            <Route path="/automations" element={<ProtectedRoute><Automations /></ProtectedRoute>} />
            <Route path="/automations/new" element={<ProtectedRoute><AutomationWizard /></ProtectedRoute>} />
            <Route path="/automations/:id" element={<ProtectedRoute><AutomationWizard /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/posts" element={<ProtectedRoute><Library /></ProtectedRoute>} />
            <Route path="/brand" element={<ProtectedRoute><BrandKit /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            {LEGACY_TOOLS_ENABLED && (
              <>
                <Route path="/content-studio" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
                <Route path="/create-video" element={<ProtectedRoute><VideoCreator /></ProtectedRoute>} />
                <Route path="/ad-generator" element={<ProtectedRoute><AdGenerator /></ProtectedRoute>} />
                <Route path="/avatar-builder" element={<ProtectedRoute><AvatarBuilder /></ProtectedRoute>} />
                <Route path="/avatar-creator" element={<ProtectedRoute><AvatarCreator /></ProtectedRoute>} />
              </>
            )}
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
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
    </AuthProvider>
  );
}
