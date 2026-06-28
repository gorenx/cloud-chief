import { forwardRef, useMemo } from "react";
import { useT } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import { WizardFlowShell } from "@/components/wizard/WizardFlowShell";
import type { SupabaseViewMode } from "@/components/supabase/SupabaseSetupWorkspace";
import {
  resolveSupabaseSetupCurrent,
  supabaseCoreDone,
  supabaseSetupProgress,
  supabaseStepDone,
  type SupabaseSetupStatus,
  type SupabaseSetupStep,
} from "@/lib/supabase-setup-flow";
import {
  formatNextSupabaseSetupAction,
  formatSupabaseSetupWarnings,
  formatSupabaseStepCardContent,
  getLocalizedSupabaseSteps,
} from "@/i18n/supabase-ui";

export const SupabaseSetupFlow = forwardRef<
  HTMLDivElement,
  {
    flowStatus: SupabaseSetupStatus;
    activeStep: SupabaseViewMode;
    onGoToStep: (step: SupabaseSetupStep) => void;
  }
>(function SupabaseSetupFlow({ flowStatus, activeStep, onGoToStep }, ref) {
  const t = useT();
  const steps = useMemo(() => getLocalizedSupabaseSteps(t), [t]);
  const coreDone = supabaseCoreDone(flowStatus);
  const action = formatNextSupabaseSetupAction(t, flowStatus);
  const progress = supabaseSetupProgress(flowStatus);
  const warnings = formatSupabaseSetupWarnings(t, flowStatus);
  const navSelected =
    activeStep === "all" ? resolveSupabaseSetupCurrent(flowStatus) : activeStep;
  const progressPct = Math.round((progress.totalDone / progress.totalSteps) * 100);

  const statusChips = (
    <>
      <Chip variant={flowStatus.connectDone ? "on" : "off"}>
        {flowStatus.connectDone
          ? t("supabase.status.connected")
          : t("supabase.status.notConnected")}
      </Chip>
      {flowStatus.projectRef && (
        <Chip variant={flowStatus.projectDone ? "on" : "off"}>
          <code className="mono">{flowStatus.projectRef}</code>
        </Chip>
      )}
      <Chip
        variant={
          flowStatus.databaseDone ? "on" : flowStatus.pendingMigrations > 0 ? "warn" : "off"
        }
      >
        {flowStatus.databaseDone
          ? t("supabase.status.migrationsSynced")
          : flowStatus.pendingMigrations > 0
            ? t("supabase.status.migrationsPending", { count: flowStatus.pendingMigrations })
            : t("supabase.status.migrationsUnchecked")}
      </Chip>
      <Chip
        variant={
          flowStatus.functionsDone ? "on" : flowStatus.pendingFunctions > 0 ? "warn" : "off"
        }
      >
        {flowStatus.functionsDone
          ? t("supabase.status.functionsDeployed")
          : flowStatus.pendingFunctions > 0
            ? t("supabase.status.functionsPending", { count: flowStatus.pendingFunctions })
            : t("supabase.status.functionsUnchecked")}
      </Chip>
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
      title={t("supabase.flow.title")}
      subtitle={t("supabase.flow.subtitle")}
      progressText={t("supabase.flow.progress", {
        done: progress.totalDone,
        total: progress.totalSteps,
      })}
      progressPct={progressPct}
      coreDone={coreDone}
      coreDoneBadge={coreDone ? t("supabase.flow.allDone") : undefined}
      action={action}
      warnings={warnings}
      statusChips={statusChips}
      showAllDone={!action && coreDone}
      allDoneMessage={t("supabase.flow.allDone")}
      stepDone={supabaseStepDone}
      stepWarn={(step, status) =>
        (step === "database" && status.needsDbScope && !supabaseStepDone(step, status)) ||
        (step === "functions" && status.needsFunctionsScope && !supabaseStepDone(step, status))
      }
      formatStepCardContent={formatSupabaseStepCardContent}
    />
  );
});
