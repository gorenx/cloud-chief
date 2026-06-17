import { cn } from "@/lib/utils";
import type { WorkerConfigSource } from "@/lib/playground-session";

export function WorkerConfigSourceToggle({
  value,
  onChange,
}: {
  value: WorkerConfigSource;
  onChange: (v: WorkerConfigSource) => void;
}) {
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
        Worker 配置
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
        调试界面
      </button>
    </div>
  );
}
