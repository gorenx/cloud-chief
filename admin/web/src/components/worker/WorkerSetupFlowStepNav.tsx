import { useMemo } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { workerStepDone, type WorkerSetupStatus, type WorkerSetupStep } from "@/lib/worker-setup-flow";
import { formatWorkerStepMeta, getLocalizedWorkerSteps } from "@/i18n/worker-ui";
import { cn } from "@/lib/utils";

export function WorkerSetupFlowStepNav({
  status,
  selectedStep,
  onSelect,
}: {
  status: WorkerSetupStatus;
  selectedStep: WorkerSetupStep;
  onSelect: (step: WorkerSetupStep) => void;
}) {
  const t = useT();
  const steps = useMemo(() => getLocalizedWorkerSteps(t), [t]);

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
      {steps.map((step, i) => {
        const done = workerStepDone(step.id, status);
        const warn = step.id === "ci" && status.ciWarn && !done;
        const isSelected = step.id === selectedStep;

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-stretch gap-2">
            {i > 0 && (
              <ChevronRight
                className="hidden h-4 w-4 shrink-0 self-center text-[var(--color-muted)] lg:block"
                aria-hidden
              />
            )}
            <div
              className={cn(
                "flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 transition-colors",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : done
                    ? "border-emerald-900/40 bg-emerald-950/20"
                    : warn
                      ? "border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10"
                      : "border-[var(--color-border)]",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                className="w-full flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done
                        ? "bg-emerald-600 text-white"
                        : warn
                          ? "bg-[var(--color-warn)] text-black"
                          : isSelected
                            ? "bg-[var(--color-accent)] text-white"
                            : "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </span>
                  <span className="font-medium">{step.label}</span>
                  {step.optional && (
                    <span className="rounded bg-[var(--color-panel-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                      {t("worker.status.optionalTag")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  {step.summary}
                </p>
                <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                  {formatWorkerStepMeta(t, step.id, status)}
                </p>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
