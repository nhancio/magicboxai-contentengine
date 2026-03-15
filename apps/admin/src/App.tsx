import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import AdminGuard from "./components/layout/AdminGuard";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Avatars from "./pages/Avatars";
import ApiLogs from "./pages/ApiLogs";
import AdminSettings from "./pages/AdminSettings";

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
    </AdminAuthProvider>
  );
}
