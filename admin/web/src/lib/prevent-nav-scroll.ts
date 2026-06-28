import type { MouseEvent, KeyboardEvent, RefObject } from "react";

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

export function focusWithoutScroll(el: HTMLElement | null | undefined): void {
  el?.focus({ preventScroll: true });
}

/** 工作区侧栏：mousedown 同步切换并钉住滚动，避免焦点落到上方流程卡片。 */
export function workspaceSidebarButtonProps(
  scrollRef: RefObject<HTMLElement | null>,
  action: () => void,
) {
  return {
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      runOnMouseDownWithoutScrollJump(e, scrollRef, action);
      focusWithoutScroll(e.currentTarget);
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      e.preventDefault();
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      runWithoutScrollJump(scrollRef, action);
      focusWithoutScroll(e.currentTarget);
    },
  } as const;
}

export function setFlowInert(flowRoot: HTMLElement | null | undefined, inert: boolean): void {
  if (!flowRoot) return;
  if (inert) flowRoot.setAttribute("inert", "");
  else flowRoot.removeAttribute("inert");
}

/** 短暂禁用流程卡片交互（切换步骤防滚动跳动）；返回 cleanup，务必在超时或卸载时调用 */
export function flashFlowInert(
  flowRoot: HTMLElement | null | undefined,
  ms = 600,
): () => void {
  if (!flowRoot) return () => {};
  setFlowInert(flowRoot, true);
  const id = window.setTimeout(() => setFlowInert(flowRoot, false), ms);
  return () => {
    window.clearTimeout(id);
    setFlowInert(flowRoot, false);
  };
}

/** 执行动作并在布局刷新后恢复滚动位置。 */
export function runWithoutScrollJump(
  ref: RefObject<HTMLElement | null>,
  action: () => void,
): void {
  const top = readScrollTop(ref);
  action();
  restoreScrollTop(top, ref);
  queueMicrotask(() => restoreScrollTop(top, ref));
  requestAnimationFrame(() => restoreScrollTop(top, ref));
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
  runWithoutScrollJump(ref, action);
}


/** 侧栏/步骤导航：mousedown preventDefault，配合 click 使用。 */
export function preventNavButtonFocus(e: MouseEvent<HTMLElement>): void {
  e.preventDefault();
}

export const navButtonFocusProps = {
  onMouseDown: preventNavButtonFocus,
} as const;

/** 鼠标在 mousedown 同步执行；键盘走 click。避免按钮抢焦点导致主区域滚动跳动。 */
const navMouseDownGuard = { active: false };

export function navButtonScrollSafeProps(
  scrollRef: RefObject<HTMLElement | null>,
  action: () => void,
) {
  return {
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      navMouseDownGuard.active = true;
      runOnMouseDownWithoutScrollJump(e, scrollRef, action);
      queueMicrotask(() => {
        navMouseDownGuard.active = false;
      });
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (navMouseDownGuard.active) {
        e.preventDefault();
        return;
      }
      runWithoutScrollJump(scrollRef, action);
    },
  } as const;
}

export function readMainScrollTop(ref?: RefObject<HTMLElement | null> | null): number {
  return readScrollTop(ref);
}

export function restoreMainScrollTop(
  top: number,
  ref?: RefObject<HTMLElement | null> | null,
): void {
  restoreScrollTop(top, ref);
}

/** 切换向导步骤时重置右侧主内容区滚动，避免短内容继承旧 scrollTop 造成视觉跳动。 */
export function resetWizardMainScroll(ref?: RefObject<HTMLElement | null> | null): void {
  const root = getScrollEl(ref);
  const main = root?.querySelector<HTMLElement>("[data-wizard-main]");
  if (main) main.scrollTop = 0;
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
