import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import { WorkerSetupFlowStepNav } from "@/components/worker/WorkerSetupFlowStepNav";
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
  getLocalizedWorkerSteps,
} from "@/i18n/worker-ui";
import { cn } from "@/lib/utils";
import { navButtonFocusProps } from "@/lib/prevent-nav-scroll";

export function WorkerSetupFlow({
  flowStatus,
  activeStep,
  onGoToStep,
}: {
  flowStatus: WorkerSetupStatus;
  activeStep: WorkerSetupStep | "all";
  onGoToStep: (step: WorkerSetupStep) => void;
}) {
  const t = useT();
  const steps = useMemo(() => getLocalizedWorkerSteps(t), [t]);
  const coreDone = workerCoreDone(flowStatus);
  const action = formatNextWorkerSetupAction(t, flowStatus);
  const progress = workerSetupProgress(flowStatus);
  const warnings = formatWorkerSetupWarnings(t, flowStatus);
  const navSelected =
    activeStep === "all" ? resolveWorkerSetupCurrent(flowStatus) : activeStep;
  const [open, setOpen] = useState(!coreDone);

  const progressPct = Math.round((progress.totalDone / progress.totalSteps) * 100);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 p-4",
          open && "border-b border-[var(--color-border)]",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
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
              <h2 className="text-sm font-semibold">{t("worker.flow.title")}</h2>
              <span className="text-xs text-[var(--color-muted)]">
                {t("worker.flow.progress", {
                  coreDone: progress.coreDone,
                  coreTotal: progress.coreTotal,
                  totalDone: progress.totalDone,
                  totalSteps: progress.totalSteps,
                })}
              </span>
            </div>
            {!open && (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
                {steps.map((step) => {
                  const done = workerStepDone(step.id, flowStatus);
                  return (
                    <span
                      key={step.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                        activeStep === step.id &&
                          "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
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
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{t("worker.flow.subtitle")}</p>
            )}
            <div
              className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-[var(--color-panel-elevated)]"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {coreDone && (
            <span className="rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-xs text-emerald-400">
              {flowStatus.deployDone
                ? t("worker.flow.coreDoneDeployed")
                : t("worker.flow.coreDone")}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]"
          >
            {open ? t("btn.common.collapse") : t("btn.common.expand")}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 p-4 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {flowStatus.workerName && (
              <Chip variant="on">
                Worker <code className="mono">{flowStatus.workerName}</code>
              </Chip>
            )}
            <Chip variant={flowStatus.deployDone ? "on" : "off"}>
              {flowStatus.deployDone
                ? t("worker.status.deployed")
                : t("worker.status.notDeployed")}
            </Chip>
            <Chip variant={flowStatus.ciDone ? "on" : "off"}>
              GitHub CI{" "}
              {flowStatus.ciDone
                ? t("worker.status.ciReady")
                : t("worker.status.ciNotConfigured")}
            </Chip>
            {flowStatus.secretsLocalDone && !flowStatus.secretsProdDone && (
              <Chip variant="warn">{t("worker.status.prodSecretsPending")}</Chip>
            )}
          </div>

          <WorkerSetupFlowStepNav
            status={flowStatus}
            selectedStep={navSelected}
            onSelect={onGoToStep}
          />

          {action && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/40 px-3 py-2.5">
              <p className="text-xs text-[var(--color-muted)]">{action.text}</p>
              <button
                type="button"
                onClick={() => onGoToStep(action.step)}
                {...navButtonFocusProps}
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
              >
                {t("btn.common.goTo")}
              </button>
            </div>
          )}

          {warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/8 px-3 py-2.5 text-xs text-[var(--color-warn)]">
              {warnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          )}

          {!action && coreDone && flowStatus.deployDone && flowStatus.ciDone && (
            <p className="text-xs text-emerald-400">{t("worker.flow.allDone")}</p>
          )}
        </div>
      )}
    </div>
  );
}
