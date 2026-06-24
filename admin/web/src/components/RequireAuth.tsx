import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useT } from "@/contexts/LocaleContext";

export function RequireAuth() {
  const { user, loading } = useAdminToken();
  const t = useT();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-[var(--color-bg)] text-sm text-[var(--color-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
