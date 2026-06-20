import { useMemo, type ReactNode } from "react";
import { WizardPageWorkspace } from "@/components/wizard/WizardPageWorkspace";
import type { WizardViewMode } from "@/components/wizard/types";
import {
  supabaseStepDone,
  type SupabaseSetupStatus,
  type SupabaseSetupStep,
} from "@/lib/supabase-setup-flow";
import { getLocalizedSupabaseSteps } from "@/i18n/supabase-ui";
import { useT } from "@/contexts/LocaleContext";

export type SupabaseViewMode = WizardViewMode<SupabaseSetupStep>;

export function SupabaseSetupWorkspace({
  status,
  activeStep,
  onSelect,
  onShowAll,
  rightHeader,
  children,
  scrollMain,
}: {
  status: SupabaseSetupStatus;
  activeStep: SupabaseViewMode;
  onSelect: (step: SupabaseSetupStep) => void;
  onShowAll: () => void;
  rightHeader: ReactNode;
  children: ReactNode;
  scrollMain?: boolean;
}) {
  const t = useT();
  const steps = useMemo(() => getLocalizedSupabaseSteps(t), [t]);

  return (
    <WizardPageWorkspace
      steps={steps}
      status={status}
      activeStep={activeStep}
      onSelect={onSelect}
      onShowAll={onShowAll}
      rightHeader={rightHeader}
      scrollMain={scrollMain}
      stepDone={supabaseStepDone}
      stepWarn={(step, s) =>
        (step === "database" && s.needsDbScope && !supabaseStepDone(step, s)) ||
        (step === "functions" && s.needsFunctionsScope && !supabaseStepDone(step, s))
      }
    >
      {children}
    </WizardPageWorkspace>
  );
}
