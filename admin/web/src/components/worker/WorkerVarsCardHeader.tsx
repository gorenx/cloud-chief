import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Vars 双栏卡片顶栏：紧凑高度，说明区两行对齐 */
export function WorkerVarsCardHeader({
  title,
  children,
  alert,
  className,
}: {
  title: string;
  children: ReactNode;
  alert?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 min-h-[4.75rem] flex flex-col", className)}>
      <h2 className="font-display text-sm font-semibold tracking-tight text-[var(--color-text)]">
        {title}
      </h2>
      <div className="mt-1 space-y-0.5 text-xs leading-snug text-[var(--color-muted)]">{children}</div>
      {alert ? <div className="mt-1.5 text-xs leading-snug">{alert}</div> : null}
    </div>
  );
}
