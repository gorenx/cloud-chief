import type { ReactNode } from "react";
import {
  WorkerSetupShowAllButton,
  WorkerSetupStepList,
  type WorkerViewMode,
} from "@/components/worker/WorkerSetupStepSidebar";
import type { WorkerSetupStatus, WorkerSetupStep } from "@/lib/worker-setup-flow";

export function WorkerSetupWorkspace({
  status,
  activeStep,
  onSelect,
  onShowAll,
  rightHeader,
  children,
}: {
  status: WorkerSetupStatus;
  activeStep: WorkerViewMode;
  onSelect: (step: WorkerSetupStep) => void;
  onShowAll: () => void;
  rightHeader: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      {/* 顶栏：左右同一行，底部分割线贯穿 */}
      <div className="flex border-b border-[var(--color-border)]">
        <div className="flex w-full shrink-0 items-center border-[var(--color-border)] bg-[var(--color-panel-elevated)]/25 px-3 py-3 sm:w-[12.5rem] sm:border-r">
          <WorkerSetupShowAllButton
            active={activeStep === "all"}
            onClick={onShowAll}
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center px-5 py-3">{rightHeader}</div>
      </div>

      {/* 主体：左侧步骤条 + 右侧内容 */}
      <div className="flex flex-col sm:flex-row">
        <aside className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-panel-elevated)]/25 p-3 sm:w-[12.5rem] sm:border-b-0 sm:border-r">
          <WorkerSetupStepList
            status={status}
            activeStep={activeStep}
            onSelect={onSelect}
          />
        </aside>
        <main className="min-w-0 flex-1 px-5 py-4">{children}</main>
      </div>
    </div>
  );
}
