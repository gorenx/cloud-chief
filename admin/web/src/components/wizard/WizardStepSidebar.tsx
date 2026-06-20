import { LayoutList } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import { WizardSidebarButton, WizardSidebarStep } from "@/components/ui/WizardWorkspace";
import type { WizardLocalizedStep, WizardStepHandlers, WizardViewMode } from "@/components/wizard/types";

export function WizardShowAllButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label?: string;
}) {
  const t = useT();
  const scrollRef = useScrollContainer();

  return (
    <WizardSidebarButton active={active} onClick={onClick} scrollRef={scrollRef}>
      <LayoutList className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label ?? t("btn.worker.showAll")}
    </WizardSidebarButton>
  );
}

export function WizardStepList<TStep extends string, TStatus>({
  steps,
  status,
  activeStep,
  onSelect,
  stepDone,
  stepWarn,
  optionalLabel,
}: {
  steps: WizardLocalizedStep<TStep>[];
  status: TStatus;
  activeStep: WizardViewMode<TStep>;
  onSelect: (step: TStep) => void;
  optionalLabel?: string;
} & WizardStepHandlers<TStep, TStatus>) {
  const t = useT();
  const scrollRef = useScrollContainer();

  return (
    <nav className="flex flex-col gap-0.5" aria-label={t("aria.deploySteps")}>
      {steps.map((step) => {
        const done = stepDone(step.id, status);
        const warn = stepWarn?.(step.id, status) ?? false;
        const selected = activeStep === step.id;

        return (
          <WizardSidebarStep
            key={step.id}
            active={selected}
            done={done}
            warn={warn}
            num={step.num}
            label={step.label}
            optional={step.optional}
            optionalLabel={optionalLabel}
            onClick={() => onSelect(step.id)}
            scrollRef={scrollRef}
          />
        );
      })}
    </nav>
  );
}
