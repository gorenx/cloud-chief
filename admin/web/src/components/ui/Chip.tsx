import { cn } from "@/lib/utils";

export function Chip({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "on" | "off" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        variant === "default" && "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
        variant === "on" && "bg-emerald-950/60 text-emerald-300",
        variant === "off" && "bg-red-950/50 text-red-300",
        variant === "warn" && "bg-amber-950/50 text-amber-300",
      )}
    >
      {children}
    </span>
  );
}
