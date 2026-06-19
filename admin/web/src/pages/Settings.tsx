import { useState } from "react";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { LOCALES } from "@/i18n";

export function SettingsPage() {
  const { token, setToken, saveToken } = useAdminToken();
  const { locale, setLocale, t } = useLocale();
  const [draft, setDraft] = useState(token);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader title={t("settings.title")} description={t("settings.desc")} />

      <Card>
        <CardTitle>{t("settings.adminToken")}</CardTitle>
        <Input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("settings.adminTokenPlaceholder")}
        />
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => {
              saveToken(draft.trim());
              toast.success(t("settings.toastSaved"));
            }}
          >
            {t("btn.settings.saveToken")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft("");
              setToken("");
              localStorage.removeItem("admin_token");
              toast.success(t("settings.toastCleared"));
            }}
          >
            {t("btn.settings.clearToken")}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle desc={t("settings.languageDesc")}>{t("settings.language")}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((item) => (
            <Button
              key={item.id}
              variant={locale === item.id ? "primary" : "ghost"}
              size="sm"
              onClick={() => setLocale(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle desc={t("settings.serverHintsDesc")}>{t("settings.serverHints")}</CardTitle>
        <ul className="space-y-2 text-sm text-[var(--color-muted)]">
          <li>{t("settings.hintBind", { addr: "127.0.0.1:8787" })}</li>
          <li>{t("settings.hintNetwork", { env: "ADMIN_BIND=0.0.0.0" })}</li>
          <li>{t("settings.hintTls")}</li>
          <li>{t("settings.hintWrangler")}</li>
        </ul>
      </Card>
    </div>
  );
}
