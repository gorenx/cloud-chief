import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { WorkerSetupFlowStepNav } from "@/components/worker/WorkerSetupFlowStepNav";
import {
  WORKER_SETUP_STEPS,
  nextWorkerSetupAction,
  resolveWorkerSetupCurrent,
  workerCoreDone,
  workerSetupProgress,
  workerSetupWarnings,
  workerStepDone,
  type WorkerSetupStatus,
  type WorkerSetupStep,
} from "@/lib/worker-setup-flow";
import { cn } from "@/lib/utils";

export function WorkerSetupFlow({
  flowStatus,
  activeStep,
  onGoToStep,
}: {
  flowStatus: WorkerSetupStatus;
  activeStep: WorkerSetupStep | "all";
  onGoToStep: (step: WorkerSetupStep) => void;
}) {
  const coreDone = workerCoreDone(flowStatus);
  const action = nextWorkerSetupAction(flowStatus);
  const progress = workerSetupProgress(flowStatus);
  const warnings = workerSetupWarnings(flowStatus);
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
              <h2 className="text-sm font-semibold">部署流程</h2>
              <span className="text-xs text-[var(--color-muted)]">
                必做 {progress.coreDone}/{progress.coreTotal} · 总进度 {progress.totalDone}/
                {progress.totalSteps}
              </span>
            </div>
            {!open && (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
                {WORKER_SETUP_STEPS.map((step) => {
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
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                项目 → Vars → Secrets 为必做；GitHub CI 可选。支持本机 wrangler 部署或 push 自动构建。
              </p>
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
              必做步骤已完成
              {flowStatus.deployDone ? " · 已部署" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]"
          >
            {open ? "收起" : "展开"}
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
              {flowStatus.deployDone ? "已部署" : "未部署"}
            </Chip>
            <Chip variant={flowStatus.ciDone ? "on" : "off"}>
              GitHub CI {flowStatus.ciDone ? "已就绪" : "未配置"}
            </Chip>
            {flowStatus.secretsLocalDone && !flowStatus.secretsProdDone && (
              <Chip variant="warn">生产 Secret 待推送</Chip>
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
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
              >
                前往
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
            <p className="text-xs text-emerald-400">
              全部步骤已完成。Worker 已部署，GitHub CI 已配置。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
