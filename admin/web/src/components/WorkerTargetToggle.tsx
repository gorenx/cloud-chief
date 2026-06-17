import { cn } from "@/lib/utils";
import type { WorkerTarget } from "@/lib/playground-session";

export function WorkerTargetToggle({
  value,
  onlineAvailable,
  onChange,
}: {
  value: WorkerTarget;
  onlineAvailable: boolean;
  onChange: (v: WorkerTarget) => void;
}) {
  return (
    <div className="flex w-fit justify-self-start rounded-lg border border-[var(--color-border)] p-0.5">
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1 text-xs",
          value === "local"
            ? "bg-emerald-950/50 text-emerald-200"
            : "text-[var(--color-muted)]",
        )}
        onClick={() => onChange("local")}
      >
        本地 Worker
      </button>
      <button
        type="button"
        title={
          onlineAvailable
            ? "workers.dev 线上部署"
            : "未解析到线上 Worker（需 CF_API_TOKEN 且已部署）"
        }
        disabled={!onlineAvailable}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs",
          value === "online"
            ? "bg-[var(--color-accent)]/20 text-[var(--color-text)]"
            : "text-[var(--color-muted)]",
          !onlineAvailable && "cursor-not-allowed opacity-40",
        )}
        onClick={() => onChange("online")}
      >
        线上 Worker
      </button>
    </div>
  );
}
