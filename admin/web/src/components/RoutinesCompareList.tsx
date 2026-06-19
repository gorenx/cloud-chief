import { useEffect, useMemo, useState } from "react";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useLocale } from "@/contexts/LocaleContext";
import type { SupabaseRoutineCompareRow } from "@/lib/api";
import { cn } from "@/lib/utils";

function PresenceMark({ on }: { on: boolean }) {
  return on ? (
    <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
  ) : (
    <Minus className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
  );
}

function StatusChip({ status }: { status: SupabaseRoutineCompareRow["status"] }) {
  const { t } = useLocale();
  if (status === "synced") return <Chip variant="on">{t("supabase.migrationSynced")}</Chip>;
  if (status === "local_only") return <Chip variant="warn">{t("supabase.migrationLocalOnly")}</Chip>;
  return <Chip variant="warn">{t("supabase.migrationRemoteOnly")}</Chip>;
}

function RoutineCompareDetail({
  row,
  onApply,
  applying,
  applyingName,
}: {
  row: SupabaseRoutineCompareRow;
  onApply: (name: string) => void;
  applying: boolean;
  applyingName?: string;
}) {
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="mono text-sm font-semibold text-[var(--color-text)]">{row.name}</code>
        <StatusChip status={row.status} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/30 p-3">
          <p className="text-[11px] font-medium text-[var(--color-text)]">
            {t("supabase.tableDetailLocal")}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span>{t("supabase.migrationColLocal")}</span>
            <PresenceMark on={row.local} />
            <span>{row.local ? t("supabase.tablePresent") : t("supabase.tableAbsent")}</span>
          </div>
          {row.source_files.length > 0 ? (
            <ul className="space-y-0.5 text-[10px] text-[var(--color-muted)]">
              {row.source_files.map((file) => (
                <li key={file}>
                  <code className="mono">{file}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.routineNoSourceFiles")}</p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/30 p-3">
          <p className="text-[11px] font-medium text-[var(--color-text)]">
            {t("supabase.tableDetailRemote")}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span>{t("supabase.migrationColRemote")}</span>
            <PresenceMark on={row.remote} />
            <span>{row.remote ? t("supabase.tablePresent") : t("supabase.tableAbsent")}</span>
          </div>
        </section>
      </div>

      {row.status === "local_only" && (
        <Button size="sm" disabled={applying} onClick={() => onApply(row.name)}>
          {applying && applyingName === row.name
            ? t("supabase.migrationApplying")
            : t("supabase.applyRoutine")}
        </Button>
      )}
    </div>
  );
}

export function RoutinesCompareList({
  rows,
  summary,
  onApply,
  applying,
  applyingName,
  onApplyAll,
  pendingCount,
}: {
  rows: SupabaseRoutineCompareRow[];
  summary: { local: number; remote: number; synced: number; pending: number };
  onApply: (name: string) => void;
  applying: boolean;
  applyingName?: string;
  onApplyAll?: () => void;
  pendingCount?: number;
}) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<string | null>(null);

  const selectedRow = useMemo(
    () => rows.find((r) => r.name === selected) ?? null,
    [rows, selected],
  );

  useEffect(() => {
    if (rows.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !rows.some((r) => r.name === selected)) {
      const prefer = rows.find((r) => r.status === "local_only") ?? rows[0];
      setSelected(prefer.name);
    }
  }, [rows, selected]);

  if (rows.length === 0) {
    return (
      <p className="text-xs text-[var(--color-muted)]">{t("supabase.noRoutinesCompared")}</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-[var(--color-text)]">
            {t("supabase.routinesCompareTitle")}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {t("supabase.routineCompareSummary", summary)}
          </p>
        </div>
        {onApplyAll && (pendingCount ?? 0) > 0 && (
          <Button size="sm" disabled={applying} onClick={onApplyAll}>
            {applying
              ? t("supabase.migrationApplying")
              : t("supabase.applyAllRoutines", { count: pendingCount ?? 0 })}
          </Button>
        )}
      </div>

      <div className="flex min-h-[12rem] flex-col sm:flex-row">
        <aside className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-panel-elevated)]/25 sm:w-[11rem] sm:border-b-0 sm:border-r">
          <nav
            className="flex max-h-48 flex-row gap-0.5 overflow-x-auto p-2 sm:max-h-none sm:flex-col sm:overflow-y-auto"
            aria-label={t("supabase.routineListAria")}
          >
            {rows.map((row) => {
              const active = row.name === selected;
              return (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => setSelected(row.name)}
                  className={cn(
                    "flex min-w-[7rem] items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors sm:min-w-0 sm:w-full",
                    active
                      ? "bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent)]"
                      : row.status === "synced"
                        ? "text-emerald-400 hover:bg-emerald-950/20"
                        : row.status === "local_only"
                          ? "text-amber-200 hover:bg-amber-500/10"
                          : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      row.status === "synced" && "bg-emerald-400",
                      row.status === "local_only" && "bg-amber-400",
                      row.status === "remote_only" && "bg-[var(--color-muted)]",
                    )}
                    aria-hidden
                  />
                  <code className="mono min-w-0 flex-1 truncate text-[11px]">{row.name}</code>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4">
          {selectedRow ? (
            <RoutineCompareDetail
              row={selectedRow}
              onApply={onApply}
              applying={applying}
              applyingName={applyingName}
            />
          ) : (
            <p className="text-xs text-[var(--color-muted)]">{t("supabase.routineDetailEmpty")}</p>
          )}
        </main>
      </div>
    </div>
  );
}
