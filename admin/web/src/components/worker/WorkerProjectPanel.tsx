import type { UseQueryResult } from "@tanstack/react-query";
import { WorkerCompareSection } from "@/components/worker/WorkerCompareSection";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { useT } from "@/contexts/LocaleContext";
import type { CfDeployedList, WorkerList, WorkerStatus } from "@/types";

export function WorkerProjectPanel({
  cfDeployedQ,
  workersQ,
  workerDir,
  deployedScriptNames,
  cfScriptName,
  status,
  onCfScriptNameChange,
  embedded,
}: {
  workersQ: UseQueryResult<WorkerList>;
  cfDeployedQ: UseQueryResult<CfDeployedList>;
  workerDir: string;
  deployedScriptNames: Set<string>;
  cfScriptName: string;
  status?: WorkerStatus;
  onCfScriptNameChange: (name: string) => void;
  embedded?: boolean;
}) {
  const scripts = cfDeployedQ.data?.ok ? cfDeployedQ.data.scripts : [];
  const onlineScript = scripts.find((s) => s.name === cfScriptName) ?? null;
  const matchedOnline = Boolean(
    status?.worker_name &&
      status.cf_match?.matched &&
      cfScriptName === status.worker_name,
  );

  const content = (
    <div className="space-y-6">
      <WorkerCompareSection
        workersQ={workersQ}
        cfDeployedQ={cfDeployedQ}
        workerDir={workerDir}
        cfScriptName={cfScriptName}
        deployedScriptNames={deployedScriptNames}
        status={status}
        onlineScript={onlineScript}
        matchedOnline={matchedOnline}
        onCfScriptNameChange={onCfScriptNameChange}
      />

      {status && <WorkerStatusBar status={status} />}
    </div>
  );

  if (embedded) return content;
  return <Card className="page-enter">{content}</Card>;
}

function WorkerStatusBar({ status }: { status: WorkerStatus }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_60%,transparent)] px-4 py-3 text-sm text-[var(--color-muted)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider">wrangler</span>
        {status.wrangler_version ? (
          <code className="mono text-[var(--color-text)]">{status.wrangler_version}</code>
        ) : (
          <span className="text-red-400">{t("worker.statusBar.wranglerNotDetected")}</span>
        )}
      </span>
      <span className="hidden h-3 w-px bg-[var(--color-border)] sm:block" aria-hidden />
      <Chip variant={status.logged_in ? "on" : "off"}>
        {status.logged_in ? t("worker.status.loggedIn") : t("worker.status.notLoggedIn")}
      </Chip>
      <span className="hidden h-3 w-px bg-[var(--color-border)] sm:block" aria-hidden />
      <span>
        {t("worker.statusBar.currentScript")}{" "}
        <code className="mono text-[var(--color-text)]">{status.worker_name ?? "-"}</code>
      </span>
      {status.cf_match?.matched && <Chip variant="on">{t("worker.statusBar.matchedOnline")}</Chip>}
      {status.cf_match && !status.cf_match.matched && status.worker_name && (
        <Chip variant="warn">{t("worker.statusBar.notDeployedCf")}</Chip>
      )}
      {status.cf_match?.url && (
        <a
          href={status.cf_match.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-[var(--color-accent)] hover:underline sm:text-sm"
        >
          {status.cf_match.url}
        </a>
      )}
    </div>
  );
}
