import { useMemo } from "react";
import { LayoutList } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import {
  supabaseStepDone,
  type SupabaseSetupStatus,
  type SupabaseSetupStep,
} from "@/lib/supabase-setup-flow";
import { getLocalizedSupabaseSteps } from "@/i18n/supabase-ui";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import { WizardSidebarButton, WizardSidebarStep } from "@/components/ui/WizardWorkspace";

export type SupabaseViewMode = SupabaseSetupStep | "all";

export function SupabaseSetupShowAllButton({
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

export function SupabaseSetupStepList({
  status,
  activeStep,
  onSelect,
}: {
  status: SupabaseSetupStatus;
  activeStep: SupabaseViewMode;
  onSelect: (step: SupabaseSetupStep) => void;
}) {
  const t = useT();
  const scrollRef = useScrollContainer();
  const steps = useMemo(() => getLocalizedSupabaseSteps(t), [t]);

  return (
    <nav className="flex flex-col gap-0.5" aria-label={t("aria.deploySteps")}>
      {steps.map((step) => {
        const done = supabaseStepDone(step.id, status);
        const warn =
          (step.id === "database" && status.needsDbScope && !done) ||
          (step.id === "functions" && status.needsFunctionsScope && !done);
        const selected = activeStep === step.id;

        return (
          <WizardSidebarStep
            key={step.id}
            active={selected}
            done={done}
            warn={warn}
            num={step.num}
            label={step.label}
            onClick={() => onSelect(step.id)}
            scrollRef={scrollRef}
          />
        );
      })}
    </nav>
  );
}
