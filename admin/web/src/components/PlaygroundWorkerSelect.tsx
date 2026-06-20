import { useT } from "@/contexts/LocaleContext";
import { Select } from "@/components/ui/Select";
import type { WorkerListEntry } from "@/types";
import { cn } from "@/lib/utils";

export function PlaygroundWorkerSelect({
  workers,
  value,
  onChange,
  loading,
  disabled,
  className,
}: {
  workers: WorkerListEntry[];
  value: string;
  onChange: (dir: string) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();

  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]/75">
        {t("playground.selectWorker")}
      </span>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading || workers.length === 0}
        className="min-w-0 w-full"
      >
        {!value && (
          <option value="" disabled>
            {loading ? t("common.loading") : t("playground.selectWorkerPlaceholder")}
          </option>
        )}
        {workers.map((w) => {
          const label = w.script_name
            ? t("worker.panel.localOption", { dir: w.dir, name: w.script_name })
            : t("worker.panel.localOptionNoScript", { dir: w.dir });
          return (
            <option key={w.dir} value={w.dir}>
              {label}
            </option>
          );
        })}
      </Select>
      {disabled && (
        <span className="text-[10px] text-[var(--color-muted)]">
          {t("playground.selectWorkerNoToken")}
        </span>
      )}
    </label>
  );
}
