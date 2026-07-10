import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@shared/lib/auth";
import AuthGuard from "./components/layout/AuthGuard";
import OnboardingGate from "./components/layout/OnboardingGate";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Automations from "./pages/Automations";
import AutomationWizard from "./pages/AutomationWizard";
import BrandKit from "./pages/BrandKit";
import ContentStudio from "./pages/ContentStudio";
import VideoCreator from "./pages/VideoCreator";
import Library from "./pages/Library";
import Schedule from "./pages/Schedule";
import Analytics from "./pages/Analytics";
import AdGenerator from "./pages/AdGenerator";
import AvatarBuilder from "./pages/AvatarBuilder";
import AvatarCreator from "./pages/AvatarCreator";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OnboardingGate>
        <AppLayout>{children}</AppLayout>
      </OnboardingGate>
    </AuthGuard>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
          <Route path="/content-studio" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
          <Route path="/create-video" element={<ProtectedRoute><VideoCreator /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/ad-generator" element={<ProtectedRoute><AdGenerator /></ProtectedRoute>} />
          <Route path="/avatar-builder" element={<ProtectedRoute><AvatarBuilder /></ProtectedRoute>} />
          <Route path="/avatar-creator" element={<ProtectedRoute><AvatarCreator /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
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
