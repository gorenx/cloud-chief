import type { UseMutationResult } from "@tanstack/react-query";
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
  return (
    <Card>
      <CardTitle desc="清单来自 .dev.vars.example">私密配置 · 本地</CardTitle>
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
          + 添加 secret
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSaveDevVars}
          disabled={devVarsSave.isPending}
        >
          保存到本地 .dev.vars
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onPushSecrets}
          disabled={secretsPush.isPending}
        >
          推送到生产
        </Button>
      </div>
    </Card>
  );
}
