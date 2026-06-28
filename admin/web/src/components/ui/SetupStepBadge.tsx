import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef, type ReactNode } from "react";

export function SetupStepBadge({
  done,
  warn,
  selected,
  num,
  size = "md",
}: {
  done?: boolean;
  warn?: boolean;
  selected?: boolean;
  num: string | number;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        dim,
        done && "bg-emerald-600/90 text-white ring-1 ring-emerald-500/30",
        !done && warn && "bg-[var(--color-warn)] text-[var(--color-bg)]",
        !done &&
          !warn &&
          selected &&
          "bg-[var(--color-accent)] text-[var(--color-bg)] shadow-[0_0_14px_var(--color-accent-glow)]",
        !done &&
          !warn &&
          !selected &&
          "bg-[var(--color-panel-elevated)] text-[var(--color-muted)] ring-1 ring-[var(--color-border-subtle)]",
      )}
    >
      {done ? <Check className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} /> : num}
    </span>
  );
}

export function setupStepCardClasses({
  isSelected,
  done,
  warn,
}: {
  isSelected: boolean;
  done: boolean;
  warn?: boolean;
}) {
  return cn(
    "flex w-full flex-col rounded-[var(--radius-md)] border transition-all duration-200",
    "h-[7.5rem]",
    isSelected
      ? "border-[var(--color-accent)]/50 bg-[var(--color-accent-glow)] shadow-[inset_0_0_0_1px_rgba(212,160,84,0.15)]"
      : done
        ? "border-emerald-900/35 bg-emerald-950/15"
        : warn
          ? "border-[var(--color-warn)]/35 bg-[var(--color-warn)]/8"
          : "border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/25 hover:border-[var(--color-border)]",
  );
}

export const FlowPanel = forwardRef<HTMLDivElement, { className?: string; children: ReactNode }>(
  function FlowPanel({ className, children }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "glass-panel overflow-hidden rounded-[var(--radius-xl)] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

export function FlowProgressBar({ value }: { value: number }) {
  return (
    <div
      className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-[var(--color-panel-elevated)] ring-1 ring-[var(--color-border-subtle)]"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-dim)] to-[var(--color-accent)] transition-all duration-500 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
