import { useMemo } from "react";
import { LayoutList } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { workerStepDone, type WorkerSetupStatus, type WorkerSetupStep } from "@/lib/worker-setup-flow";
import { getLocalizedWorkerSteps } from "@/i18n/worker-ui";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import { WizardSidebarButton, WizardSidebarStep } from "@/components/ui/WizardWorkspace";

export type WorkerViewMode = WorkerSetupStep | "all";

export function WorkerSetupShowAllButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const scrollRef = useScrollContainer();
  return (
    <WizardSidebarButton active={active} onClick={onClick} scrollRef={scrollRef}>
      <LayoutList className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {t("btn.worker.showAll")}
    </WizardSidebarButton>
  );
}

export function WorkerSetupStepList({
  status,
  activeStep,
  onSelect,
}: {
  status: WorkerSetupStatus;
  activeStep: WorkerViewMode;
  onSelect: (step: WorkerSetupStep) => void;
}) {
  const t = useT();
  const scrollRef = useScrollContainer();
  const steps = useMemo(() => getLocalizedWorkerSteps(t), [t]);

  return (
    <nav className="flex flex-col gap-0.5" aria-label={t("aria.deploySteps")}>
      {steps.map((step) => {
        const done = workerStepDone(step.id, status);
        const warn = step.id === "ci" && status.ciWarn && !done;
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
            optionalLabel={t("worker.status.optionalTag")}
            onClick={() => onSelect(step.id)}
            scrollRef={scrollRef}
          />
        );
      })}
    </nav>
  );
}
