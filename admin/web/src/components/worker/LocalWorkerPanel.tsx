import type { UseQueryResult } from "@tanstack/react-query";
import { useLocale } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Select";
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
  const workers = workersQ.data?.workers ?? [];
  const selected = workers.find((w) => w.dir === workerDir);
  const itemDeployed =
    Boolean(selected?.script_name) && deployedScriptNames.has(selected!.script_name!);

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
      {workersQ.data && workers.length === 0 && (
        <p className="mt-3 text-sm text-[var(--color-muted)]">{t("worker.panel.noWranglerDirs")}</p>
      )}
      {workersQ.data && workers.length > 0 && (
        <div className="mt-3 space-y-2">
          <Select
            value={workerDir}
            onChange={(e) => onSelectDir(e.target.value)}
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

          {selected && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {selected.script_name ? (
                <Chip variant="default">
                  {t("worker.panel.workerName")}{" "}
                  <code className="mono">{selected.script_name}</code>
                </Chip>
              ) : (
                <Chip variant="warn">{t("worker.status.noScriptName")}</Chip>
              )}
              {selected.script_name && (
                <Chip variant={itemDeployed ? "on" : "off"}>
                  {itemDeployed
                    ? t("worker.status.deployed")
                    : t("worker.status.notDeployed")}
                </Chip>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
