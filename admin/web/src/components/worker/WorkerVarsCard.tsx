import type { UseMutationResult } from "@tanstack/react-query";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkerVarRow } from "@/components/worker/WorkerVarRow";
import type { WorkerVarRow as WorkerVarRowState } from "@/lib/worker-config";

export function WorkerVarsCard({
  vars,
  onChange,
  onSave,
  save,
}: {
  vars: WorkerVarRowState[];
  onChange: (rows: WorkerVarRowState[]) => void;
  onSave: () => void;
  save: UseMutationResult<void, Error, void, unknown>;
}) {
  return (
    <Card>
      <CardTitle desc="wrangler.toml [vars]">环境变量 · 本地</CardTitle>
      <div className="space-y-2">
        {vars.map((row, i) => (
          <WorkerVarRow
            key={i}
            k={row.k}
            v={row.v}
            onChange={(k, v) => {
              const next = [...vars];
              next[i] = { k, v };
              onChange(next);
            }}
            onRemove={() => onChange(vars.filter((_, j) => j !== i))}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...vars, { k: "", v: "" }])}
        >
          + 添加变量
        </Button>
        <Button variant="ghost" size="sm" onClick={onSave} disabled={save.isPending}>
          保存变量
        </Button>
      </div>
    </Card>
  );
}
