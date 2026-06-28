import { forwardRef, useState, type ReactNode } from "react";
import { useT } from "@/contexts/LocaleContext";
import { FlowActionBar, FlowAllDoneMessage, FlowWarnings } from "@/components/flow/FlowShellBody";
import { FlowShellHeader } from "@/components/flow/FlowShellHeader";
import { FlowStepCardNav } from "@/components/flow/FlowStepCardNav";
import { FlowPanel } from "@/components/ui/SetupStepBadge";
import type { WizardLocalizedStep, WizardStepHandlers, WizardViewMode } from "@/components/wizard/types";

export type WizardFlowShellProps<TStep extends string, TStatus> = {
  flowStatus: TStatus;
  activeStep: WizardViewMode<TStep>;
  onGoToStep: (step: TStep) => void;
  steps: WizardLocalizedStep<TStep>[];
  navSelected: TStep;
  title: string;
  subtitle: string;
  progressText: string;
  progressPct: number;
  coreDone: boolean;
  coreDoneBadge?: string;
  action: { text: string; step: TStep } | null;
  warnings: string[];
  statusChips: ReactNode;
  showAllDone?: boolean;
  allDoneMessage?: string;
  optionalLabel?: string;
  children?: ReactNode;
} & WizardStepHandlers<TStep, TStatus>;

function WizardFlowShellInner<TStep extends string, TStatus>(
  {
    flowStatus,
    activeStep,
    onGoToStep,
    steps,
    navSelected,
    title,
    subtitle,
    progressText,
    progressPct,
    coreDone,
    coreDoneBadge,
    action,
    warnings,
    statusChips,
    showAllDone,
    allDoneMessage,
    optionalLabel,
    children,
    stepDone,
    stepWarn,
    formatStepCardContent,
  }: WizardFlowShellProps<TStep, TStatus>,
  ref: React.Ref<HTMLDivElement>,
) {
  const t = useT();
  const [open, setOpen] = useState(!coreDone);

  const handlePillClick = (step: TStep) => {
    if (!open) setOpen(true);
    onGoToStep(step);
  };

  return (
    <FlowPanel ref={ref}>
      <FlowShellHeader
        title={title}
        progressText={progressText}
        subtitle={subtitle}
        progressPct={progressPct}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        steps={steps}
        stepDone={(step) => stepDone(step, flowStatus)}
        activeStep={activeStep === "all" ? navSelected : activeStep}
        onStepPillClick={handlePillClick}
        coreDoneBadge={coreDone && coreDoneBadge ? coreDoneBadge : undefined}
      />

      {open && (
        <div className="space-y-4 p-4 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">{statusChips}</div>

          <FlowStepCardNav
            steps={steps}
            status={flowStatus}
            selectedStep={navSelected}
            onSelect={onGoToStep}
            stepDone={stepDone}
            stepWarn={stepWarn}
            formatStepCardContent={formatStepCardContent}
            optionalLabel={optionalLabel}
          />

          {children}

          {action && (
            <FlowActionBar
              text={action.text}
              goToLabel={t("btn.common.goTo")}
              focusLabel={t("btn.common.focusOnPage")}
              onClick={() => onGoToStep(action.step)}
            />
          )}

          <FlowWarnings warnings={warnings} />

          {showAllDone && allDoneMessage && <FlowAllDoneMessage message={allDoneMessage} />}
        </div>
      )}
    </FlowPanel>
  );
}

export const WizardFlowShell = forwardRef(WizardFlowShellInner) as <
  TStep extends string,
  TStatus,
>(
  props: WizardFlowShellProps<TStep, TStatus> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement;
