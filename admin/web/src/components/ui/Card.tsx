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

export function CardTitle({
  children,
  desc,
  footer,
  trailing,
}: {
  children: ReactNode;
  desc?: string;
  footer?: ReactNode;
  /** 标题行右侧内容；容器溢出时可横向滚动 */
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-4 min-w-0">
      <div className={cn("gap-3", trailing ? "flex items-start justify-between" : undefined)}>
        <h2 className="shrink-0 font-display text-sm font-semibold tracking-tight text-[var(--color-text)]">
          {children}
        </h2>
        {trailing && (
          <div className="min-w-0 max-w-[min(100%,22rem)] flex-1 overflow-x-auto overscroll-x-contain text-right [scrollbar-width:thin]">
            {trailing}
          </div>
        )}
      </div>
      {desc && <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{desc}</p>}
      {footer && <div className="mt-1.5 space-y-1 text-xs leading-relaxed">{footer}</div>}
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
