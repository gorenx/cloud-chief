import { useT } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";
import type { WorkerConfigSource } from "@/lib/playground-session";

export function WorkerConfigSourceToggle({
  value,
  onChange,
  className,
}: {
  value: WorkerConfigSource;
  onChange: (v: WorkerConfigSource) => void;
  className?: string;
}) {
  const t = useT();

  return (
    <div
      className={cn(
        "flex rounded-lg border border-[var(--color-border)] p-0.5",
        className ?? "w-fit justify-self-start",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex-1 rounded-md px-2.5 py-1 text-xs",
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
          "flex-1 rounded-md px-2.5 py-1 text-xs",
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
