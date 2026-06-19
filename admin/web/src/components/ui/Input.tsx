import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)]",
        "outline-none transition-colors placeholder:text-[var(--color-muted)]/60",
        "focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-glow)]",
        className,
      )}
      {...props}
    />
  );
}
