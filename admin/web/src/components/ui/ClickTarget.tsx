import type { MouseEvent, ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";
import {
  navButtonScrollSafeProps,
  workspaceSidebarButtonProps,
} from "@/lib/prevent-nav-scroll";

type ClickTargetProps = {
  onClick: () => void;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  scrollRef?: RefObject<HTMLElement | null>;
  /** 工作区侧栏：mousedown 同步切换，避免焦点导致页面滚动 */
  sidebar?: boolean;
};

function plainClickProps(onClick: () => void) {
  return {
    tabIndex: -1 as const,
    onMouseDown: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
    onClick,
  };
}

export function ClickTarget({
  onClick,
  className,
  children,
  disabled,
  scrollRef,
  sidebar,
}: ClickTargetProps) {
  const interactionProps = disabled
    ? { tabIndex: -1 as const }
    : scrollRef && sidebar
      ? workspaceSidebarButtonProps(scrollRef, onClick)
      : scrollRef
        ? navButtonScrollSafeProps(scrollRef, onClick)
        : plainClickProps(onClick);

  return (
    <div
      role="button"
      aria-disabled={disabled || undefined}
      {...interactionProps}
      className={cn(
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer select-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
