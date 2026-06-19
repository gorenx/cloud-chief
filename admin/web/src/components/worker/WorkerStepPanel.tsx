import type { LocalizedWorkerStep } from "@/i18n/worker-ui";
import { useT } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

export function WorkerStepPanelHeader({
  step,
  workerName,
}: {
  step: LocalizedWorkerStep;
  workerName?: string | null;
}) {
  const t = useT();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
          )}
        >
          {step.num}
        </span>
        <h3 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold leading-tight">
          <span>{step.label}</span>
          {step.optional && (
            <span className="text-xs font-normal text-[var(--color-muted)]">
              {t("worker.status.optionalTag")}
            </span>
          )}
          {workerName !== undefined && (
            <>
              <span className="text-xs font-normal text-[var(--color-muted)]">·</span>
              {workerName ? (
                <span className="inline-flex items-center gap-1 text-xs font-normal">
                  <span className="text-[var(--color-muted)]">{t("worker.panel.workerName")}</span>
                  <code className="mono font-medium text-[var(--color-text)]">{workerName}</code>
                </span>
              ) : (
                <span className="text-xs font-normal text-[var(--color-muted)]">
                  {t("worker.meta.projectEmpty")}
                </span>
              )}
            </>
          )}
        </h3>
      </div>
      <p className="max-w-[min(24rem,100%)] shrink-0 text-right text-xs leading-snug text-[var(--color-muted)] sm:max-w-[min(24rem,45%)]">
        {step.summary}
      </p>
    </div>
  );
}
