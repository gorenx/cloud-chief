import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, desc }: { children: ReactNode; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-[var(--color-text)]">{children}</h2>
      {desc && <p className="mt-1 text-xs text-[var(--color-muted)]">{desc}</p>}
    </div>
  );
}
