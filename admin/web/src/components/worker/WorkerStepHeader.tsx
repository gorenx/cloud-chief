import type { LocalizedWorkerStep } from "@/i18n/worker-ui";
import { useT } from "@/contexts/LocaleContext";
import { ScrollSafeButton } from "@/components/ui/ScrollSafeButton";
import { cn } from "@/lib/utils";

/** 各步骤共用的顶栏：固定宽度步骤信息 + 项目名称 + 刷新 */
export function WorkerStepHeader({
  step,
  projectName,
  onRefresh,
  showStepBadge = true,
}: {
  step: Pick<LocalizedWorkerStep, "num" | "label" | "summary"> & { optional?: boolean };
  projectName?: string | null;
  onRefresh: () => void;
  showStepBadge?: boolean;
}) {
  const t = useT();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        <div className="flex w-[7.5rem] shrink-0 items-center gap-2">
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
          <span className="truncate text-sm font-semibold leading-tight">{step.label}</span>
        </div>

        {projectName ? (
          <code
            className="mono min-w-0 truncate rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] px-2 py-0.5 text-xs text-[var(--color-accent)]"
            title={projectName}
          >
            {projectName}
          </code>
        ) : null}

        {step.optional && (
          <span className="shrink-0 text-xs font-normal text-[var(--color-muted)]">
            {t("worker.status.optionalTag")}
          </span>
        )}
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
