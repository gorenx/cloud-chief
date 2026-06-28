import type { UseQueryResult } from "@tanstack/react-query";
import type { LocalizedWorkerStep } from "@/i18n/worker-ui";
import { useT } from "@/contexts/LocaleContext";
import { ScrollSafeButton } from "@/components/ui/ScrollSafeButton";
import { WorkerProjectSelectorInline } from "@/components/worker/WorkerProjectSelector";
import { cn } from "@/lib/utils";
import type { WorkerList } from "@/types";

/** 各步骤共用的顶栏：步骤标题 + 固定 Worker 下拉 + 刷新 */
export function WorkerStepHeader({
  step,
  workersQ,
  workerDir,
  onSelectDir,
  onRefresh,
  showStepBadge = true,
}: {
  step: Pick<LocalizedWorkerStep, "num" | "label" | "summary"> & { optional?: boolean };
  workersQ: UseQueryResult<WorkerList>;
  workerDir: string;
  onSelectDir: (dir: string) => void;
  onRefresh: () => void;
  showStepBadge?: boolean;
}) {
  const t = useT();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showStepBadge && (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
            )}
          >
            {step.num}
          </span>
        )}
        <WorkerProjectSelectorInline
          workersQ={workersQ}
          workerDir={workerDir}
          onSelectDir={onSelectDir}
        />
        <h3 className="hidden min-w-0 items-center gap-2 text-sm font-semibold leading-tight md:flex">
          <span className="truncate">{step.label}</span>
          {step.optional && (
            <span className="shrink-0 text-xs font-normal text-[var(--color-muted)]">
              {t("worker.status.optionalTag")}
            </span>
          )}
        </h3>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <p className="hidden max-w-[min(20rem,100%)] text-right text-xs leading-snug text-[var(--color-muted)] lg:block">
          {step.summary}
        </p>
        <ScrollSafeButton variant="ghost" size="sm" onAction={onRefresh}>
          {t("btn.worker.refreshList")}
        </ScrollSafeButton>
      </div>
    </div>
  );
}
