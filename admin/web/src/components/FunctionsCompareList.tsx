import { useMemo, useState } from "react";
import { Check, Minus } from "lucide-react";
import { ScrollSafeButton } from "@/components/ui/ScrollSafeButton";
import { Chip } from "@/components/ui/Chip";
import { useLocale } from "@/contexts/LocaleContext";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import type { SupabaseFunctionCompareRow } from "@/lib/api";
import { cn } from "@/lib/utils";
import { runOnMouseDownWithoutScrollJump } from "@/lib/prevent-nav-scroll";

function PresenceMark({ on }: { on: boolean }) {
  return on ? (
    <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
  ) : (
    <Minus className="h-3.5 w-3.5 text-[var(--color-muted)]" aria-hidden />
  );
}

function StatusChip({ status }: { status: SupabaseFunctionCompareRow["status"] }) {
  const { t } = useLocale();
  if (status === "synced") return <Chip variant="on">{t("supabase.migrationSynced")}</Chip>;
  if (status === "local_only") return <Chip variant="warn">{t("supabase.migrationLocalOnly")}</Chip>;
  return <Chip variant="warn">{t("supabase.migrationRemoteOnly")}</Chip>;
}

function FunctionCompareDetail({
  row,
  onDeploy,
  deploying,
  deployingSlug,
}: {
  row: SupabaseFunctionCompareRow;
  onDeploy: (slug: string) => void;
  deploying: boolean;
  deployingSlug?: string;
}) {
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="mono text-sm font-semibold text-[var(--color-text)]">{row.slug}</code>
        <StatusChip status={row.status} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/30 p-3">
          <p className="text-[11px] font-medium text-[var(--color-text)]">
            {t("supabase.functionDetailLocal")}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span>{t("supabase.migrationColLocal")}</span>
            <PresenceMark on={row.local} />
            <span>{row.local ? t("supabase.tablePresent") : t("supabase.tableAbsent")}</span>
          </div>
          {row.entrypoint && (
            <p className="text-[10px] text-[var(--color-muted)]">
              {t("supabase.functionEntrypoint")}: <code className="mono">{row.entrypoint}</code>
            </p>
          )}
          {row.local_files.length > 0 ? (
            <div>
              <p className="text-[10px] font-medium text-[var(--color-muted)]">
                {t("supabase.functionLocalFiles")}
              </p>
              <ul className="mt-1 space-y-0.5 text-[10px] text-[var(--color-muted)]">
                {row.local_files.map((file) => (
                  <li key={file}>
                    <code className="mono">{file}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.functionNoLocalFiles")}</p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/30 p-3">
          <p className="text-[11px] font-medium text-[var(--color-text)]">
            {t("supabase.functionDetailRemote")}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span>{t("supabase.migrationColRemote")}</span>
            <PresenceMark on={row.remote} />
            <span>{row.remote ? t("supabase.tablePresent") : t("supabase.tableAbsent")}</span>
          </div>
          {row.remote_status && (
            <p className="text-[10px] text-[var(--color-muted)]">
              {t("supabase.functionRemoteStatus")}: <code className="mono">{row.remote_status}</code>
            </p>
          )}
          {row.updated_at && (
            <p className="text-[10px] text-[var(--color-muted)]">
              {t("supabase.functionRemoteUpdated", { at: row.updated_at })}
            </p>
          )}
        </section>
      </div>

      {row.status === "local_only" && (
        <ScrollSafeButton
          size="sm"
          disabled={deploying}
          busy={deploying && deployingSlug === row.slug}
          onAction={() => onDeploy(row.slug)}
        >
          {deploying && deployingSlug === row.slug
            ? t("supabase.functionDeploying")
            : t("supabase.deployFunction")}
        </ScrollSafeButton>
      )}
    </div>
  );
}

export function FunctionsCompareList({
  rows,
  summary,
  onDeploy,
  deploying,
  deployingSlug,
  onDeployAll,
  pendingCount,
}: {
  rows: SupabaseFunctionCompareRow[];
  summary: { local: number; remote: number; synced: number; pending: number };
  onDeploy: (slug: string) => void;
  deploying: boolean;
  deployingSlug?: string;
  onDeployAll?: () => void;
  pendingCount?: number;
}) {
  const { t } = useLocale();
  const scrollRef = useScrollContainer();
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (selectedOverride && rows.some((r) => r.slug === selectedOverride)) {
      return selectedOverride;
    }
    if (rows.length === 0) return null;
    return (rows.find((r) => r.status === "local_only") ?? rows[0]).slug;
  }, [rows, selectedOverride]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.slug === selected) ?? null,
    [rows, selected],
  );

  if (rows.length === 0) {
    return (
      <p className="text-xs text-[var(--color-muted)]">{t("supabase.noFunctionsCompared")}</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-[var(--color-text)]">
            {t("supabase.functionsCompareTitle")}
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            {t("supabase.functionCompareSummary", summary)}
          </p>
        </div>
        {onDeployAll && (pendingCount ?? 0) > 0 && (
          <ScrollSafeButton size="sm" disabled={deploying} busy={deploying} onAction={onDeployAll}>
            {deploying
              ? t("supabase.functionDeploying")
              : t("supabase.deployAllFunctions", { count: pendingCount ?? 0 })}
          </ScrollSafeButton>
        )}
      </div>

      <div className="flex min-h-[16rem] flex-col sm:flex-row">
        <aside className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-panel-elevated)]/25 sm:w-[11rem] sm:border-b-0 sm:border-r">
          <nav
            className="flex max-h-64 flex-row gap-0.5 overflow-x-auto p-2 sm:max-h-none sm:flex-col sm:overflow-y-auto"
            aria-label={t("supabase.functionListAria")}
          >
            {rows.map((row) => {
              const active = row.slug === selected;
              return (
                <button
                  key={row.slug}
                  type="button"
                  onMouseDown={(e) =>
                    runOnMouseDownWithoutScrollJump(e, scrollRef, () => setSelectedOverride(row.slug))
                  }
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
                  <code className="mono min-w-0 flex-1 truncate text-[11px]">{row.slug}</code>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4">
          {selectedRow ? (
            <FunctionCompareDetail
              row={selectedRow}
              onDeploy={onDeploy}
              deploying={deploying}
              deployingSlug={deployingSlug}
            />
          ) : (
            <p className="text-xs text-[var(--color-muted)]">{t("supabase.functionDetailEmpty")}</p>
          )}
        </main>
      </div>
    </div>
  );
}
