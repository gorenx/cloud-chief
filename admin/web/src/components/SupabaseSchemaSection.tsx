import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { TablesCompareList } from "@/components/TablesCompareList";
import { RoutinesCompareList } from "@/components/RoutinesCompareList";
import { MigrationsDirPicker } from "@/components/MigrationsDirPicker";
import { useLocale } from "@/contexts/LocaleContext";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import {
  applySupabaseMigration,
  fetchSupabaseMigrationDirs,
  fetchSupabaseMigrationStatus,
  saveSupabaseMigrationDir,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { pinScrollTop, readMainScrollTop, restoreMainScrollTop } from "@/lib/prevent-nav-scroll";

export function SupabaseSchemaSection({
  token,
  projectRef,
  variant = "embedded",
  hideTitle = false,
}: {
  token: string;
  projectRef: string;
  variant?: "embedded" | "page";
  hideTitle?: boolean;
}) {
  const isPage = variant === "page";
  const { t, displayError } = useLocale();
  const queryClient = useQueryClient();
  const scrollRef = useScrollContainer();
  const scrollLock = useRef<number | null>(null);
  const [activeDir, setActiveDir] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const dirsQ = useQuery({
    queryKey: ["supabase-migration-dirs", token],
    queryFn: async () => {
      const r = await fetchSupabaseMigrationDirs(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (!dirsQ.data) return;
    setActiveDir((prev) => prev || dirsQ.data.current);
  }, [dirsQ.data]);

  const saveDirM = useMutation({
    mutationFn: async (dir: string) => {
      const r = await saveSupabaseMigrationDir(token, dir);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      setActiveDir(data.dir);
      toast.success(t("supabase.toastMigrationDirSaved"));
      void queryClient.invalidateQueries({ queryKey: ["supabase-migration-dirs", token] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-migrations"] });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const statusQ = useQuery({
    queryKey: ["supabase-migrations", token, projectRef, activeDir],
    queryFn: async () => {
      const r = await fetchSupabaseMigrationStatus(token, projectRef, activeDir);
      if (!r.ok) {
        const err = new Error(r.error) as Error & { needsDbScope?: boolean };
        err.needsDbScope = r.needs_db_scope;
        throw err;
      }
      return r.data;
    },
    enabled: Boolean(token && projectRef && activeDir),
    retry: false,
  });

  const applyOneM = useMutation({
    mutationFn: async (table: string) => {
      const r = await applySupabaseMigration(token, projectRef, {
        table,
        dir: activeDir,
      });
      if (!r.ok) throw new Error(r.error);
      return { ...r.data, table };
    },
    onSuccess: async (data) => {
      toast.success(
        data.skipped
          ? t("supabase.toastMigrationAlreadyApplied")
          : t("supabase.toastTableApplied", { table: data.table }),
      );
      await queryClient.refetchQueries({
        queryKey: ["supabase-migrations", token, projectRef, activeDir],
      });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const applyFunctionM = useMutation({
    mutationFn: async (functionName: string) => {
      const r = await applySupabaseMigration(token, projectRef, {
        function: functionName,
        dir: activeDir,
      });
      if (!r.ok) throw new Error(r.error);
      return { ...r.data, functionName };
    },
    onSuccess: async (data) => {
      toast.success(
        data.skipped
          ? t("supabase.toastMigrationAlreadyApplied")
          : t("supabase.toastRoutineApplied", { name: data.functionName }),
      );
      await queryClient.refetchQueries({
        queryKey: ["supabase-migrations", token, projectRef, activeDir],
      });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const applyAllM = useMutation({
    mutationFn: async () => {
      const r = await applySupabaseMigration(token, projectRef, {
        applyAll: true,
        dir: activeDir,
      });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: async (data) => {
      const tables = data.applied_tables?.length ?? 0;
      const functions = data.applied_functions?.length ?? 0;
      toast.success(t("supabase.toastMigrationsApplied", { tables, functions }));
      await queryClient.refetchQueries({
        queryKey: ["supabase-migrations", token, projectRef, activeDir],
      });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const err = statusQ.error as (Error & { needsDbScope?: boolean }) | null;
  const needsDbScope = Boolean(err?.needsDbScope);
  const pending = statusQ.data?.pending_count ?? 0;
  const applying = applyOneM.isPending || applyFunctionM.isPending || applyAllM.isPending;
  const applyingTable = applyOneM.isPending ? applyOneM.variables : undefined;
  const applyingFunction = applyFunctionM.isPending ? applyFunctionM.variables : undefined;
  const wasApplying = useRef(false);

  useLayoutEffect(() => {
    if (applying && !wasApplying.current) {
      scrollLock.current = readMainScrollTop(scrollRef);
    }
    wasApplying.current = applying;

    if (applying && scrollLock.current !== null) {
      restoreMainScrollTop(scrollLock.current, scrollRef);
      return;
    }
    if (!applying && scrollLock.current !== null) {
      restoreMainScrollTop(scrollLock.current, scrollRef);
      scrollLock.current = null;
    }
  }, [applying, statusQ.data, scrollRef]);

  useEffect(() => {
    if (!applying || scrollLock.current === null) return;
    return pinScrollTop(scrollLock.current, scrollRef);
  }, [applying, statusQ.data, scrollRef]);

  const dirLabel = activeDir || t("supabase.migrationsDirPickerRoot");
  const tableCompareRows = statusQ.data?.table_comparison ?? [];
  const functionCompareRows = statusQ.data?.function_comparison ?? [];
  const stepTitle = isPage
    ? t("supabase.step4Title").replace(/^[④4]\s*/, "③ ")
    : t("supabase.step4Title");
  const functionSummary = statusQ.data?.function_summary ?? {
    local: 0,
    remote: 0,
    synced: 0,
    pending: 0,
  };
  const tableSummary = statusQ.data?.table_summary ?? {
    local: 0,
    remote: 0,
    synced: 0,
    pending: 0,
  };

  return (
    <div className={cn("space-y-2", !hideTitle && "border-t border-[var(--color-border)] pt-3")}>
      {!hideTitle && (
        <p className="text-xs font-medium text-[var(--color-text)]">{stepTitle}</p>
      )}
      <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.step4Desc")}</p>

      <div className="space-y-1">
        <label className="text-[10px] text-[var(--color-muted)]">{t("supabase.migrationsDirLabel")}</label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5">
            <code className="mono block truncate text-xs text-[var(--color-text)]">{dirLabel}</code>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={dirsQ.isLoading || saveDirM.isPending}
            onClick={() => setPickerOpen(true)}
            className="gap-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {t("supabase.migrationsDirPick")}
          </Button>
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.migrationsDirHint")}</p>
        {dirsQ.data && dirsQ.data.current_readable === false && (
          <p className="text-[10px] text-amber-200">{t("supabase.migrationsDirUnreadable")}</p>
        )}
      </div>

      <MigrationsDirPicker
        token={token}
        open={pickerOpen}
        initialPath={dirsQ.data?.current_readable === false ? "" : activeDir}
        onClose={() => setPickerOpen(false)}
        onSelect={(dir) => saveDirM.mutate(dir)}
      />

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
          <TablesCompareList
            rows={tableCompareRows}
            summary={tableSummary}
            onApply={(table) => applyOneM.mutate(table)}
            applying={applying}
            applyingTable={applyingTable}
            onApplyAll={() => applyAllM.mutate()}
            pendingCount={pending}
          />
          <RoutinesCompareList
            rows={functionCompareRows}
            summary={functionSummary}
            onApply={(name) => applyFunctionM.mutate(name)}
            applying={applying}
            applyingName={applyingFunction}
          />
        </>
      )}
    </div>
  );
}
