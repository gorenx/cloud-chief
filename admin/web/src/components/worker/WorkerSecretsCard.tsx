import type { UseMutationResult } from "@tanstack/react-query";
import { useT } from "@/contexts/LocaleContext";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkerSecretRow } from "@/components/worker/WorkerSecretRow";
import type { WorkerSecretRowState } from "@/lib/worker-config";

export function WorkerSecretsCard({
  secrets,
  localSet,
  prodSet,
  onChange,
  onSaveDevVars,
  onPushSecrets,
  devVarsSave,
  secretsPush,
}: {
  secrets: WorkerSecretRowState[];
  localSet: Set<string>;
  prodSet: Set<string> | null;
  onChange: (rows: WorkerSecretRowState[]) => void;
  onSaveDevVars: () => void;
  onPushSecrets: () => void;
  devVarsSave: UseMutationResult<void, Error, void, unknown>;
  secretsPush: UseMutationResult<void, Error, void, unknown>;
}) {
  const t = useT();
  return (
    <Card>
      <CardTitle desc={t("worker.card.secretsLocal.desc")}>{t("worker.card.secretsLocal.title")}</CardTitle>
      <div className="space-y-3">
        {secrets.map((row, i) => (
          <WorkerSecretRow
            key={`${row.name}-${i}`}
            name={row.name}
            value={row.value}
            fixed={row.fixed}
            optional={row.optional}
            localOk={row.name ? localSet.has(row.name) : false}
            prodOk={row.name && prodSet ? prodSet.has(row.name) : null}
            onChange={(name, value) => {
              const next = [...secrets];
              next[i] = { ...next[i], name, value };
              onChange(next);
            }}
            onRemove={
              row.fixed ? undefined : () => onChange(secrets.filter((_, j) => j !== i))
            }
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange([...secrets, { name: "", value: "", fixed: false, optional: false }])
          }
        >
          {t("btn.worker.addSecret")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSaveDevVars}
          disabled={devVarsSave.isPending}
        >
          {t("btn.worker.saveDevVars")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onPushSecrets}
          disabled={secretsPush.isPending}
        >
          {t("btn.worker.pushSecrets")}
        </Button>
      </div>
    </Card>
  );
}
