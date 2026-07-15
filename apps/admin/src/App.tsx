import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import AdminGuard from "./components/layout/AdminGuard";

const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Users = lazy(() => import("./pages/Users"));
const Avatars = lazy(() => import("./pages/Avatars"));
const ApiLogs = lazy(() => import("./pages/ApiLogs"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
      Loading MagicBox admin…
    </div>
  );
}

export default function App() {
  return (
    <AdminAuthProvider>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(24, 24, 27, 0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
          },
        }}
      />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route
          path="/"
          element={
            <AdminGuard>
              <Dashboard />
            </AdminGuard>
          }
        />
        <Route
          path="/users"
          element={
            <AdminGuard>
              <Users />
            </AdminGuard>
          }
        />
        <Route
          path="/avatars"
          element={
            <AdminGuard>
              <Avatars />
            </AdminGuard>
          }
        />
        <Route
          path="/api-logs"
          element={
            <AdminGuard>
              <ApiLogs />
            </AdminGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <AdminGuard>
              <AdminSettings />
            </AdminGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AdminAuthProvider>
  );
}
