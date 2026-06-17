import { Card, CardTitle } from "@/components/ui/Card";
import { WorkerParamsSummary } from "@/components/worker/WorkerParamsSummary";
import type { CfDeployedWorker } from "@/types";

export function WorkerOnlineSecretsCard({
  script,
  prodSet,
  loading,
  error,
}: {
  script: CfDeployedWorker | null;
  prodSet: Set<string> | null;
  loading?: boolean;
  error?: string | null;
}) {
  const secrets = (script?.secret_names ?? []).map((name) => ({
    name,
    configured: prodSet ? prodSet.has(name) : undefined,
  }));

  return (
    <Card>
      <CardTitle desc="CF secret_text 绑定（值不可读）">私密配置 · 线上</CardTitle>
      {loading && <p className="text-sm text-[var(--color-muted)]">加载中…</p>}
      {error && <p className="text-sm text-amber-300">{error}</p>}
      {!loading && !error && !script && (
        <p className="text-sm text-[var(--color-muted)]">请选择已部署的 Worker</p>
      )}
      {script && (
        <>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            script: <code className="mono">{script.name}</code>
            {prodSet && " · ✓ 表示 wrangler 确认已存在于生产"}
          </p>
          <WorkerParamsSummary secrets={secrets} secretsLabel="线上 Secrets" />
        </>
      )}
    </Card>
  );
}
