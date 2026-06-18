import type { UseQueryResult } from "@tanstack/react-query";
import { useLocale } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Select";
import type { CfDeployedList, WorkerList } from "@/types";

export function CfWorkerPanel({
  cfDeployedQ,
  workersQ,
  cfScriptName,
  currentScriptName,
  onCfScriptNameChange,
}: {
  cfDeployedQ: UseQueryResult<CfDeployedList>;
  workersQ: UseQueryResult<WorkerList>;
  cfScriptName: string;
  currentScriptName?: string | null;
  onCfScriptNameChange: (name: string) => void;
}) {
  const { t, displayError } = useLocale();
  const scripts = cfDeployedQ.data?.ok ? cfDeployedQ.data.scripts : [];
  const selected = scripts.find((s) => s.name === cfScriptName);

  return (
    <section className="lg:border-l lg:border-[var(--color-border)] lg:pl-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {t("worker.panel.online")}
      </h3>
      {cfDeployedQ.data?.account_subdomain && (
        <p className="mt-1 text-[11px] text-[var(--color-muted)]">
          {t("worker.panel.onlineSubdomain")}{" "}
          <code className="mono">{cfDeployedQ.data.account_subdomain}.workers.dev</code>
        </p>
      )}

      {cfDeployedQ.isLoading && (
        <p className="mt-3 text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
      )}
      {cfDeployedQ.isError && (
        <p className="mt-3 text-sm text-red-400">
          {displayError(
            cfDeployedQ.error instanceof Error
              ? cfDeployedQ.error.message
              : String(cfDeployedQ.error),
          )}
        </p>
      )}
      {cfDeployedQ.data && !cfDeployedQ.data.ok && (
        <p className="mt-3 text-sm text-amber-300">
          {cfDeployedQ.data.error ?? t("worker.panel.cfListFailed")}
        </p>
      )}
      {cfDeployedQ.data?.ok && scripts.length === 0 && (
        <p className="mt-3 text-sm text-[var(--color-muted)]">{t("worker.panel.noDeployedWorkers")}</p>
      )}

      {cfDeployedQ.data?.ok && scripts.length > 0 && (
        <div className="mt-3 space-y-2">
          <Select
            value={cfScriptName}
            onChange={(e) => onCfScriptNameChange(e.target.value)}
          >
            {scripts.map((script) => {
              const localDir = workersQ.data?.workers.find(
                (w) => w.script_name === script.name,
              )?.dir;
              const label = [
                script.name,
                localDir ? t("worker.panel.localDirSuffix", { dir: localDir }) : null,
                currentScriptName === script.name ? t("worker.panel.matchCurrentSuffix") : null,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <option key={script.name} value={script.name}>
                  {label}
                </option>
              );
            })}
          </Select>

          {selected && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {currentScriptName === selected.name && (
                <Chip variant="on">{t("worker.status.matchCurrentLocal")}</Chip>
              )}
              <Chip variant={selected.subdomain_enabled ? "on" : "warn"}>
                workers.dev{" "}
                {selected.subdomain_enabled
                  ? t("worker.status.workersDevEnabled")
                  : t("worker.status.workersDevDisabled")}
              </Chip>
            </div>
          )}

          {selected?.url && (
            <a
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-[var(--color-accent)] hover:underline"
            >
              {selected.url}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
