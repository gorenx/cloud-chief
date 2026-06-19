import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import { ClickTarget } from "@/components/ui/ClickTarget";
import { FlowPanel, FlowProgressBar } from "@/components/ui/SetupStepBadge";
import { SupabaseSetupFlowStepNav } from "@/components/supabase/SupabaseSetupFlowStepNav";
import type { SupabaseViewMode } from "@/components/supabase/SupabaseSetupStepSidebar";
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
  getLocalizedSupabaseSteps,
} from "@/i18n/supabase-ui";
import { cn } from "@/lib/utils";

export function SupabaseSetupFlow({
  flowStatus,
  activeStep,
  onGoToStep,
}: {
  flowStatus: SupabaseSetupStatus;
  activeStep: SupabaseViewMode;
  onGoToStep: (step: SupabaseSetupStep) => void;
}) {
  const t = useT();
  const steps = useMemo(() => getLocalizedSupabaseSteps(t), [t]);
  const coreDone = supabaseCoreDone(flowStatus);
  const action = formatNextSupabaseSetupAction(t, flowStatus);
  const progress = supabaseSetupProgress(flowStatus);
  const warnings = formatSupabaseSetupWarnings(t, flowStatus);
  const navSelected =
    activeStep === "all" ? resolveSupabaseSetupCurrent(flowStatus) : activeStep;
  const [open, setOpen] = useState(!coreDone);

  const progressPct = Math.round((progress.totalDone / progress.totalSteps) * 100);

  const toggleOpen = () => setOpen((v) => !v);

  return (
    <FlowPanel>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 p-4",
          open && "border-b border-[var(--color-border-subtle)]",
        )}
      >
        <ClickTarget
          onClick={toggleOpen}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform",
              !open && "-rotate-90",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-semibold">{t("supabase.flow.title")}</h2>
              <span className="text-xs text-[var(--color-muted)]">
                {t("supabase.flow.progress", {
                  done: progress.totalDone,
                  total: progress.totalSteps,
                })}
              </span>
            </div>
            {!open && (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
                {steps.map((step) => {
                  const done = supabaseStepDone(step.id, flowStatus);
                  return (
                    <span
                      key={step.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                        activeStep === step.id &&
                          "bg-[var(--color-accent-glow)] text-[var(--color-accent)]",
                        activeStep !== step.id && done && "text-emerald-400",
                      )}
                    >
                      {step.num}. {step.label}
                      {done && <Check className="h-3 w-3" />}
                    </span>
                  );
                })}
              </p>
            )}
            {open && (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{t("supabase.flow.subtitle")}</p>
            )}
            <FlowProgressBar value={progressPct} />
          </div>
        </ClickTarget>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {coreDone && (
            <span className="rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-xs text-emerald-400">
              {t("supabase.flow.allDone")}
            </span>
          )}
          <ClickTarget
            onClick={toggleOpen}
            className="rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]"
          >
            {open ? t("btn.common.collapse") : t("btn.common.expand")}
          </ClickTarget>
        </div>
      </div>

      {open && (
        <div className="space-y-4 p-4 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
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
          </div>

          <SupabaseSetupFlowStepNav
            status={flowStatus}
            selectedStep={navSelected}
            onSelect={onGoToStep}
          />

          {action && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/40 px-3 py-2.5">
              <p className="text-xs text-[var(--color-muted)]">{action.text}</p>
              <ClickTarget
                onClick={() => onGoToStep(action.step)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-glow)]"
              >
                {t("btn.common.goTo")}
              </ClickTarget>
            </div>
          )}

          {warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-[var(--radius-md)] border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/8 px-3 py-2.5 text-xs text-[var(--color-warn)]">
              {warnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          )}

          {!action && coreDone && (
            <p className="text-xs text-emerald-400">{t("supabase.flow.allDone")}</p>
          )}
        </div>
      )}
    </FlowPanel>
  );
}
