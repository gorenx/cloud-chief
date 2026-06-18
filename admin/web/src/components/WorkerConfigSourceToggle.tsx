import { useT } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";
import type { WorkerConfigSource } from "@/lib/playground-session";

export function WorkerConfigSourceToggle({
  value,
  onChange,
}: {
  value: WorkerConfigSource;
  onChange: (v: WorkerConfigSource) => void;
}) {
  const t = useT();

  return (
    <div className="flex w-fit justify-self-start rounded-lg border border-[var(--color-border)] p-0.5">
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1 text-xs",
          value === "worker"
            ? "bg-orange-950/50 text-orange-200"
            : "text-[var(--color-muted)]",
        )}
        onClick={() => onChange("worker")}
      >
        {t("playground.workerConfig")}
      </button>
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1 text-xs",
          value === "ui"
            ? "bg-[var(--color-accent)]/20 text-[var(--color-text)]"
            : "text-[var(--color-muted)]",
        )}
        onClick={() => onChange("ui")}
      >
        {t("playground.debugUi")}
      </button>
    </div>
  );
}
