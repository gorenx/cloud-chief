import type { MouseEvent, RefObject } from "react";

export function getScrollEl(ref?: RefObject<HTMLElement | null> | null): HTMLElement | null {
  return ref?.current ?? document.querySelector("[data-app-scroll]");
}

export function readScrollTop(ref?: RefObject<HTMLElement | null> | null): number {
  const el = getScrollEl(ref);
  return el?.scrollTop ?? 0;
}

export function restoreScrollTop(top: number, ref?: RefObject<HTMLElement | null> | null): void {
  const el = getScrollEl(ref);
  if (el) el.scrollTop = top;
}

/** 在 mousedown 同步执行动作并恢复滚动（比 click 更早，避免按钮抢焦点）。 */
export function runOnMouseDownWithoutScrollJump(
  e: MouseEvent<HTMLElement>,
  ref: RefObject<HTMLElement | null>,
  action: () => void,
  disabled?: boolean,
): void {
  e.preventDefault();
  e.stopPropagation();
  if (disabled) return;
  const top = readScrollTop(ref);
  action();
  restoreScrollTop(top, ref);
  queueMicrotask(() => restoreScrollTop(top, ref));
  requestAnimationFrame(() => restoreScrollTop(top, ref));
}


/** 侧栏/步骤导航：mousedown preventDefault，配合 click 使用。 */
export function preventNavButtonFocus(e: MouseEvent<HTMLElement>): void {
  e.preventDefault();
}

export const navButtonFocusProps = {
  onMouseDown: preventNavButtonFocus,
} as const;

export function readMainScrollTop(ref?: RefObject<HTMLElement | null> | null): number {
  return readScrollTop(ref);
}

export function restoreMainScrollTop(
  top: number,
  ref?: RefObject<HTMLElement | null> | null,
): void {
  restoreScrollTop(top, ref);
}

/** 在指定时间内钉住滚动位置（部署日志、布局刷新等）。 */
export function pinScrollTop(
  top: number,
  ref: RefObject<HTMLElement | null>,
): () => void {
  const el = getScrollEl(ref);
  if (!el) return () => {};

  const pin = () => {
    if (el.scrollTop !== top) el.scrollTop = top;
  };

  pin();
  const onScroll = () => pin();
  el.addEventListener("scroll", onScroll, { passive: true });
  const ro = new ResizeObserver(pin);
  ro.observe(el);
  if (el.firstElementChild) ro.observe(el.firstElementChild);

  return () => {
    el.removeEventListener("scroll", onScroll);
    ro.disconnect();
  };
}
