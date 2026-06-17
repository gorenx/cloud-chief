import type { UseQueryResult } from "@tanstack/react-query";
import { CfWorkerPanel } from "@/components/worker/CfWorkerPanel";
import { LocalWorkerPanel } from "@/components/worker/LocalWorkerPanel";
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
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <CardTitle desc="本地目录与 Cloudflare 已部署脚本对照">Worker 项目</CardTitle>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          刷新列表
        </Button>
      </div>

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
    </Card>
  );
}

function WorkerStatusBar({ status }: { status: WorkerStatus }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-muted)]">
      <span>
        wrangler:{" "}
        {status.wrangler_version ? (
          <code className="mono">{status.wrangler_version}</code>
        ) : (
          <span className="text-red-400">未检测到</span>
        )}
      </span>
      <Chip variant={status.logged_in ? "on" : "off"}>
        {status.logged_in ? "已登录" : "未登录"}
      </Chip>
      <span>
        当前 script: <code className="mono">{status.worker_name ?? "-"}</code>
      </span>
      {status.cf_match?.matched && <Chip variant="on">已匹配线上</Chip>}
      {status.cf_match && !status.cf_match.matched && status.worker_name && (
        <Chip variant="warn">未部署到 CF</Chip>
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
