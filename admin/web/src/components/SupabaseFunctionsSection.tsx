import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { FunctionsCompareList } from "@/components/FunctionsCompareList";
import { FunctionsDirPicker } from "@/components/FunctionsDirPicker";
import { useLocale } from "@/contexts/LocaleContext";
import {
  deploySupabaseFunction,
  fetchSupabaseFunctionsDirs,
  fetchSupabaseFunctionsStatus,
  saveSupabaseFunctionsDir,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function SupabaseFunctionsSection({
  token,
  projectRef,
  hideTitle = false,
}: {
  token: string;
  projectRef: string;
  hideTitle?: boolean;
}) {
  const { t, displayError } = useLocale();
  const queryClient = useQueryClient();
  const [activeDir, setActiveDir] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const dirsQ = useQuery({
    queryKey: ["supabase-functions-dirs", token],
    queryFn: async () => {
      const r = await fetchSupabaseFunctionsDirs(token);
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
      const r = await saveSupabaseFunctionsDir(token, dir);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      setActiveDir(data.dir);
      toast.success(t("supabase.toastFunctionsDirSaved"));
      void queryClient.invalidateQueries({ queryKey: ["supabase-functions-dirs", token] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-functions"] });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const statusQ = useQuery({
    queryKey: ["supabase-functions", token, projectRef, activeDir],
    queryFn: async () => {
      const r = await fetchSupabaseFunctionsStatus(token, projectRef, activeDir);
      if (!r.ok) {
        const err = new Error(r.error) as Error & { needsFunctionsScope?: boolean };
        err.needsFunctionsScope = r.needs_functions_scope;
        throw err;
      }
      return r.data;
    },
    enabled: Boolean(token && projectRef && activeDir),
    retry: false,
  });

  const deployOneM = useMutation({
    mutationFn: async (slug: string) => {
      const r = await deploySupabaseFunction(token, projectRef, {
        slug,
        dir: activeDir,
      });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: async (data) => {
      const slug = deployOneM.variables ?? data.deployed[0] ?? "";
      toast.success(t("supabase.toastFunctionDeployed", { slug }));
      await queryClient.refetchQueries({
        queryKey: ["supabase-functions", token, projectRef, activeDir],
      });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const deployAllM = useMutation({
    mutationFn: async () => {
      const r = await deploySupabaseFunction(token, projectRef, {
        deployAll: true,
        dir: activeDir,
      });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: async (data) => {
      toast.success(t("supabase.toastFunctionsDeployed", { count: data.deployed.length }));
      await queryClient.refetchQueries({
        queryKey: ["supabase-functions", token, projectRef, activeDir],
      });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const err = statusQ.error as (Error & { needsFunctionsScope?: boolean }) | null;
  const needsFunctionsScope = Boolean(err?.needsFunctionsScope);
  const remoteListLimited = Boolean(statusQ.data?.remote_list_limited);
  const pending = statusQ.data?.pending_count ?? 0;
  const deploying = deployOneM.isPending || deployAllM.isPending;
  const deployingSlug = deployOneM.isPending ? deployOneM.variables : undefined;
  const dirLabel = activeDir || t("supabase.functionsDirPickerRoot");
  const compareRows = statusQ.data?.function_comparison ?? [];
  const summary = statusQ.data?.function_summary ?? {
    local: 0,
    remote: 0,
    synced: 0,
    pending: 0,
  };

  return (
    <div className={cn("space-y-2", !hideTitle && "border-t border-[var(--color-border)] pt-3")}>
      {!hideTitle && (
        <p className="text-xs font-medium text-[var(--color-text)]">{t("supabase.functionsTitle")}</p>
      )}
      <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.functionsDesc")}</p>

      <div className="space-y-1">
        <label className="text-[10px] text-[var(--color-muted)]">{t("supabase.functionsDirLabel")}</label>
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
            {t("supabase.functionsDirPick")}
          </Button>
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.functionsDirHint")}</p>
      </div>

      <FunctionsDirPicker
        token={token}
        open={pickerOpen}
        initialPath={activeDir}
        onClose={() => setPickerOpen(false)}
        onSelect={(dir) => saveDirM.mutate(dir)}
      />

      {remoteListLimited && (
        <p className="text-xs text-amber-200">{t("supabase.functionsRemoteListLimited")}</p>
      )}

      {needsFunctionsScope && !remoteListLimited && (
        <p className="text-xs text-amber-200">{t("supabase.needsFunctionsScope")}</p>
      )}

      {statusQ.isLoading && (
        <p className="text-xs text-[var(--color-muted)]">{t("supabase.functionsLoading")}</p>
      )}

      {statusQ.isError && !needsFunctionsScope && (
        <p className="text-xs text-amber-200">{displayError(err?.message ?? "")}</p>
      )}

      {statusQ.data && (
        <FunctionsCompareList
          rows={compareRows}
          summary={summary}
          onDeploy={(slug) => deployOneM.mutate(slug)}
          deploying={deploying}
          deployingSlug={deployingSlug}
          onDeployAll={() => deployAllM.mutate()}
          pendingCount={pending}
        />
      )}
    </div>
  );
}
