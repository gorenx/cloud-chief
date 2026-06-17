import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dim)]",
        variant === "ghost" && "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-panel-elevated)]",
        variant === "danger" && "border border-red-900/60 bg-transparent text-red-300 hover:bg-red-950/40",
        className,
      )}
      {...props}
    />
  );
}
