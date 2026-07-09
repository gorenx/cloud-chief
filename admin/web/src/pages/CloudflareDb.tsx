import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, FileCode2 } from "lucide-react";
import { fetchState, fetchWorkerList, fetchWorkerStatus } from "@/lib/api";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useT, useLocale } from "@/contexts/LocaleContext";
import { CloudflareD1DatabaseCard } from "@/components/CloudflareD1DatabaseCard";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";

export function CloudflareDbPage() {
  const { token } = useAdminToken();
  const { displayError } = useLocale();
  const t = useT();
  const qc = useQueryClient();
  const [workerDir, setWorkerDir] = useState("");

  const workersQ = useQuery({
    queryKey: ["cloudflare-db-worker-list", token],
    queryFn: async () => {
      const r = await fetchWorkerList(token ?? "");
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const stateQ = useQuery({
    queryKey: ["cloudflare-db-state", token],
    queryFn: async () => {
      const r = await fetchState(token ?? "");
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (workersQ.data && !workerDir) setWorkerDir(workersQ.data.default);
  }, [workersQ.data, workerDir]);

  const statusQ = useQuery({
    queryKey: ["cloudflare-db-worker-status", token, workerDir],
    queryFn: async () => {
      const r = await fetchWorkerStatus(token ?? "", workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && workerDir),
  });

  const workers = workersQ.data?.workers ?? [];
  const status = statusQ.data?.worker_dir_rel === workerDir ? statusQ.data : undefined;
  const selectedName = useMemo(
    () => workers.find((w) => w.dir === workerDir)?.script_name ?? status?.worker_name ?? null,
    [status?.worker_name, workerDir, workers],
  );

  if (!token) {
    return <NoTokenPrompt />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("cloudflareDb.page.title")} description={t("cloudflareDb.page.desc")} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card>
          <CardTitle desc={t("cloudflareDb.card.worker.desc")}>
            {t("cloudflareDb.card.worker.title")}
          </CardTitle>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              {t("cloudflareDb.workerProject")}
            </span>
            <Select
              value={workerDir}
              onChange={(e) => setWorkerDir(e.target.value)}
              disabled={workersQ.isLoading}
            >
              {workers.length === 0 ? (
                <option value="">{t("cloudflareDb.noWorkers")}</option>
              ) : null}
              {workers.map((w) => (
                <option key={w.dir} value={w.dir}>
                  {w.script_name ? `${w.dir} · ${w.script_name}` : w.dir}
                </option>
              ))}
            </Select>
          </label>

          <div className="mt-4 grid gap-3 text-sm">
            <InfoRow label={t("cloudflareDb.workerName")}>
              {selectedName ? <code className="mono">{selectedName}</code> : <span>-</span>}
            </InfoRow>
            <InfoRow label={t("cloudflareDb.cloudflareToken")}>
              <Chip variant={stateQ.data?.has_api_token ? "on" : "off"}>
                {stateQ.isLoading
                  ? t("common.loading")
                  : stateQ.data?.has_api_token
                    ? t("worker.status.configured")
                    : t("worker.status.notConfigured")}
              </Chip>
            </InfoRow>
            <InfoRow label={t("cloudflareDb.bindings")}>
              {status?.d1_databases.length ? (
                <div className="space-y-1">
                  {status.d1_databases.map((db) => (
                    <div key={`${db.binding}:${db.database_id}`} className="mono break-all text-xs">
                      {db.binding} -&gt; {db.database_name}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[var(--color-muted)]">{t("cloudflareDb.noBindings")}</span>
              )}
            </InfoRow>
          </div>

          <div className="mt-5 border-t border-[var(--color-border-subtle)] pt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--color-muted)]">
              <FileCode2 className="size-4" aria-hidden />
              {t("cloudflareDb.migrations")}
            </div>
            {status?.d1_migrations.length ? (
              <div className="space-y-1">
                {status.d1_migrations.map((m) => (
                  <code
                    key={m.filename}
                    className="mono block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/40 px-2 py-1 text-xs text-[var(--color-muted)]"
                  >
                    {m.filename}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">{t("cloudflareDb.noMigrations")}</p>
            )}
          </div>

          {(workersQ.isError || statusQ.isError || stateQ.isError) && (
            <p className="mt-4 text-xs text-[var(--color-err)]">
              {displayError(
                workersQ.error instanceof Error
                  ? workersQ.error.message
                  : statusQ.error instanceof Error
                    ? statusQ.error.message
                    : stateQ.error instanceof Error
                      ? stateQ.error.message
                      : String(workersQ.error ?? statusQ.error ?? stateQ.error),
              )}
            </p>
          )}
        </Card>

        <CloudflareD1DatabaseCard
          token={token}
          workerDir={workerDir}
          status={status}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: ["cloudflare-db-worker-status"] });
            void qc.invalidateQueries({ queryKey: ["worker-status"] });
          }}
        />
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 size-5 shrink-0 text-[var(--color-accent)]" aria-hidden />
          <div className="min-w-0 text-sm leading-relaxed text-[var(--color-muted)]">
            <div className="font-medium text-[var(--color-text)]">{t("cloudflareDb.card.scope.title")}</div>
            <p className="mt-1">{t("cloudflareDb.card.scope.desc")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/30 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="min-w-0 text-[var(--color-text)]">{children}</div>
    </div>
  );
}
