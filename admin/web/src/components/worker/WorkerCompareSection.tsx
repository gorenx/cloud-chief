import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ArrowRightLeft, Cloud, ExternalLink, HardDrive, Link2 } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Select";
import type { CfDeployedList, CfDeployedWorker, WorkerList, WorkerStatus } from "@/types";

function CompareRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-start gap-x-3 gap-y-0.5 sm:grid-cols-[6rem_1fr]">
      <dt className="pt-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-[var(--color-text)]">{children}</dd>
    </div>
  );
}

function CompareCardShell({
  tone,
  icon,
  title,
  children,
}: {
  tone: "local" | "online";
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "local"
      ? "from-[color-mix(in_srgb,var(--color-ice)_8%,transparent)] to-transparent ring-[color-mix(in_srgb,var(--color-ice)_12%,transparent)]"
      : "from-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] to-transparent ring-[color-mix(in_srgb,var(--color-accent)_14%,transparent)]";

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br ${toneClass} p-4 ring-1 sm:p-5`}
    >
      <header className="mb-4 flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] ${
            tone === "local"
              ? "bg-cyan-950/40 text-[var(--color-ice)]"
              : "bg-[var(--color-accent-glow)] text-[var(--color-accent)]"
          }`}
        >
          {icon}
        </div>
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text)]">
          {title}
        </h3>
      </header>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
    </article>
  );
}

