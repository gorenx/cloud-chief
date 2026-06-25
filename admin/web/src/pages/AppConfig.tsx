import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Chip } from "@/components/ui/Chip";
import { fetchAppConfig, fetchAppConfigField, saveAppConfig } from "@/lib/api";
import type { AppConfigField, AppConfigSectionId } from "@/types";
import type { MessageKey } from "@/i18n";

type DraftMap = Record<string, string>;
type RevealedMap = Record<string, boolean>;
type LoadedMap = Record<string, { value: string; source: "db" | "env" }>;

const APP_CONFIG_SECTION_LABEL: Record<AppConfigSectionId, MessageKey> = {
  cloudflare: "appConfig.section.cloudflare",
  playground: "appConfig.section.playground",
  worker: "appConfig.section.worker",
  supabase: "appConfig.section.supabase",
  auth: "appConfig.section.auth",
};

function buildInitialDraft(fields: AppConfigField[]): DraftMap {
  const out: DraftMap = {};
  for (const f of fields) {
    if (!f.sensitive && f.has_value) out[f.key] = f.value;
    else out[f.key] = "";
  }
  return out;
}

function collectChanges(
  fields: AppConfigField[],
  draft: DraftMap,
): Record<string, string> | null {
  const values: Record<string, string> = {};
  for (const f of fields) {
    const d = draft[f.key] ?? "";
    if (f.sensitive) {
      if (d.trim()) values[f.key] = d.trim();
      continue;
    }
    if (d !== (f.has_value && !f.sensitive ? f.value : "")) {
      values[f.key] = d;
    }
  }
  return Object.keys(values).length ? values : null;
}

function AppConfigFieldRow({
  field,
  draft,
  revealed,
  loaded,
  onDraftChange,
  onToggleReveal,
}: {
  field: AppConfigField;
  draft: DraftMap;
  revealed: RevealedMap;
  loaded: LoadedMap;
  onDraftChange: (key: string, value: string) => void;
  onToggleReveal: (field: AppConfigField) => Promise<void>;
}) {
  const { t } = useLocale();
  const isRevealed = revealed[field.key] ?? false;
  const loadedEntry = loaded[field.key];
  const draftVal = draft[field.key] ?? "";
  const revealedVal = loadedEntry?.value ?? field.db_value ?? field.value;
  const displayVal = draftVal || (isRevealed ? revealedVal : "");
  const inputType = field.sensitive && !isRevealed ? "password" : "text";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-[var(--color-text)]" htmlFor={field.key}>
          {field.key}
        </label>
        {field.in_db ? (
          <Chip variant="on">{t("appConfig.badgeDb")}</Chip>
        ) : field.has_value ? (
          <Chip variant="warn">{t("appConfig.badgeEnv")}</Chip>
        ) : null}
        {isRevealed && loadedEntry ? (
          <Chip variant={loadedEntry.source === "db" ? "on" : "warn"}>
            {loadedEntry.source === "db" ? t("appConfig.sourceDb") : t("appConfig.sourceEnv")}
          </Chip>
        ) : null}
      </div>
      {field.hint ? <p className="text-xs text-[var(--color-muted)]">{field.hint}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={field.key}
          className="min-w-0 flex-1 font-mono text-xs"
          type={inputType}
          value={displayVal}
          placeholder={
            field.sensitive && field.has_value && !isRevealed
              ? t("appConfig.sensitivePlaceholder")
              : field.hint || field.key
          }
          onChange={(e) => onDraftChange(field.key, e.target.value)}
        />
        {field.has_value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 px-2"
            onClick={() => void onToggleReveal(field)}
            aria-label={isRevealed ? t("aria.hideSecret") : t("aria.showSecret")}
          >
            {isRevealed ? t("btn.common.hide") : t("btn.common.show")}
          </Button>
        ) : null}
      </div>
      {field.in_db && field.db_value && !isRevealed ? (
        <p className="text-xs text-[var(--color-muted)]">
          {t("appConfig.dbPreview", { value: field.db_value })}
        </p>
      ) : null}
    </div>
  );
}

