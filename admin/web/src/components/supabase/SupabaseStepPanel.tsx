import type { LocalizedSupabaseStep } from "@/i18n/supabase-ui";
import { cn } from "@/lib/utils";

export function SupabaseStepPanelHeader({ step }: { step: LocalizedSupabaseStep }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
        )}
      >
        {step.num}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-tight">{step.label}</h3>
        <p className="mt-1 text-xs leading-snug text-[var(--color-muted)]">{step.summary}</p>
      </div>
    </div>
  );
}
