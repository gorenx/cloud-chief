import type { ReactNode } from "react";
import {
  SupabaseSetupShowAllButton,
  SupabaseSetupStepList,
  type SupabaseViewMode,
} from "@/components/supabase/SupabaseSetupStepSidebar";
import type { SupabaseSetupStatus, SupabaseSetupStep } from "@/lib/supabase-setup-flow";

export function SupabaseSetupWorkspace({
  status,
  activeStep,
  onSelect,
  onShowAll,
  rightHeader,
  children,
}: {
  status: SupabaseSetupStatus;
  activeStep: SupabaseViewMode;
  onSelect: (step: SupabaseSetupStep) => void;
  onShowAll: () => void;
  rightHeader: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex border-b border-[var(--color-border)]">
        <div className="flex w-full shrink-0 items-center border-[var(--color-border)] bg-[var(--color-panel-elevated)]/25 px-3 py-3 sm:w-[12.5rem] sm:border-r">
          <SupabaseSetupShowAllButton active={activeStep === "all"} onClick={onShowAll} />
        </div>
        <div className="flex min-w-0 flex-1 items-center px-5 py-3">{rightHeader}</div>
      </div>

      <div className="flex flex-col sm:flex-row">
        <aside className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-panel-elevated)]/25 p-3 sm:w-[12.5rem] sm:border-b-0 sm:border-r">
          <SupabaseSetupStepList status={status} activeStep={activeStep} onSelect={onSelect} />
        </aside>
        <main className="min-w-0 flex-1 px-5 py-4">{children}</main>
      </div>
    </div>
  );
}
