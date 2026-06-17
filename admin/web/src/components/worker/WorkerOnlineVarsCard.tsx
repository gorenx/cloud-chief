import { Card, CardTitle } from "@/components/ui/Card";
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
  const rows = script
    ? buildOnlineVarRows(script.vars, localVars, matched)
    : [];

  return (
    <Card>
      <CardTitle desc="CF API plain_text 绑定（只读）">环境变量 · 线上</CardTitle>
      {loading && <p className="text-sm text-[var(--color-muted)]">加载中…</p>}
      {error && <p className="text-sm text-amber-300">{error}</p>}
      {!loading && !error && !script && (
        <p className="text-sm text-[var(--color-muted)]">请选择已部署的 Worker</p>
      )}
      {script && (
        <>
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
              {rows.map((row) => (
                <WorkerVarRow key={row.k} k={row.k} v={row.v} readOnly />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">暂无环境变量</p>
          )}
        </>
      )}
    </Card>
  );
}
