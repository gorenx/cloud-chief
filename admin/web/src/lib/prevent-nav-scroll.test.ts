// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { MouseEvent, RefObject } from "react";
import {
  getScrollEl,
  pinScrollTop,
  readScrollTop,
  restoreScrollTop,
  runOnMouseDownWithoutScrollJump,
  runWithoutScrollJump,
  navButtonScrollSafeProps,
  focusWithoutScroll,
  workspaceSidebarButtonProps,
} from "./prevent-nav-scroll";

function scrollContainer(initialTop = 0): HTMLElement {
  const el = document.createElement("main");
  el.setAttribute("data-app-scroll", "");
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    writable: true,
    value: initialTop,
  });
  document.body.appendChild(el);
  return el;
}

describe("prevent-nav-scroll", () => {
  let container: HTMLElement;

  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as typeof ResizeObserver;
    container = scrollContainer(480);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
  });

  it("reads and restores scrollTop on the app scroll container", () => {
    const ref = { current: container } as RefObject<HTMLElement>;
    expect(readScrollTop(ref)).toBe(480);
    container.scrollTop = 0;
    restoreScrollTop(480, ref);
    expect(container.scrollTop).toBe(480);
  });

  it("falls back to [data-app-scroll] when ref is empty", () => {
    expect(getScrollEl(null)).toBe(container);
    expect(readScrollTop(null)).toBe(480);
  });

  it("runWithoutScrollJump keeps scroll position across action", () => {
    const ref = { current: container } as RefObject<HTMLElement>;
    const action = vi.fn(() => {
      container.scrollTop = 0;
    });

    runWithoutScrollJump(ref, action);

    expect(action).toHaveBeenCalled();
    expect(container.scrollTop).toBe(480);
  });

  it("runOnMouseDownWithoutScrollJump keeps scroll position across action", () => {
    const ref = { current: container } as RefObject<HTMLElement>;
    const action = vi.fn(() => {
      container.scrollTop = 0;
    });
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    runOnMouseDownWithoutScrollJump(
      { preventDefault, stopPropagation } as unknown as MouseEvent<HTMLElement>,
      ref,
      action,
    );

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(action).toHaveBeenCalled();
    expect(container.scrollTop).toBe(480);
  });

  it("pinScrollTop re-applies scrollTop after scroll events", () => {
    const ref = { current: container } as RefObject<HTMLElement>;
    const stop = pinScrollTop(480, ref);

    container.scrollTop = 12;
    container.dispatchEvent(new Event("scroll"));
    expect(container.scrollTop).toBe(480);

    stop();
    container.scrollTop = 12;
    container.dispatchEvent(new Event("scroll"));
    expect(container.scrollTop).toBe(12);
  });

  it("navButtonScrollSafeProps runs action on mousedown without duplicate click", () => {
    const ref = { current: container } as RefObject<HTMLElement>;
    const action = vi.fn(() => {
      container.scrollTop = 0;
    });
    const props = navButtonScrollSafeProps(ref, action);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    props.onMouseDown({
      button: 0,
      preventDefault,
      stopPropagation,
    } as unknown as MouseEvent<HTMLElement>);
    props.onClick({ preventDefault } as unknown as MouseEvent<HTMLElement>);

    expect(action).toHaveBeenCalledTimes(1);
    expect(container.scrollTop).toBe(480);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("navButtonScrollSafeProps runs action on keyboard click", () => {
    const ref = { current: container } as RefObject<HTMLElement>;
    const action = vi.fn(() => {
      container.scrollTop = 0;
    });
    const props = navButtonScrollSafeProps(ref, action);

    props.onClick({ preventDefault: vi.fn() } as unknown as MouseEvent<HTMLElement>);

    expect(action).toHaveBeenCalledTimes(1);
    expect(container.scrollTop).toBe(480);
  });

  it("focusWithoutScroll calls focus with preventScroll", () => {
    const el = document.createElement("button");
    const focus = vi.fn();
    el.focus = focus;
    focusWithoutScroll(el);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("workspaceSidebarButtonProps runs on mousedown with scroll preserved", () => {
    const ref = { current: container } as RefObject<HTMLElement>;
    const action = vi.fn(() => {
      container.scrollTop = 0;
    });
    const btn = document.createElement("button");
    const focus = vi.fn();
    btn.focus = focus;
    const props = workspaceSidebarButtonProps(ref, action);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    props.onMouseDown({
      button: 0,
      currentTarget: btn,
      preventDefault,
      stopPropagation,
    } as unknown as MouseEvent<HTMLElement>);
    props.onClick({ preventDefault } as unknown as MouseEvent<HTMLElement>);

    expect(action).toHaveBeenCalledTimes(1);
    expect(container.scrollTop).toBe(480);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("simulates supabase sidebar step switch preserving scroll", () => {
    const ref = { current: container } as RefObject<HTMLElement>;
    const savedTop = readScrollTop(ref);
    const stop = pinScrollTop(savedTop, ref);

    container.scrollTop = 0;
    container.dispatchEvent(new Event("scroll"));
    expect(container.scrollTop).toBe(savedTop);

    const inner = document.createElement("div");
    inner.style.height = "2400px";
    container.appendChild(inner);
    container.scrollTop = 0;
    container.dispatchEvent(new Event("scroll"));
    expect(container.scrollTop).toBe(savedTop);

    stop();
  });
});