export function WorkerCompareSection({
  workersQ,
  cfDeployedQ,
  workerDir,
  cfScriptName,
  deployedScriptNames,
  status,
  onlineScript,
  matchedOnline,
  onCfScriptNameChange,
}: {
  workersQ: UseQueryResult<WorkerList>;
  cfDeployedQ: UseQueryResult<CfDeployedList>;
  workerDir: string;
  cfScriptName: string;
  deployedScriptNames: Set<string>;
  status?: WorkerStatus;
  onlineScript: CfDeployedWorker | null;
  matchedOnline: boolean;
  onCfScriptNameChange: (name: string) => void;
}) {
  const { t, displayError } = useLocale();
  const workers = workersQ.data?.workers ?? [];
  const selectedLocal = workers.find((w) => w.dir === workerDir);
  const scripts = cfDeployedQ.data?.ok ? cfDeployedQ.data.scripts : [];
  const localDeployed =
    Boolean(selectedLocal?.script_name) &&
    deployedScriptNames.has(selectedLocal!.script_name!);

  const showManualOnlinePicker =
    Boolean(status?.worker_name) && scripts.length > 0 && !matchedOnline;

  if (!workerDir) {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
        {t("worker.panel.selectLocal")}
      </p>
    );
  }

  return (
    <section aria-label={t("worker.panel.compareTitle")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[var(--color-muted)]">
          <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="text-[11px] font-medium uppercase tracking-[0.12em]">
            {t("worker.panel.compareTitle")}
          </span>
        </div>
        {matchedOnline && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/35 px-2.5 py-1 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-800/35">
            <Link2 className="h-3 w-3" strokeWidth={2.5} />
            {t("worker.status.matchCurrentLocal")}
          </span>
        )}
      </div>

      <div className="relative grid gap-4 lg:grid-cols-2 lg:gap-5">
        <CompareCardShell
          tone="local"
          icon={<HardDrive className="h-4 w-4" strokeWidth={2} />}
          title={t("worker.panel.local")}
        >
          <CompareRow label={t("worker.panel.dir")}>
            <code className="mono break-all text-[13px]">{selectedLocal?.dir ?? "—"}</code>
          </CompareRow>
          <CompareRow label={t("worker.panel.script")}>
            {selectedLocal?.script_name ? (
              <code className="mono text-[13px]">{selectedLocal.script_name}</code>
            ) : (
              <span className="text-[var(--color-muted)]">{t("worker.status.noScriptName")}</span>
            )}
          </CompareRow>
          {workersQ.data?.root && (
            <CompareRow label={t("worker.panel.localRoot")}>
              <code className="mono block truncate text-[11px] text-[var(--color-muted)]" title={workersQ.data.root}>
                {workersQ.data.root}
              </code>
            </CompareRow>
          )}
          <CompareRow label={t("worker.panel.status")}>
            <div className="flex flex-wrap gap-1.5">
              {selectedLocal?.script_name ? (
                <Chip variant={localDeployed ? "on" : "off"}>
                  {localDeployed ? t("worker.status.deployed") : t("worker.status.notDeployed")}
                </Chip>
              ) : (
                <Chip variant="warn">{t("worker.status.noScriptName")}</Chip>
              )}
            </div>
          </CompareRow>
        </CompareCardShell>

        <CompareCardShell
          tone="online"
          icon={<Cloud className="h-4 w-4" strokeWidth={2} />}
          title={t("worker.panel.online")}
        >
          {cfDeployedQ.isLoading && (
            <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
          )}
          {cfDeployedQ.isError && (
            <p className="text-sm text-red-400">
              {displayError(
                cfDeployedQ.error instanceof Error
                  ? cfDeployedQ.error.message
                  : String(cfDeployedQ.error),
              )}
            </p>
          )}
          {cfDeployedQ.data && !cfDeployedQ.data.ok && (
            <p className="text-sm text-amber-300">
              {cfDeployedQ.data.error ?? t("worker.panel.cfListFailed")}
            </p>
          )}
          {cfDeployedQ.data?.ok && scripts.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">{t("worker.panel.noDeployedWorkers")}</p>
          )}

          {cfDeployedQ.data?.ok && scripts.length > 0 && (
            <>
              {showManualOnlinePicker && (
                <div className="mb-1 space-y-2 rounded-[var(--radius-md)] border border-amber-900/35 bg-amber-950/20 p-3">
                  <p className="text-xs leading-relaxed text-amber-200/90">
                    {t("worker.panel.noOnlineMatch")}
                  </p>
                  <Select
                    value={cfScriptName}
                    onChange={(e) => onCfScriptNameChange(e.target.value)}
                    className="text-xs"
                  >
                    {!cfScriptName && (
                      <option value="" disabled>
                        {t("worker.panel.manualOnline")}
                      </option>
                    )}
                    {scripts.map((script) => {
                      const localDir = workers.find((w) => w.script_name === script.name)?.dir;
                      const label = [
                        script.name,
                        localDir ? t("worker.panel.localDirSuffix", { dir: localDir }) : null,
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
                </div>
              )}

              <CompareRow label={t("worker.panel.script")}>
                {onlineScript?.name ?? status?.worker_name ? (
                  <code className="mono text-[13px]">
                    {onlineScript?.name ?? status?.worker_name}
                  </code>
                ) : (
                  <span className="text-[var(--color-muted)]">—</span>
                )}
              </CompareRow>

              {cfDeployedQ.data.account_subdomain && (
                <CompareRow label={t("worker.panel.onlineSubdomain")}>
                  <code className="mono text-[13px]">
                    {cfDeployedQ.data.account_subdomain}.workers.dev
                  </code>
                </CompareRow>
              )}

              <CompareRow label={t("worker.panel.status")}>
                <div className="flex flex-wrap gap-1.5">
                  {matchedOnline && onlineScript && (
                    <Chip variant="on">{t("worker.status.matchCurrentLocal")}</Chip>
                  )}
                  {!matchedOnline && status?.worker_name && (
                    <Chip variant="warn">{t("worker.statusBar.notDeployedCf")}</Chip>
                  )}
                  {onlineScript && (
                    <Chip variant={onlineScript.subdomain_enabled ? "on" : "warn"}>
                      workers.dev{" "}
                      {onlineScript.subdomain_enabled
                        ? t("worker.status.workersDevEnabled")
                        : t("worker.status.workersDevDisabled")}
                    </Chip>
                  )}
                </div>
              </CompareRow>

              {onlineScript?.url && (
                <CompareRow label={t("worker.panel.url")}>
                  <a
                    href={onlineScript.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex max-w-full items-center gap-1.5 text-[13px] text-[var(--color-accent)] hover:underline"
                  >
                    <span className="truncate">{onlineScript.url}</span>
                    <ExternalLink
                      className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
                      strokeWidth={2}
                    />
                  </a>
                </CompareRow>
              )}
            </>
          )}
        </CompareCardShell>
      </div>
    </section>
  );
}
