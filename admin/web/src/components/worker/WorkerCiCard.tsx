import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Hint } from "@/components/ui/Hint";
import {
  fetchWorkerBuildsStatus,
  syncWorkerBuildsConfig,
  triggerWorkerBuild,
} from "@/lib/api";
import { shouldShowBuilderReconfigure } from "@/lib/worker-builds";
import { getWorkerCiHints, joinList } from "@/i18n/worker-ui";
import { WorkerBuilderTokenPanel } from "@/components/worker/WorkerBuilderTokenPanel";
import type { BuildTriggerInfo, WorkerBuildsStatus } from "@/types";

export function WorkerCiCard({
  token,
  workerDir,
  wranglerName,
}: {
  token: string;
  workerDir: string;
  wranglerName: string | null;
}) {
  const { t, displayError } = useLocale();
  const hints = useMemo(() => getWorkerCiHints(t), [t]);
  const qc = useQueryClient();
  const [reconfigureOpen, setReconfigureOpen] = useState(false);

  const buildsQ = useQuery({
    queryKey: ["worker-builds", token, workerDir],
    queryFn: async () => {
      const r = await fetchWorkerBuildsStatus(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && workerDir),
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await syncWorkerBuildsConfig(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(
        t("worker.toast.syncBuilds", { fields: joinList(t, data.updated) }),
      );
      void qc.invalidateQueries({ queryKey: ["worker-builds"] });
    },
    onError: (e) => {
      toast.error(displayError(e instanceof Error ? e.message : String(e)));
      if (/invalid token|authentication error|鉴权失败/i.test(String(e))) {
        setReconfigureOpen(true);
        void qc.invalidateQueries({ queryKey: ["worker-builds"] });
      }
    },
  });

  const triggerMut = useMutation({
    mutationFn: async () => {
      const r = await triggerWorkerBuild(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(t("worker.toast.triggerBuild", { name: data.trigger_name }));
      void qc.invalidateQueries({ queryKey: ["worker-builds"] });
    },
    onError: (e) => {
      toast.error(displayError(e instanceof Error ? e.message : String(e)));
      if (/invalid token|authentication error|鉴权失败/i.test(String(e))) {
        setReconfigureOpen(true);
        void qc.invalidateQueries({ queryKey: ["worker-builds"] });
      }
    },
  });

  const status = buildsQ.data;
  const connected = Boolean(status?.triggers.some((tr) => tr.repo?.repo_name));
  const showReconfigure =
    reconfigureOpen || Boolean(status && shouldShowBuilderReconfigure(status));
  const tokenInvalid = Boolean(
    status?.token_invalid || (status && shouldShowBuilderReconfigure(status) && status.token_configured),
  );

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <CardTitle desc={t("worker.card.ci.desc")}>
          <span className="inline-flex items-center gap-1.5">
            {t("worker.card.ci.title")}
            <Hint content={hints.section} />
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Hint content={hints.reconfigureToken}>
            <Button variant="ghost" size="sm" onClick={() => setReconfigureOpen(true)}>
              {t("btn.worker.reconfigureToken")}
            </Button>
          </Hint>
          <Hint content={hints.refresh}>
            <Button variant="ghost" size="sm" onClick={() => void buildsQ.refetch()}>
              {t("btn.common.refresh")}
            </Button>
          </Hint>
        </div>
      </div>

      {buildsQ.isLoading && (
        <p className="text-sm text-[var(--color-muted)]">{t("worker.ci.loading")}</p>
      )}
      {buildsQ.isError && (
        <p className="text-sm text-[var(--color-warn)]">
          {displayError(
            buildsQ.error instanceof Error ? buildsQ.error.message : String(buildsQ.error),
          )}
        </p>
      )}

      {showReconfigure && (
        <div className="mb-4">
          <WorkerBuilderTokenPanel
            adminToken={token}
            configured={Boolean(status?.token_configured && !tokenInvalid)}
            invalidMessage={tokenInvalid && status?.error ? status.error : undefined}
            forceOpen
            onSaved={() => setReconfigureOpen(false)}
          />
        </div>
      )}

      {status && !showReconfigure && (
        <BuildsBody status={status} connected={connected} wranglerName={wranglerName} />
      )}

      {status && showReconfigure && status.ok && (
        <BuildsBody
          status={status}
          connected={connected}
          wranglerName={wranglerName}
          compact
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {status?.dashboard_builds_url && (
          <Hint content={hints.connectGithub}>
            <a
              href={status.dashboard_builds_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-panel-elevated)]"
            >
              {t("btn.worker.connectGithub")}
            </a>
          </Hint>
        )}
        <Hint content={hints.syncMonorepo}>
          <Button
            variant="ghost"
            size="sm"
            disabled={!status?.ok || tokenInvalid || syncMut.isPending}
            onClick={() => syncMut.mutate()}
          >
            {t("btn.worker.syncMonorepo")}
          </Button>
        </Hint>
        <Hint content={hints.triggerBuild}>
          <Button
            size="sm"
            disabled={!status?.ok || tokenInvalid || !connected || triggerMut.isPending}
            onClick={() => triggerMut.mutate()}
          >
            {t("btn.worker.triggerCi")}
          </Button>
        </Hint>
      </div>

      <p className="mt-3 text-xs text-[var(--color-muted)]">{t("worker.ci.tokenNote")}</p>
    </Card>
  );
}

function BuildsBody({
  status,
  connected,
  wranglerName,
  compact,
}: {
  status: WorkerBuildsStatus;
  connected: boolean;
  wranglerName: string | null;
  compact?: boolean;
}) {
  const t = useLocale().t;

  if (!status.ok) {
    return <p className="text-sm text-[var(--color-warn)]">{status.error}</p>;
  }

  return (
    <div className={`space-y-4 text-sm ${compact ? "mt-4" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant={connected ? "on" : "off"}>
          GitHub{" "}
          {connected ? t("worker.status.githubConnected") : t("worker.status.githubNotConnected")}
        </Chip>
        {status.cf_script_name && (
          <span className="text-[var(--color-muted)]">
            {t("worker.ci.cfWorker")}
            <code>{status.cf_script_name}</code>
          </span>
        )}
      </div>

      {status.name_mismatch && wranglerName && (
        <p className="rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-3 py-2 text-[var(--color-warn)]">
          {t("worker.ci.nameMismatch", {
            wrangler: wranglerName,
            cf: status.cf_script_name ?? "",
          })}
        </p>
      )}

      {status.triggers.length === 0 ? (
        <p className="text-[var(--color-muted)]">{t("worker.ci.noTriggers")}</p>
      ) : (
        <div className="space-y-3">
          {status.triggers.map((tr) => (
            <TriggerBlock key={tr.trigger_uuid} trigger={tr} />
          ))}
        </div>
      )}

      {status.recent_builds.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">
            {t("worker.ci.recentBuilds")}
          </p>
          <ul className="space-y-1 text-xs text-[var(--color-muted)]">
            {status.recent_builds.map((b) => (
              <li key={b.build_uuid} className="font-mono">
                {b.build_outcome ?? "unknown"} · {b.branch ?? "?"} ·{" "}
                {b.commit_hash?.slice(0, 7) ?? "—"} · {formatTime(b.created_on)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TriggerBlock({ trigger }: { trigger: BuildTriggerInfo }) {
  const t = useLocale().t;
  const repo = trigger.repo?.repo_name;
  const owner = trigger.repo?.provider_account_name;
  return (
    <div className="rounded-lg border border-[var(--color-border)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{trigger.trigger_name}</span>
        <Chip variant={trigger.is_preview ? "off" : "on"}>
          {trigger.is_preview ? t("worker.status.preview") : t("worker.status.production")}
        </Chip>
      </div>
      <dl className="mt-2 grid gap-1 text-xs text-[var(--color-muted)]">
        {repo && (
          <div>
            {t("worker.ci.repo")}
            {owner ? `${owner}/` : ""}
            <code>{repo}</code>
          </div>
        )}
        <div>
          {t("worker.ci.branch")}
          {trigger.branch_includes.join(", ") || "—"}
          {trigger.branch_excludes.length > 0 &&
            t("worker.ci.branchExclude", { branches: trigger.branch_excludes.join(", ") })}
        </div>
        <div>
          {t("worker.ci.root")}
          <code>{trigger.root_directory || "—"}</code> · {t("worker.ci.build")}
          <code>{trigger.build_command || "—"}</code>
        </div>
        <div>
          {t("worker.ci.deploy")}
          <code>{trigger.deploy_command || "—"}</code>
        </div>
        <div>
          {t("worker.ci.watchPaths")}
          {trigger.path_includes.join(", ") || "—"}
          {trigger.path_excludes.length > 0 &&
            `${t("worker.ci.watchExclude")}${trigger.path_excludes.join(", ")}`}
        </div>
      </dl>
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
