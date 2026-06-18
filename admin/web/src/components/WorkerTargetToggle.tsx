import { useT } from "@/contexts/LocaleContext";
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
  const t = useT();
  const isLocal = value === "local";
  const blocked = isLocal && !onlineAvailable;

  function handleToggle() {
    if (blocked) return;
    onChange(isLocal ? "online" : "local");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={!isLocal}
        disabled={blocked}
        title={
          blocked
            ? t("playground.onlineWorkerUnavailable")
            : isLocal
              ? t("playground.switchToOnline")
              : t("playground.switchToLocal")
        }
        onClick={handleToggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
          isLocal
            ? "bg-[var(--color-border)]"
            : "bg-[var(--color-accent)]/45",
          blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            isLocal ? "translate-x-0" : "translate-x-5",
          )}
        />
      </button>
      <span
        className={cn(
          "text-xs font-medium",
          isLocal ? "text-emerald-300" : "text-[var(--color-text)]",
        )}
      >
        {isLocal ? t("playground.workerTargetLocal") : t("playground.workerTargetOnline")}
      </span>
    </div>
  );
}
