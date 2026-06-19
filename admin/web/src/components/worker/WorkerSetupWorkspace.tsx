import type { ReactNode } from "react";
import {
  WorkerSetupShowAllButton,
  WorkerSetupStepList,
  type WorkerViewMode,
} from "@/components/worker/WorkerSetupStepSidebar";
import { WizardWorkspace } from "@/components/ui/WizardWorkspace";
import type { WorkerSetupStatus, WorkerSetupStep } from "@/lib/worker-setup-flow";

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
  return (
    <WizardWorkspace
      scrollMain={scrollMain}
      sidebarTop={
        <WorkerSetupShowAllButton active={activeStep === "all"} onClick={onShowAll} />
      }
      sidebar={
        <WorkerSetupStepList status={status} activeStep={activeStep} onSelect={onSelect} />
      }
      rightHeader={rightHeader}
    >
      {children}
    </WizardWorkspace>
  );
}
