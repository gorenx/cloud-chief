import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "ice";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] font-semibold transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" &&
          "bg-[var(--color-accent)] text-[var(--color-bg)] shadow-[0_0_20px_var(--color-accent-glow)] hover:bg-[var(--color-accent-dim)] hover:shadow-[0_0_28px_var(--color-accent-glow)]",
        variant === "ghost" &&
          "border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/50 text-[var(--color-text)] hover:border-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)]",
        variant === "ice" &&
          "border border-[var(--color-ice)]/30 bg-[var(--color-ice)]/10 text-[var(--color-ice)] hover:bg-[var(--color-ice)]/18",
        variant === "danger" &&
          "border border-[var(--color-err)]/40 bg-[var(--color-err)]/8 text-[var(--color-err)] hover:bg-[var(--color-err)]/15",
        className,
      )}
      {...props}
    />
  );
}
