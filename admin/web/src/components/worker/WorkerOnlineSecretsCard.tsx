import { useT } from "@/contexts/LocaleContext";
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
  const t = useT();
  const secrets = (script?.secret_names ?? []).map((name) => ({
    name,
    configured: prodSet ? prodSet.has(name) : undefined,
  }));

  return (
    <Card>
      <CardTitle desc={t("worker.card.secretsOnline.desc")}>
        {t("worker.card.secretsOnline.title")}
      </CardTitle>
      {loading && <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>}
      {error && <p className="text-sm text-amber-300">{error}</p>}
      {!loading && !error && !script && (
        <p className="text-sm text-[var(--color-muted)]">{t("worker.params.selectDeployed")}</p>
      )}
      {script && (
        <>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            script: <code className="mono">{script.name}</code>
            {prodSet && t("worker.params.prodHint")}
          </p>
          <WorkerParamsSummary
            secrets={secrets}
            secretsLabel={t("worker.params.secretsOnline")}
          />
        </>
      )}
    </Card>
  );
}
