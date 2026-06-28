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
  sidebarTop,
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
  onShowAll?: () => void;
  /** 若提供则替代默认「显示全部」按钮 */
  sidebarTop?: ReactNode;
  rightHeader: ReactNode;
  children: ReactNode;
  scrollMain?: boolean;
  optionalLabel?: string;
  showAllLabel?: string;
} & WizardSidebarHandlers<TStep, TStatus>) {
  const sidebarTopNode =
    sidebarTop ??
    (onShowAll ? (
      <WizardShowAllButton
        active={activeStep === "all"}
        onClick={onShowAll}
        label={showAllLabel}
      />
    ) : null);

  return (
    <WizardWorkspace
      scrollMain={scrollMain}
      sidebarTop={sidebarTopNode}
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
