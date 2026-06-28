import type { UseQueryResult } from "@tanstack/react-query";
import { FolderGit2 } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { WorkerProjectSelectorInline } from "@/components/worker/WorkerProjectSelector";
import { cn } from "@/lib/utils";
import type { WorkerList } from "@/types";

export const WORKER_LOCAL_DIR_SELECT_ID = "worker-local-dir-select";

/** 左侧栏顶：本地 Worker 下拉 + 关联 label 打开目录选择 */
export function WorkerSidebarProjectBar({
  workersQ,
  workerDir,
  onSelectDir,
}: {
  workersQ: UseQueryResult<WorkerList>;
  workerDir: string;
  onSelectDir: (dir: string) => void;
}) {
  const t = useT();
  const canPick = (workersQ.data?.workers.length ?? 0) > 0;

  return (
    <div className="flex w-full items-center gap-1.5">
      <WorkerProjectSelectorInline
        workersQ={workersQ}
        workerDir={workerDir}
        onSelectDir={onSelectDir}
        selectId={WORKER_LOCAL_DIR_SELECT_ID}
        className="min-w-0 flex-1 py-1.5 sm:min-w-0 sm:max-w-none"
      />
      <label
        htmlFor={canPick ? WORKER_LOCAL_DIR_SELECT_ID : undefined}
        title={t("worker.panel.pickLocalDir")}
        aria-label={t("worker.panel.pickLocalDir")}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)]",
          "border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)]",
          "transition-colors hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-accent)]",
          !canPick && "pointer-events-none opacity-40",
        )}
      >
        <FolderGit2 className="h-4 w-4" aria-hidden />
      </label>
    </div>
  );
}
