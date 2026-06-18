import type { UseQueryResult } from "@tanstack/react-query";
import { useLocale } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import type { WorkerList } from "@/types";

export function LocalWorkerPanel({
  workersQ,
  workerDir,
  deployedScriptNames,
  onSelectDir,
}: {
  workersQ: UseQueryResult<WorkerList>;
  workerDir: string;
  deployedScriptNames: Set<string>;
  onSelectDir: (dir: string) => void;
}) {
  const { t, displayError } = useLocale();

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {t("worker.panel.local")}
      </h3>
      {workersQ.data?.root && (
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
          {t("worker.panel.localRoot")}{" "}
          <code className="mono">{workersQ.data.root}</code>
        </p>
      )}
      {workersQ.isLoading && (
        <p className="mt-3 text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
      )}
      {workersQ.isError && (
        <p className="mt-3 text-sm text-red-400">
          {displayError(
            workersQ.error instanceof Error ? workersQ.error.message : String(workersQ.error),
          )}
        </p>
      )}
      {workersQ.data && workersQ.data.workers.length === 0 && (
        <p className="mt-3 text-sm text-[var(--color-muted)]">{t("worker.panel.noWranglerDirs")}</p>
      )}
      {workersQ.data && workersQ.data.workers.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm">
          {workersQ.data.workers.map((w) => {
            const itemDeployed =
              Boolean(w.script_name) && deployedScriptNames.has(w.script_name!);
            const isSelected = w.dir === workerDir;
            return (
              <li key={w.dir}>
                <button
                  type="button"
                  onClick={() => onSelectDir(w.dir)}
                  className={
                    isSelected
                      ? "w-full rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-left"
                      : "w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-left hover:border-[var(--color-muted)]"
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="mono font-medium">{w.dir}</code>
                    {isSelected && <Chip variant="on">{t("worker.status.currentSelected")}</Chip>}
                    {w.script_name ? (
                      <Chip variant="default">script: {w.script_name}</Chip>
                    ) : (
                      <Chip variant="warn">{t("worker.status.noScriptName")}</Chip>
                    )}
                    {w.script_name && (
                      <Chip variant={itemDeployed ? "on" : "off"}>
                        {itemDeployed
                          ? t("worker.status.deployed")
                          : t("worker.status.notDeployed")}
                      </Chip>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
