import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { ClickTarget } from "@/components/ui/ClickTarget";
import { workerStepDone, type WorkerSetupStatus, type WorkerSetupStep } from "@/lib/worker-setup-flow";
import { formatWorkerStepMeta, getLocalizedWorkerSteps } from "@/i18n/worker-ui";
import { SetupStepBadge, setupStepCardClasses } from "@/components/ui/SetupStepBadge";

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
                className="hidden h-4 w-4 shrink-0 self-center text-[var(--color-muted)]/50 lg:block"
                aria-hidden
              />
            )}
            <div className={setupStepCardClasses({ isSelected, done, warn })}>
              <ClickTarget
                onClick={() => onSelect(step.id)}
                className="w-full flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <SetupStepBadge done={done} warn={warn} selected={isSelected} num={step.num} />
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
              </ClickTarget>
            </div>
          </div>
        );
      })}
    </div>
  );
}
