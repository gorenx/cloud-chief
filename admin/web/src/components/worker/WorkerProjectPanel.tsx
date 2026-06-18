import type { UseQueryResult } from "@tanstack/react-query";
import { CfWorkerPanel } from "@/components/worker/CfWorkerPanel";
import { LocalWorkerPanel } from "@/components/worker/LocalWorkerPanel";
import { useT } from "@/contexts/LocaleContext";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { CfDeployedList, WorkerList, WorkerStatus } from "@/types";

export function WorkerProjectPanel({
  workersQ,
  cfDeployedQ,
  workerDir,
  deployedScriptNames,
  cfScriptName,
  status,
  onSelectDir,
  onCfScriptNameChange,
  onRefresh,
  embedded,
}: {
  workersQ: UseQueryResult<WorkerList>;
  cfDeployedQ: UseQueryResult<CfDeployedList>;
  workerDir: string;
  deployedScriptNames: Set<string>;
  cfScriptName: string;
  status?: WorkerStatus;
  onSelectDir: (dir: string) => void;
  onCfScriptNameChange: (name: string) => void;
  onRefresh: () => void;
  embedded?: boolean;
}) {
  const t = useT();
  const content = (
    <>
      {!embedded && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <CardTitle desc={t("worker.card.project.desc")}>{t("worker.card.project.title")}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            {t("btn.worker.refreshList")}
          </Button>
        </div>
      )}
      {embedded && (
        <div className="mb-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            {t("btn.worker.refreshList")}
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <LocalWorkerPanel
          workersQ={workersQ}
          workerDir={workerDir}
          deployedScriptNames={deployedScriptNames}
          onSelectDir={onSelectDir}
        />
        <CfWorkerPanel
          cfDeployedQ={cfDeployedQ}
          workersQ={workersQ}
          cfScriptName={cfScriptName}
          currentScriptName={status?.worker_name}
          onCfScriptNameChange={onCfScriptNameChange}
        />
      </div>

      {status && <WorkerStatusBar status={status} />}
    </>
  );

  if (embedded) return content;
  return <Card>{content}</Card>;
}

function WorkerStatusBar({ status }: { status: WorkerStatus }) {
  const t = useT();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-muted)]">
      <span>
        wrangler:{" "}
        {status.wrangler_version ? (
          <code className="mono">{status.wrangler_version}</code>
        ) : (
          <span className="text-red-400">{t("worker.statusBar.wranglerNotDetected")}</span>
        )}
      </span>
      <Chip variant={status.logged_in ? "on" : "off"}>
        {status.logged_in ? t("worker.status.loggedIn") : t("worker.status.notLoggedIn")}
      </Chip>
      <span>
        {t("worker.statusBar.currentScript")}{" "}
        <code className="mono">{status.worker_name ?? "-"}</code>
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
          className="text-[var(--color-accent)] hover:underline"
        >
          {status.cf_match.url}
        </a>
      )}
    </div>
  );
}
