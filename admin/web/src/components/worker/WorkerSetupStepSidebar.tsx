import { Check, LayoutList } from "lucide-react";
import {
  WORKER_SETUP_STEPS,
  workerStepDone,
  type WorkerSetupStatus,
  type WorkerSetupStep,
} from "@/lib/worker-setup-flow";
import { cn } from "@/lib/utils";

export type WorkerViewMode = WorkerSetupStep | "all";

export function WorkerSetupShowAllButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium transition-colors",
        active
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
      )}
    >
      <LayoutList className="h-3.5 w-3.5 shrink-0" aria-hidden />
      显示全部
    </button>
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
  return (
    <nav className="flex flex-col gap-0.5" aria-label="部署步骤">
      {WORKER_SETUP_STEPS.map((step) => {
        const done = workerStepDone(step.id, status);
        const warn = step.id === "ci" && status.ciWarn && !done;
        const selected = activeStep === step.id;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-2.5 text-left text-xs transition-colors",
              selected
                ? "bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent)]"
                : done
                  ? "text-emerald-400 hover:bg-emerald-950/20"
                  : warn
                    ? "text-[var(--color-warn)] hover:bg-[var(--color-warn)]/10"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                done
                  ? "bg-emerald-600 text-white"
                  : warn
                    ? "bg-[var(--color-warn)] text-black"
                    : selected
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : step.num}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {step.label}
              {step.optional && (
                <span className="ml-1 font-normal opacity-60">可选</span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
