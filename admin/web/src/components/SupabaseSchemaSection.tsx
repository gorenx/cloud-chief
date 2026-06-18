import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/contexts/LocaleContext";
import {
  applySupabaseMigration,
  fetchSupabaseMigrationStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function SupabaseSchemaSection({
  token,
  projectRef,
}: {
  token: string;
  projectRef: string;
}) {
  const { t, displayError } = useLocale();
  const queryClient = useQueryClient();

  const statusQ = useQuery({
    queryKey: ["supabase-migrations", token, projectRef],
    queryFn: async () => {
      const r = await fetchSupabaseMigrationStatus(token, projectRef);
      if (!r.ok) {
        const err = new Error(r.error) as Error & { needsDbScope?: boolean };
        err.needsDbScope = r.needs_db_scope;
        throw err;
      }
      return r.data;
    },
    enabled: Boolean(token && projectRef),
    retry: false,
  });

  const applyOneM = useMutation({
    mutationFn: async (version: string) => {
      const r = await applySupabaseMigration(token, projectRef, { version });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      toast.success(t("supabase.toastMigrationApplied"));
      void queryClient.invalidateQueries({ queryKey: ["supabase-migrations", token, projectRef] });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const applyAllM = useMutation({
    mutationFn: async () => {
      const r = await applySupabaseMigration(token, projectRef, { applyAll: true });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(t("supabase.toastMigrationsApplied", { count: data.applied.length }));
      void queryClient.invalidateQueries({ queryKey: ["supabase-migrations", token, projectRef] });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const err = statusQ.error as (Error & { needsDbScope?: boolean }) | null;
  const needsDbScope = Boolean(err?.needsDbScope);
  const pending = statusQ.data?.pending_count ?? 0;
  const applying = applyOneM.isPending || applyAllM.isPending;

  return (
    <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
      <p className="text-xs font-medium text-[var(--color-text)]">{t("supabase.step4Title")}</p>
      <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.step4Desc")}</p>

      {needsDbScope && (
        <p className="text-xs text-amber-200">{t("supabase.needsDbScope")}</p>
      )}

      {statusQ.isLoading && (
        <p className="text-xs text-[var(--color-muted)]">{t("supabase.migrationsLoading")}</p>
      )}

      {statusQ.isError && !needsDbScope && (
        <p className="text-xs text-amber-200">{displayError(err?.message ?? "")}</p>
      )}

      {statusQ.data && (
        <>
          <div className="space-y-1">
            {statusQ.data.migrations.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)]">{t("supabase.noLocalMigrations")}</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {statusQ.data.migrations.map((m) => (
                  <li
                    key={m.version}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5"
                  >
                    <span className="min-w-0">
                      <code className="mono text-[11px]">{m.version}</code>
                      <span
                        className={cn(
                          "ml-2 text-[10px]",
                          m.applied ? "text-emerald-300" : "text-amber-200",
                        )}
                      >
                        {m.applied ? t("supabase.migrationApplied") : t("supabase.migrationPending")}
                      </span>
                    </span>
                    {!m.applied && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={applying}
                        onClick={() => applyOneM.mutate(m.version)}
                      >
                        {applyOneM.isPending ? t("supabase.migrationApplying") : t("supabase.applyMigration")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pending > 0 && (
            <Button size="sm" disabled={applying} onClick={() => applyAllM.mutate()}>
              {applyAllM.isPending
                ? t("supabase.migrationApplying")
                : t("supabase.applyAllMigrations", { count: pending })}
            </Button>
          )}

          {statusQ.data.tables.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.rlsStatusTitle")}</p>
              <ul className="space-y-0.5 text-[11px]">
                {statusQ.data.tables.map((tbl) => (
                  <li key={tbl.name} className="flex flex-wrap gap-2 text-[var(--color-text)]">
                    <code className="mono">{tbl.name}</code>
                    <span className={tbl.rls_enabled ? "text-emerald-300" : "text-amber-200"}>
                      {tbl.rls_enabled ? t("supabase.rlsOn") : t("supabase.rlsOff")}
                    </span>
                    <span className="text-[var(--color-muted)]">
                      {t("supabase.policyCount", { count: tbl.policy_count })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
