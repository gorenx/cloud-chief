import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";
import { ClickTarget } from "./ClickTarget";
import { SetupStepBadge } from "./SetupStepBadge";

const sidebarButtonClass = (active: boolean) =>
  cn(
    "flex h-9 w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-left text-xs font-medium transition-all duration-200",
    active
      ? "bg-[var(--color-accent-glow)] font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25"
      : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
  );

const sidebarStepClass = ({
  active,
  done,
  warn,
}: {
  active: boolean;
  done: boolean;
  warn?: boolean;
}) =>
  cn(
    "flex h-9 w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-left text-xs transition-all duration-200",
    active
      ? "bg-[var(--color-accent-glow)] font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25"
      : done
        ? "text-emerald-400 hover:bg-emerald-950/20"
        : warn
          ? "text-[var(--color-warn)] hover:bg-[var(--color-warn)]/10"
          : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
  );

export function WizardWorkspace({
  sidebarTop,
  sidebar,
  rightHeader,
  children,
  scrollMain = false,
}: {
  sidebarTop: ReactNode;
  sidebar: ReactNode;
  rightHeader: ReactNode;
  children: ReactNode;
  scrollMain?: boolean;
}) {
  return (
    <div className="glass-panel overflow-hidden rounded-[var(--radius-xl)] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
      <div className="flex border-b border-[var(--color-border-subtle)]">
        <div className="flex w-full shrink-0 items-center border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/40 px-3 py-3 sm:w-[12.5rem] sm:border-r">
          {sidebarTop}
        </div>
        <div className="flex min-w-0 flex-1 items-center px-5 py-3">{rightHeader}</div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <aside className="shrink-0 border-b border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/25 p-3 sm:w-[12.5rem] sm:border-b-0 sm:border-r">
          {sidebar}
        </aside>
        <main
          data-wizard-main
          className={cn(
            "min-w-0 flex-1 px-5 py-4",
            scrollMain &&
              "max-h-[min(72vh,calc(100dvh-14rem))] overflow-y-auto overscroll-contain [overflow-anchor:none]",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function WizardSidebarButton({
  active,
  onClick,
  children,
  scrollRef,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  scrollRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <ClickTarget
      onClick={onClick}
      scrollRef={scrollRef}
      sidebar
      className={sidebarButtonClass(active)}
    >
      {children}
    </ClickTarget>
  );
}

export function WizardSidebarStep({
  active,
  done,
  warn,
  num,
  label,
  optional,
  optionalLabel,
  onClick,
  scrollRef,
}: {
  active: boolean;
  done: boolean;
  warn?: boolean;
  num: string | number;
  label: string;
  optional?: boolean;
  optionalLabel?: string;
  onClick: () => void;
  scrollRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <ClickTarget
      onClick={onClick}
      scrollRef={scrollRef}
      sidebar
      className={sidebarStepClass({ active, done, warn })}
    >
      <SetupStepBadge done={done} warn={warn} selected={active} num={num} size="sm" />
      <span className="min-w-0 flex-1 truncate">
        {label}
        {optional && optionalLabel && (
          <span className="ml-1 font-normal opacity-60">{optionalLabel}</span>
        )}
      </span>
    </ClickTarget>
  );
}
