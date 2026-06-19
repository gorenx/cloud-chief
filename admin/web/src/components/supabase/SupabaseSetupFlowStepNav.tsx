import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { ClickTarget } from "@/components/ui/ClickTarget";
import {
  supabaseStepDone,
  type SupabaseSetupStatus,
  type SupabaseSetupStep,
} from "@/lib/supabase-setup-flow";
import { formatSupabaseStepMeta, getLocalizedSupabaseSteps } from "@/i18n/supabase-ui";
import { SetupStepBadge, setupStepCardClasses } from "@/components/ui/SetupStepBadge";

export function SupabaseSetupFlowStepNav({
  status,
  selectedStep,
  onSelect,
}: {
  status: SupabaseSetupStatus;
  selectedStep: SupabaseSetupStep;
  onSelect: (step: SupabaseSetupStep) => void;
}) {
  const t = useT();
  const steps = useMemo(() => getLocalizedSupabaseSteps(t), [t]);

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
      {steps.map((step, i) => {
        const done = supabaseStepDone(step.id, status);
        const warn =
          (step.id === "database" && status.needsDbScope && !done) ||
          (step.id === "functions" && status.needsFunctionsScope && !done);
        const isSelected = step.id === selectedStep;

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-stretch gap-2">
            {i > 0 && (
              <ChevronRight
                className="hidden h-4 w-4 shrink-0 self-center text-[var(--color-muted)]/50 lg:block"
                aria-hidden
              />
            )}
            <div className={setupStepCardClasses({ isSelected, done, warn })}>
              <ClickTarget
                onClick={() => onSelect(step.id)}
                className="w-full flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <SetupStepBadge done={done} warn={warn} selected={isSelected} num={step.num} />
                  <span className="font-medium">{step.label}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  {step.summary}
                </p>
                <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                  {formatSupabaseStepMeta(t, step.id, status)}
                </p>
              </ClickTarget>
            </div>
          </div>
        );
      })}
    </div>
  );
}
