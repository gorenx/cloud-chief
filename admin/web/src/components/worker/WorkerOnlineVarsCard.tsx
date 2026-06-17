import { Card, CardTitle } from "@/components/ui/Card";
import { WorkerParamsSummary } from "@/components/worker/WorkerParamsSummary";
import type { CfDeployedWorker } from "@/types";

export function WorkerOnlineVarsCard({
  script,
  compareVars,
  matched,
  loading,
  error,
}: {
  script: CfDeployedWorker | null;
  compareVars?: Record<string, string>;
  matched?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
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
          </p>
          <WorkerParamsSummary
            vars={script.vars}
            compareVars={matched ? compareVars : undefined}
            runtime={
              script.compatibility_date || script.usage_model
                ? [
                    script.compatibility_date
                      ? { label: "compatibility_date", value: script.compatibility_date }
                      : null,
                    script.usage_model
                      ? { label: "usage_model", value: script.usage_model }
                      : null,
                  ].filter((r): r is { label: string; value: string } => r !== null)
                : undefined
            }
          />
          {matched && compareVars && (
            <p className="mt-2 text-[11px] text-[var(--color-muted)]">
              已与本地 wrangler.toml [vars] 对照。
            </p>
          )}
        </>
      )}
    </Card>
  );
}
