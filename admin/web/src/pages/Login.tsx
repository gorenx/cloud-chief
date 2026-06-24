import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useT } from "@/contexts/LocaleContext";
import { BrandMark } from "@/components/ui/BrandMark";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function LoginPage() {
  const { user, login, loading } = useAdminToken();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-[var(--color-bg)] p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-12" />
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--color-text)]">
              {t("login.title")}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{t("login.desc")}</p>
          </div>
        </div>

        <Card>
          <CardTitle>{t("login.formTitle")}</CardTitle>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (submitting) return;
              setSubmitting(true);
              void login(username.trim(), password)
                .then((r) => {
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  navigate(from, { replace: true });
                })
                .finally(() => setSubmitting(false));
            }}
          >
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("login.usernamePlaceholder")}
              autoComplete="username"
              required
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login.passwordPlaceholder")}
              autoComplete="current-password"
              required
            />
            <Button type="submit" className="w-full" disabled={submitting || !username || !password}>
              {submitting ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
          <p className="mt-4 text-xs text-[var(--color-muted)]">
            {t("login.defaultHint")}
            <span className="mt-1 block font-mono text-[var(--color-text)]/80">
              {t("login.usernameDefault")} / 123456
            </span>
          </p>
        </Card>
      </div>
    </div>
  );
}
