import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { pinScrollTop, readMainScrollTop, restoreMainScrollTop } from "@/lib/prevent-nav-scroll";

/** 在布局刷新或异步请求期间钉住主滚动位置。返回 lockScrollPosition，在 setState 前调用。 */
export function usePinMainScrollWhileBusy(
  busy: boolean,
  scrollRef: RefObject<HTMLElement | null>,
  syncDeps: unknown[] = [],
) {
  const lock = useRef<number | null>(null);

  const lockScrollPosition = useCallback(() => {
    lock.current = readMainScrollTop(scrollRef);
  }, [scrollRef]);

  useLayoutEffect(() => {
    if (lock.current === null) return;
    restoreMainScrollTop(lock.current, scrollRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncDeps are caller-provided render sync keys
  }, [busy, scrollRef, ...syncDeps]);

  useLayoutEffect(() => {
    if (lock.current === null || busy) return;
    lock.current = null;
  }, [busy, scrollRef]);

  useEffect(() => {
    if (!busy || lock.current === null) return;
    return pinScrollTop(lock.current, scrollRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, scrollRef, ...syncDeps]);

  return lockScrollPosition;
}
