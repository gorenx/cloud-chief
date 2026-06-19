import { useMemo } from "react";
import { useT } from "@/contexts/LocaleContext";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { WorkerVarRow } from "@/components/worker/WorkerVarRow";
import { buildOnlineVarRows, type WorkerVarRow as WorkerVarRowState } from "@/lib/worker-config";
import type { CfDeployedWorker } from "@/types";

export function WorkerOnlineVarsCard({
  script,
  localVars,
  matched,
  loading,
  error,
}: {
  script: CfDeployedWorker | null;
  localVars?: WorkerVarRowState[];
  matched?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  const t = useT();
  const alignWithLocal = Boolean(localVars?.some((row) => row.k.trim()));
  const rows = script ? buildOnlineVarRows(script.vars, localVars, alignWithLocal) : [];
  const localByKey = useMemo(() => {
    const out: Record<string, string> = {};
    for (const row of localVars ?? []) {
      if (row.k.trim()) out[row.k.trim()] = row.v;
    }
    return out;
  }, [localVars]);

  return (
    <Card>
      <CardTitle desc={t("worker.card.varsOnline.desc")}>{t("worker.card.varsOnline.title")}</CardTitle>
      {loading && <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>}
      {error && <p className="text-sm text-amber-300">{error}</p>}
      {!loading && !error && !script && (
        <p className="text-sm text-[var(--color-muted)]">{t("worker.params.selectDeployed")}</p>
      )}
      {script && (
        <>
          {!matched && (
            <p className="mb-3 text-xs text-amber-300">{t("worker.card.varsOnline.scriptMismatch")}</p>
          )}
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            script: <code className="mono">{script.name}</code>
            {(script.compatibility_date || script.usage_model) && (
              <>
                {" "}
                ·{" "}
                {[
                  script.compatibility_date &&
                    `compatibility_date=${script.compatibility_date}`,
                  script.usage_model && `usage_model=${script.usage_model}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </>
            )}
          </p>
          {rows.length > 0 ? (
            <div className="space-y-2">
              {rows.map((row) => {
                const localValue = localByKey[row.k];
                const diff =
                  matched &&
                  localValue !== undefined &&
                  localValue !== row.v;
                return (
                  <div key={row.k} className="space-y-1">
                    <WorkerVarRow k={row.k} v={row.v} readOnly />
                    {diff && (
                      <div className="flex flex-wrap items-center gap-2 pl-1 text-[11px]">
                        <Chip variant="warn">{t("worker.params.valueMismatch")}</Chip>
                        <span className="text-[var(--color-muted)]">
                          {t("worker.card.varsOnline.pendingDeploy")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">{t("worker.params.noVars")}</p>
          )}
        </>
      )}
    </Card>
  );
}
