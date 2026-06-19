import type { ReactNode } from "react";
import {
  SupabaseSetupShowAllButton,
  SupabaseSetupStepList,
  type SupabaseViewMode,
} from "@/components/supabase/SupabaseSetupStepSidebar";
import { WizardWorkspace } from "@/components/ui/WizardWorkspace";
import type { SupabaseSetupStatus, SupabaseSetupStep } from "@/lib/supabase-setup-flow";

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
  return (
    <WizardWorkspace
      scrollMain={scrollMain}
      sidebarTop={
        <SupabaseSetupShowAllButton active={activeStep === "all"} onClick={onShowAll} />
      }
      sidebar={
        <SupabaseSetupStepList status={status} activeStep={activeStep} onSelect={onSelect} />
      }
      rightHeader={rightHeader}
    >
      {children}
    </WizardWorkspace>
  );
}
