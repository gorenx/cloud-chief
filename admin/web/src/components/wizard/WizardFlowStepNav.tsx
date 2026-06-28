import { ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { ClickTarget } from "@/components/ui/ClickTarget";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import { SetupStepBadge, setupStepCardClasses } from "@/components/ui/SetupStepBadge";
import type { WizardLocalizedStep, WizardStepHandlers } from "@/components/wizard/types";
import type { TranslateFn } from "@/i18n";

export function WizardFlowStepNav<TStep extends string, TStatus>({
  steps,
  status,
  selectedStep,
  onSelect,
  stepDone,
  stepWarn,
  formatStepMeta,
  formatStepDetail,
  optionalLabel,
}: {
  steps: WizardLocalizedStep<TStep>[];
  status: TStatus;
  selectedStep: TStep;
  onSelect: (step: TStep) => void;
  optionalLabel?: string;
  formatStepDetail?: (t: TranslateFn, step: TStep, status: TStatus) => string | null;
} & WizardStepHandlers<TStep, TStatus>) {
  const t = useT();
  const scrollRef = useScrollContainer();

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
      {steps.map((step, i) => {
        const done = stepDone(step.id, status);
        const warn = stepWarn?.(step.id, status) ?? false;
        const isSelected = step.id === selectedStep;
        const detail = formatStepDetail?.(t, step.id, status);

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
                scrollRef={scrollRef}
                className="w-full flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <SetupStepBadge done={done} warn={warn} selected={isSelected} num={step.num} />
                  <span className="font-medium">{step.label}</span>
                  {step.optional && optionalLabel && (
                    <span className="rounded bg-[var(--color-panel-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                      {optionalLabel}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  {step.summary}
                </p>
                <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                  {formatStepMeta(t, step.id, status)}
                </p>
                {detail && (
                  <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-[var(--color-muted)]/90">
                    {detail}
                  </p>
                )}
              </ClickTarget>
            </div>
          </div>
        );
      })}
    </div>
  );
}
