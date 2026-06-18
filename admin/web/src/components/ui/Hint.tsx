import { useId, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

export function Hint({
  content,
  children,
  className,
}: {
  content: ReactNode;
  /** 传入则包裹按钮/链接，悬浮整块区域显示说明；不传则仅显示问号图标 */
  children?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const open = hovered || pinned;

  const bubble = (
    <div
      role="tooltip"
      id={id}
      className={cn(
        "pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 w-max max-w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)] px-3 py-2 text-xs leading-relaxed text-[var(--color-muted)] shadow-lg",
        pinned && "pointer-events-auto",
      )}
    >
      {content}
      <span
        aria-hidden
        className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[var(--color-border)] bg-[var(--color-panel-elevated)]"
      />
    </div>
  );

  const helpButton = (
    <button
      type="button"
      className="inline-flex shrink-0 rounded p-0.5 text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
      aria-label={t("ui.hintAria")}
      aria-expanded={open}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPinned((v) => !v);
      }}
      onBlur={() => setPinned(false)}
    >
      <CircleHelp className="h-3.5 w-3.5" />
    </button>
  );

  if (!children) {
    return (
      <span className={cn("relative inline-flex align-middle", className)}>
        {helpButton}
        {open && bubble}
      </span>
    );
  }

  return (
    <span
      className={cn("relative inline-flex items-center gap-1", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        if (!pinned) setPinned(false);
      }}
    >
      {children}
      {helpButton}
      {open && bubble}
    </span>
  );
}
