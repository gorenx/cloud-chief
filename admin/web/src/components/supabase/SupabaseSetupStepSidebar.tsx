import { useMemo } from "react";
import { useT } from "@/contexts/LocaleContext";
import { Check, LayoutList } from "lucide-react";
import {
  supabaseStepDone,
  type SupabaseSetupStatus,
  type SupabaseSetupStep,
} from "@/lib/supabase-setup-flow";
import { getLocalizedSupabaseSteps } from "@/i18n/supabase-ui";
import { cn } from "@/lib/utils";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import { workspaceSidebarButtonProps } from "@/lib/prevent-nav-scroll";

export type SupabaseViewMode = SupabaseSetupStep | "all";

export function SupabaseSetupShowAllButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const scrollRef = useScrollContainer();
  return (
    <button
      type="button"
      {...workspaceSidebarButtonProps(scrollRef, onClick)}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium transition-colors",
        active
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
      )}
    >
      <LayoutList className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {t("btn.worker.showAll")}
    </button>
  );
}

export function SupabaseSetupStepList({
  status,
  activeStep,
  onSelect,
}: {
  status: SupabaseSetupStatus;
  activeStep: SupabaseViewMode;
  onSelect: (step: SupabaseSetupStep) => void;
}) {
  const t = useT();
  const scrollRef = useScrollContainer();
  const steps = useMemo(() => getLocalizedSupabaseSteps(t), [t]);

  return (
    <nav className="flex flex-col gap-0.5" aria-label={t("aria.deploySteps")}>
      {steps.map((step) => {
        const done = supabaseStepDone(step.id, status);
        const warn =
          (step.id === "database" && status.needsDbScope && !done) ||
          (step.id === "functions" && status.needsFunctionsScope && !done);
        const selected = activeStep === step.id;

        return (
          <button
            key={step.id}
            type="button"
            {...workspaceSidebarButtonProps(scrollRef, () => onSelect(step.id))}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-2.5 text-left text-xs transition-colors",
              selected
                ? "bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent)]"
                : done
                  ? "text-emerald-400 hover:bg-emerald-950/20"
                  : warn
                    ? "text-[var(--color-warn)] hover:bg-[var(--color-warn)]/10"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                done
                  ? "bg-emerald-600 text-white"
                  : warn
                    ? "bg-[var(--color-warn)] text-black"
                    : selected
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : step.num}
            </span>
            <span className="min-w-0 flex-1 truncate">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
