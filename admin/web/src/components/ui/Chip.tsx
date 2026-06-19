import { cn } from "@/lib/utils";

export function Chip({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "on" | "off" | "warn" | "ice";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide",
        variant === "default" && "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
        variant === "on" && "bg-emerald-950/50 text-emerald-300 ring-1 ring-emerald-800/40",
        variant === "off" && "bg-red-950/40 text-red-300 ring-1 ring-red-900/30",
        variant === "warn" && "bg-amber-950/40 text-amber-300 ring-1 ring-amber-900/30",
        variant === "ice" && "bg-cyan-950/40 text-[var(--color-ice)] ring-1 ring-cyan-900/30",
      )}
    >
      {children}
    </span>
  );
}
