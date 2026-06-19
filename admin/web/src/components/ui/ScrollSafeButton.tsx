import type { ReactNode } from "react";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import { runOnMouseDownWithoutScrollJump } from "@/lib/prevent-nav-scroll";
import { cn } from "@/lib/utils";

const variantClass = {
  primary: "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dim)]",
  ghost:
    "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-panel-elevated)]",
} as const;

const sizeClass = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export function ScrollSafeButton({
  variant = "primary",
  size = "md",
  disabled,
  busy,
  className,
  onAction,
  children,
}: {
  variant?: keyof typeof variantClass;
  size?: keyof typeof sizeClass;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  onAction: () => void;
  children: ReactNode;
}) {
  const scrollRef = useScrollContainer();
  const off = Boolean(disabled || busy);

  return (
    <div
      role="button"
      aria-disabled={off}
      aria-busy={busy}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center rounded-lg font-semibold transition-colors",
        variantClass[variant],
        sizeClass[size],
        off && "pointer-events-none opacity-50",
        className,
      )}
      onMouseDown={(e) => runOnMouseDownWithoutScrollJump(e, scrollRef, onAction, off)}
    >
      {children}
    </div>
  );
}
