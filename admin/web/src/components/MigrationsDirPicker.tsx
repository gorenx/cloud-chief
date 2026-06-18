import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Folder, ChevronRight, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchSupabaseMigrationBrowse } from "@/lib/api";

export function MigrationsDirPicker({
  token,
  open,
  initialPath,
  onClose,
  onSelect,
}: {
  token: string;
  open: boolean;
  initialPath: string;
  onClose: () => void;
  onSelect: (dir: string) => void;
}) {
  const { t } = useLocale();
  const [browsePath, setBrowsePath] = useState("");

  useEffect(() => {
    if (!open) return;
    setBrowsePath(initialPath || "");
  }, [open, initialPath]);

  const browseQ = useQuery({
    queryKey: ["supabase-migration-browse", token, browsePath],
    queryFn: async () => {
      const r = await fetchSupabaseMigrationBrowse(token, browsePath);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: open && Boolean(token),
  });

  if (!open) return null;

  const data = browseQ.data;
  const currentLabel = data?.path || t("supabase.migrationsDirPickerRoot");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)]">
              {t("supabase.migrationsDirPickerTitle")}
            </p>
            <p className="truncate text-[10px] text-[var(--color-muted)]">
              {t("supabase.migrationsDirCurrent", { path: currentLabel })}
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            onClick={onClose}
            aria-label={t("supabase.migrationsDirPickerCancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {browseQ.isLoading && (
            <p className="px-2 py-4 text-xs text-[var(--color-muted)]">{t("supabase.migrationsLoading")}</p>
          )}

          {browseQ.isError && (
            <p className="px-2 py-4 text-xs text-amber-200">{(browseQ.error as Error).message}</p>
          )}

          {data && (
            <ul className="space-y-0.5">
              {data.parent !== null && (
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                    onClick={() => setBrowsePath(data.parent ?? "")}
                  >
                    <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
                    <span>{t("supabase.migrationsDirPickerParent")}</span>
                  </button>
                </li>
              )}

              {data.entries.length === 0 ? (
                <li className="px-2 py-4 text-xs text-[var(--color-muted)]">
                  {t("supabase.migrationsDirPickerEmpty")}
                </li>
              ) : (
                data.entries.map((entry) => (
                  <li key={entry.path}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                      onClick={() => setBrowsePath(entry.path)}
                    >
                      <Folder className="h-4 w-4 shrink-0 text-amber-300/80" />
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      {entry.has_children && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <span className="text-[10px] text-[var(--color-muted)]">
            {data
              ? t("supabase.migrationsDirPickerCount", { count: data.migration_count })
              : null}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t("supabase.migrationsDirPickerCancel")}
            </Button>
            <Button
              size="sm"
              disabled={!data}
              onClick={() => {
                if (!data) return;
                onSelect(data.path);
                onClose();
              }}
            >
              {t("supabase.migrationsDirPickerSelect")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
