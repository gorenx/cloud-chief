import type { UseMutationResult } from "@tanstack/react-query";
import { useT } from "@/contexts/LocaleContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkerVarsCardHeader } from "@/components/worker/WorkerVarsCardHeader";
import { WorkerVarRow } from "@/components/worker/WorkerVarRow";
import type { WorkerVarRow as WorkerVarRowState } from "@/lib/worker-config";

export function WorkerVarsCard({
  vars,
  onChange,
  onSave,
  save,
  onSyncCf,
  cfSync,
  canSyncCf,
  varsOutOfSync,
  varsUnsaved,
}: {
  vars: WorkerVarRowState[];
  onChange: (rows: WorkerVarRowState[]) => void;
  onSave: () => void;
  save: UseMutationResult<void, Error, void, unknown>;
  onSyncCf?: () => void;
  cfSync?: UseMutationResult<
    { ok: true; script_name: string; updated_keys: string[] },
    Error,
    void,
    unknown
  >;
  canSyncCf?: boolean;
  varsOutOfSync?: boolean;
  varsUnsaved?: boolean;
}) {
  const t = useT();
  const alert = varsUnsaved ? (
    <p className="text-[var(--color-muted)]">{t("worker.card.varsLocal.saveBeforeSync")}</p>
  ) : varsOutOfSync ? (
    <p className="text-amber-300">{t("worker.card.varsLocal.cfMismatch")}</p>
  ) : undefined;

  return (
    <Card className="flex h-full flex-col">
      <WorkerVarsCardHeader title={t("worker.card.varsLocal.title")} alert={alert}>
        <p>{t("worker.card.varsLocal.descWrangler")}</p>
        <p>{t("worker.card.varsLocal.descSync")}</p>
      </WorkerVarsCardHeader>
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
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...vars, { k: "", v: "" }])}
        >
          {t("btn.worker.addVar")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onSave} disabled={save.isPending}>
          {t("btn.worker.saveVars")}
        </Button>
        {canSyncCf && onSyncCf && cfSync ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSyncCf}
            disabled={cfSync.isPending || !varsOutOfSync || varsUnsaved}
          >
            {t("btn.worker.syncCfVars")}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