export function AppConfigPage() {
  const { token } = useAdminToken();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const configQ = useQuery({
    queryKey: ["app-config"],
    queryFn: async () => {
      const r = await fetchAppConfig(token ?? "");
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const allFields = useMemo(
    () => configQ.data?.sections.flatMap((s) => s.fields) ?? [],
    [configQ.data],
  );

  const [draft, setDraft] = useState<DraftMap>({});
  const [draftInit, setDraftInit] = useState(false);
  const [revealed, setRevealed] = useState<RevealedMap>({});
  const [loaded, setLoaded] = useState<LoadedMap>({});

  useEffect(() => {
    if (!configQ.data || draftInit) return;
    setDraft(buildInitialDraft(allFields));
    setRevealed({});
    setLoaded({});
    setDraftInit(true);
  }, [configQ.data, allFields, draftInit]);

  const toggleReveal = useCallback(
    async (field: AppConfigField) => {
      if (!token) return;
      if (revealed[field.key]) {
        setRevealed((prev) => ({ ...prev, [field.key]: false }));
        return;
      }
      if (!loaded[field.key]) {
        const r = await fetchAppConfigField(token, field.key);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setLoaded((prev) => ({
          ...prev,
          [field.key]: { value: r.data.value, source: r.data.source },
        }));
      }
      setRevealed((prev) => ({ ...prev, [field.key]: true }));
    },
    [token, revealed, loaded],
  );

  const saveSection = useCallback(
    async (sectionId: string) => {
      if (!token) return;
      const section = configQ.data?.sections.find((s) => s.id === sectionId);
      if (!section) return;
      const changes = collectChanges(section.fields, draft);
      if (!changes) {
        toast.message(t("appConfig.toastNoChanges"));
        return;
      }
      const r = await saveAppConfig(token, changes);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("appConfig.toastSaved"));
      setDraftInit(false);
      setRevealed({});
      setLoaded({});
      await queryClient.invalidateQueries({ queryKey: ["app-config"] });
    },
    [token, configQ.data, draft, t, queryClient],
  );

  if (!token) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("appConfig.title")} description={t("appConfig.desc")} />
        <NoTokenPrompt />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("appConfig.title")} description={t("appConfig.desc")} />

      {configQ.isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
      ) : null}

      {configQ.data?.bootstrap_keys.length ? (
        <Card>
          <CardTitle desc={t("appConfig.bootstrapDesc")}>{t("appConfig.bootstrap")}</CardTitle>
          <ul className="space-y-1 text-sm text-[var(--color-muted)]">
            {configQ.data.bootstrap_keys.map((key) => (
              <li key={key}>
                <code className="text-[var(--color-text)]">{key}</code>
                <span className="ml-2">
                  {String(configQ.data?.bootstrap[key] ?? "") || t("appConfig.empty")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {configQ.data?.sections.map((section) => (
        <Card key={section.id}>
          <CardTitle>{t(APP_CONFIG_SECTION_LABEL[section.id])}</CardTitle>
          <div className="space-y-4">
            {section.fields.map((field) => (
              <AppConfigFieldRow
                key={field.key}
                field={field}
                draft={draft}
                revealed={revealed}
                loaded={loaded}
                onDraftChange={(key, value) =>
                  setDraft((prev) => ({ ...prev, [key]: value }))
                }
                onToggleReveal={toggleReveal}
              />
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={() => void saveSection(section.id)}>{t("btn.common.save")}</Button>
          </div>
        </Card>
      ))}

      <Card>
        <CardTitle desc={t("appConfig.migrateDesc")}>{t("appConfig.migrate")}</CardTitle>
        <p className="text-sm text-[var(--color-muted)]">{t("appConfig.migrateHint")}</p>
        <pre className="mt-3 rounded-md bg-[var(--color-surface-2)] p-3 text-xs">
          cd admin && pnpm migrate:env
        </pre>
      </Card>
    </div>
  );
}
