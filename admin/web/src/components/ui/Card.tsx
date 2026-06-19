import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "glass-panel rounded-[var(--radius-xl)] p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
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
      <h2 className="font-display text-sm font-semibold tracking-tight text-[var(--color-text)]">
        {children}
      </h2>
      {desc && <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{desc}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  children,
  className,
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("page-enter page-enter-delay-1", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      {value !== undefined && (
        <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
      )}
      {children}
    </Card>
  );
}
