import type { UseQueryResult } from "@tanstack/react-query";
import { FolderGit2 } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { WorkerList } from "@/types";

function WorkerDirSelect({
  workersQ,
  workerDir,
  onSelectDir,
  className,
}: {
  workersQ: UseQueryResult<WorkerList>;
  workerDir: string;
  onSelectDir: (dir: string) => void;
  className?: string;
}) {
  const t = useT();
  const workers = workersQ.data?.workers ?? [];

  if (workersQ.isLoading) {
    return <span className="text-xs text-[var(--color-muted)]">{t("common.loading")}</span>;
  }
  if (workersQ.data && workers.length === 0) {
    return <span className="text-xs text-[var(--color-muted)]">{t("worker.panel.noWranglerDirs")}</span>;
  }
  if (!workersQ.data || workers.length === 0) return null;

  return (
    <Select
      className={cn(
        "border-[var(--color-border)] bg-[var(--color-bg-elevated)] font-display text-sm shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]",
        className,
      )}
      value={workerDir}
      onChange={(e) => onSelectDir(e.target.value)}
      aria-label={t("worker.panel.selectWorker")}
    >
      {!workerDir && (
        <option value="" disabled>
          {t("worker.panel.selectLocal")}
        </option>
      )}
      {workers.map((w) => {
        const label = w.script_name
          ? t("worker.panel.localOption", { dir: w.dir, name: w.script_name })
          : t("worker.panel.localOptionNoScript", { dir: w.dir });
        return (
          <option key={w.dir} value={w.dir}>
            {label}
          </option>
        );
      })}
    </Select>
  );
}

/** 内联下拉：用于步骤标题栏 */
export function WorkerProjectSelectorInline({
  workersQ,
  workerDir,
  onSelectDir,
  className,
}: {
  workersQ: UseQueryResult<WorkerList>;
  workerDir: string;
  onSelectDir: (dir: string) => void;
  className?: string;
}) {
  return (
    <WorkerDirSelect
      workersQ={workersQ}
      workerDir={workerDir}
      onSelectDir={onSelectDir}
      className={cn("min-w-[12rem] max-w-full py-2 sm:min-w-[16rem] sm:max-w-md", className)}
    />
  );
}

/** 卡片式（保留供 all-steps 等场景复用） */
export function WorkerProjectSelector({
  workersQ,
  workerDir,
  onSelectDir,
}: {
  workersQ: UseQueryResult<WorkerList>;
  workerDir: string;
  onSelectDir: (dir: string) => void;
}) {
  const t = useT();

  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-panel-elevated)_70%,transparent)]"
      aria-label={t("worker.panel.selectWorker")}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[var(--color-accent)] via-[var(--color-accent-dim)] to-transparent"
        aria-hidden
      />
      <div className="relative px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-glow)] ring-1 ring-[color-mix(in_srgb,var(--color-accent)_25%,transparent)]">
            <FolderGit2 className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold tracking-tight text-[var(--color-text)]">
              {t("worker.panel.selectWorker")}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">
              {t("worker.panel.selectWorkerHint")}
            </p>
          </div>
        </div>
        <WorkerDirSelect
          workersQ={workersQ}
          workerDir={workerDir}
          onSelectDir={onSelectDir}
          className="py-2.5"
        />
      </div>
    </section>
  );
}
