import type { LocalizedSupabaseStep } from "@/i18n/supabase-ui";
import { useT } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";

export function SupabaseStepPanelHeader({
  step,
  projectRef,
}: {
  step: LocalizedSupabaseStep;
  projectRef?: string | null;
}) {
  const t = useT();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            "bg-[var(--color-accent-glow)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20",
          )}
        >
          {step.num}
        </span>
        <h3 className="font-display flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold leading-tight">
          <span>{step.label}</span>
          {projectRef !== undefined && (
            <>
              <span className="text-xs font-normal text-[var(--color-muted)]">·</span>
              {projectRef ? (
                <code className="mono text-xs font-medium text-[var(--color-text)]">{projectRef}</code>
              ) : (
                <span className="text-xs font-normal text-[var(--color-muted)]">
                  {t("supabase.meta.projectEmpty")}
                </span>
              )}
            </>
          )}
        </h3>
      </div>
      <p className="max-w-[min(24rem,100%)] shrink-0 text-right text-xs leading-snug text-[var(--color-muted)] sm:max-w-[min(24rem,45%)]">
        {step.summary}
      </p>
    </div>
  );
}
