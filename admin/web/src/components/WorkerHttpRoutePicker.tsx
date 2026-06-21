import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import type { WorkerHttpRoute } from "@/lib/worker-http-routes";
import { cn } from "@/lib/utils";

export function WorkerHttpRoutePicker({
  routes,
  activeId,
  onSelect,
  onDelete,
  title,
  className,
}: {
  routes: WorkerHttpRoute[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  title?: string;
  className?: string;
}) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const activeRoute = routes.find((r) => r.id === activeId) ?? routes[0];

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, routes.length]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-full w-full min-w-0 items-center gap-1 border-r border-[var(--color-border-subtle)] bg-transparent px-2 py-2 font-mono text-xs text-[var(--color-text)] outline-none hover:bg-[var(--color-bg-elevated)]/40"
      >
        <span className="min-w-0 flex-1 truncate text-left">{activeRoute?.path ?? "—"}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-[var(--color-muted)] transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && menuPos && (
        <ul
          role="listbox"
          aria-label={title}
          style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.width }}
          className="fixed z-50 max-h-56 w-max overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] py-1 shadow-lg"
        >
          {routes.map((route) => {
            const selected = route.id === activeId;
            return (
              <li key={route.id} role="presentation" className="flex min-w-0 items-stretch">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(route.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left font-mono text-xs hover:bg-[var(--color-panel-elevated)]",
                    selected && "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
                  )}
                >
                  {selected ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{route.path}</span>
                </button>
                {!route.builtin && (
                  <button
                    type="button"
                    title={t("common.delete")}
                    aria-label={t("common.delete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(route.id);
                    }}
                    className="shrink-0 px-2 text-[var(--color-muted)] hover:bg-[var(--color-err)]/10 hover:text-[var(--color-err)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
