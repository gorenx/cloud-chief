import { forwardRef, useMemo } from "react";
import { useT } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import { WizardFlowShell } from "@/components/wizard/WizardFlowShell";
import type { WorkerViewMode } from "@/components/worker/WorkerSetupWorkspace";
import {
  workerCoreDone,
  workerSetupProgress,
  workerStepDone,
  resolveWorkerSetupCurrent,
  type WorkerSetupStatus,
  type WorkerSetupStep,
} from "@/lib/worker-setup-flow";
import {
  formatNextWorkerSetupAction,
  formatWorkerSetupWarnings,
  formatWorkerStepCardContent,
  getLocalizedWorkerSteps,
} from "@/i18n/worker-ui";

export const WorkerSetupFlow = forwardRef<
  HTMLDivElement,
  {
    flowStatus: WorkerSetupStatus;
    activeStep: WorkerViewMode;
    onGoToStep: (step: WorkerSetupStep) => void;
  }
>(function WorkerSetupFlow({ flowStatus, activeStep, onGoToStep }, ref) {
  const t = useT();
  const steps = useMemo(() => getLocalizedWorkerSteps(t), [t]);
  const coreDone = workerCoreDone(flowStatus);
  const action = formatNextWorkerSetupAction(t, flowStatus);
  const progress = workerSetupProgress(flowStatus);
  const warnings = formatWorkerSetupWarnings(t, flowStatus);
  const navSelected =
    activeStep === "all" ? resolveWorkerSetupCurrent(flowStatus) : activeStep;
  const progressPct = Math.round((progress.totalDone / progress.totalSteps) * 100);

  const statusChips = (
    <>
      {flowStatus.workerName && (
        <Chip variant="on">
          Worker <code className="mono">{flowStatus.workerName}</code>
        </Chip>
      )}
      <Chip variant={flowStatus.deployDone ? "on" : "off"}>
        {flowStatus.deployDone ? t("worker.status.deployed") : t("worker.status.notDeployed")}
      </Chip>
      <Chip variant={flowStatus.ciDone ? "on" : "off"}>
        GitHub CI{" "}
        {flowStatus.ciDone ? t("worker.status.ciReady") : t("worker.status.ciNotConfigured")}
      </Chip>
      {flowStatus.secretsLocalDone && !flowStatus.secretsProdDone && (
        <Chip variant="warn">{t("worker.status.prodSecretsPending")}</Chip>
      )}
    </>
  );

  return (
    <WizardFlowShell
      ref={ref}
      flowStatus={flowStatus}
      activeStep={activeStep}
      onGoToStep={onGoToStep}
      steps={steps}
      navSelected={navSelected}
      title={t("worker.flow.title")}
      subtitle={t("worker.flow.subtitle")}
      progressText={t("worker.flow.progress", {
        coreDone: progress.coreDone,
        coreTotal: progress.coreTotal,
        totalDone: progress.totalDone,
        totalSteps: progress.totalSteps,
      })}
      progressPct={progressPct}
      coreDone={coreDone}
      coreDoneBadge={
        coreDone
          ? flowStatus.deployDone
            ? t("worker.flow.coreDoneDeployed")
            : t("worker.flow.coreDone")
          : undefined
      }
      action={action}
      warnings={warnings}
      statusChips={statusChips}
      showAllDone={!action && coreDone && flowStatus.deployDone && flowStatus.ciDone}
      allDoneMessage={t("worker.flow.allDone")}
      optionalLabel={t("worker.status.optionalTag")}
      stepDone={workerStepDone}
      stepWarn={(step, status) => step === "ci" && status.ciWarn && !workerStepDone(step, status)}
      formatStepCardContent={formatWorkerStepCardContent}
    />
  );
});
