import type { ReactNode } from "react";
import { WizardWorkspace } from "@/components/ui/WizardWorkspace";
import { WizardShowAllButton, WizardStepList } from "@/components/wizard/WizardStepSidebar";
import type { WizardLocalizedStep, WizardSidebarHandlers, WizardViewMode } from "@/components/wizard/types";

export function WizardPageWorkspace<TStep extends string, TStatus>({
  steps,
  status,
  activeStep,
  onSelect,
  onShowAll,
  rightHeader,
  children,
  scrollMain,
  stepDone,
  stepWarn,
  optionalLabel,
  showAllLabel,
}: {
  steps: WizardLocalizedStep<TStep>[];
  status: TStatus;
  activeStep: WizardViewMode<TStep>;
  onSelect: (step: TStep) => void;
  onShowAll: () => void;
  rightHeader: ReactNode;
  children: ReactNode;
  scrollMain?: boolean;
  optionalLabel?: string;
  showAllLabel?: string;
} & WizardSidebarHandlers<TStep, TStatus>) {
  return (
    <WizardWorkspace
      scrollMain={scrollMain}
      sidebarTop={
        <WizardShowAllButton
          active={activeStep === "all"}
          onClick={onShowAll}
          label={showAllLabel}
        />
      }
      sidebar={
        <WizardStepList
          steps={steps}
          status={status}
          activeStep={activeStep}
          onSelect={onSelect}
          stepDone={stepDone}
          stepWarn={stepWarn}
          optionalLabel={optionalLabel}
        />
      }
      rightHeader={rightHeader}
    >
      {children}
    </WizardWorkspace>
  );
}
