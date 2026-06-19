import { createContext, useContext, type RefObject } from "react";

export const ScrollContainerContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useScrollContainer(): RefObject<HTMLElement | null> {
  const ref = useContext(ScrollContainerContext);
  if (!ref) {
    throw new Error("useScrollContainer must be used within AppShell");
  }
  return ref;
}
