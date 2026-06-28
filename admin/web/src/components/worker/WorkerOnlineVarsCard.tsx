import { useMemo } from "react";
import { useT } from "@/contexts/LocaleContext";
import { Card } from "@/components/ui/Card";
import { WorkerOnlineScriptMeta } from "@/components/worker/WorkerOnlineScriptMeta";
import { WorkerVarsCardHeader } from "@/components/worker/WorkerVarsCardHeader";
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

  const alert =
    script && !matched ? (
      <p className="text-amber-300">{t("worker.card.varsOnline.scriptMismatch")}</p>
    ) : !script && !loading && !error ? (
      <p className="text-[var(--color-muted)]">{t("worker.params.selectDeployed")}</p>
    ) : undefined;

  return (
    <Card className="flex h-full flex-col">
      <WorkerVarsCardHeader title={t("worker.card.varsOnline.title")} alert={alert}>
        <p>{t("worker.card.varsOnline.desc")}</p>
        {script ? <WorkerOnlineScriptMeta script={script} /> : <p aria-hidden>&nbsp;</p>}
      </WorkerVarsCardHeader>
      {loading && <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>}
      {error && <p className="text-sm text-amber-300">{error}</p>}
      {script && (
        <>
          {rows.length > 0 ? (
            <div className="space-y-2">
              {rows.map((row) => {
                const localValue = localByKey[row.k];
                const diff =
                  matched && localValue !== undefined && localValue !== row.v;
                return (
                  <WorkerVarRow
                    key={row.k}
                    k={row.k}
                    v={row.v}
                    readOnly
                    diff={diff}
                  />
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
