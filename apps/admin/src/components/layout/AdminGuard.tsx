import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../contexts/AdminAuthContext";
import AdminLayout from "./AdminLayout";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
