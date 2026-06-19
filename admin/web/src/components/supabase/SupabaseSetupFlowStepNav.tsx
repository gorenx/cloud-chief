import { useMemo } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import {
  supabaseStepDone,
  type SupabaseSetupStatus,
  type SupabaseSetupStep,
} from "@/lib/supabase-setup-flow";
import { formatSupabaseStepMeta, getLocalizedSupabaseSteps } from "@/i18n/supabase-ui";
import { cn } from "@/lib/utils";

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
                className="hidden h-4 w-4 shrink-0 self-center text-[var(--color-muted)] lg:block"
                aria-hidden
              />
            )}
            <div
              className={cn(
                "flex h-full min-h-0 min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 transition-colors",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : done
                    ? "border-emerald-900/40 bg-emerald-950/20"
                    : warn
                      ? "border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10"
                      : "border-[var(--color-border)]",
              )}
            >
              {/* 不用原生 button，避免工作区切换步骤后浏览器把焦点落到流程卡片并滚到顶部 */}
              <div
                role="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(step.id)}
                className="w-full flex-1 cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done
                        ? "bg-emerald-600 text-white"
                        : warn
                          ? "bg-[var(--color-warn)] text-black"
                          : isSelected
                            ? "bg-[var(--color-accent)] text-white"
                            : "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </span>
                  <span className="font-medium">{step.label}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  {step.summary}
                </p>
                <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                  {formatSupabaseStepMeta(t, step.id, status)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
