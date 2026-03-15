import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@shared/lib/auth";
import AuthGuard from "./components/layout/AuthGuard";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AvatarBuilder from "./pages/AvatarBuilder";
import ContentStudio from "./pages/ContentStudio";
import AdGenerator from "./pages/AdGenerator";
import Library from "./pages/Library";
import Schedule from "./pages/Schedule";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
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
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/avatar-builder"
            element={
              <ProtectedRoute>
                <AvatarBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content-studio"
            element={
              <ProtectedRoute>
                <ContentStudio />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ad-generator"
            element={
              <ProtectedRoute>
                <AdGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <Schedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
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
