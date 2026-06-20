import { useMemo, type ReactNode } from "react";
import { useT } from "@/contexts/LocaleContext";
import { WizardPageWorkspace } from "@/components/wizard/WizardPageWorkspace";
import type { WizardViewMode } from "@/components/wizard/types";
import { workerStepDone, type WorkerSetupStatus, type WorkerSetupStep } from "@/lib/worker-setup-flow";
import { getLocalizedWorkerSteps } from "@/i18n/worker-ui";

export type WorkerViewMode = WizardViewMode<WorkerSetupStep>;

export function WorkerSetupWorkspace({
  status,
  activeStep,
  onSelect,
  onShowAll,
  rightHeader,
  children,
  scrollMain,
}: {
  status: WorkerSetupStatus;
  activeStep: WorkerViewMode;
  onSelect: (step: WorkerSetupStep) => void;
  onShowAll: () => void;
  rightHeader: ReactNode;
  children: ReactNode;
  scrollMain?: boolean;
}) {
  const t = useT();
  const steps = useMemo(() => getLocalizedWorkerSteps(t), [t]);

  return (
    <WizardPageWorkspace
      steps={steps}
      status={status}
      activeStep={activeStep}
      onSelect={onSelect}
      onShowAll={onShowAll}
      rightHeader={rightHeader}
      scrollMain={scrollMain}
      optionalLabel={t("worker.status.optionalTag")}
      stepDone={workerStepDone}
      stepWarn={(step, s) => step === "ci" && s.ciWarn && !workerStepDone(step, s)}
    >
      {children}
    </WizardPageWorkspace>
  );
}
