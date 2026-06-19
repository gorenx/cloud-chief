import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-0.5",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-medium transition-all duration-200",
            value === opt.value
              ? "bg-[var(--color-accent-glow)] text-[var(--color-accent)] shadow-[inset_0_0_0_1px_rgba(212,160,84,0.2)]"
              : "text-[var(--color-muted)] hover:text-[var(--color-text)]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
