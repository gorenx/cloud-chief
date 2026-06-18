import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { formatSetupStepMeta, getLocalizedSetupSteps } from "@/i18n/setup-flow-ui";
import { SETUP_STEPS, type SetupStatus, type SetupStep } from "@/lib/setup-flow";
import { cn } from "@/lib/utils";

export function SetupFlowStepNav({
  status,
  pageStep,
  selectedStep,
  onSelect,
}: {
  status: SetupStatus;
  pageStep?: SetupStep;
  selectedStep: SetupStep;
  onSelect: (step: SetupStep) => void;
}) {
  const t = useT();
  const steps = useMemo(() => getLocalizedSetupSteps(t), [t]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {steps.map((step, i) => {
        const def = SETUP_STEPS[i];
        const done =
          step.id === "gateway"
            ? status.gatewayDone
            : step.id === "provider"
              ? status.providerDone
              : status.byokDone;
        const isSelected = step.id === selectedStep;
        const isPage = pageStep === step.id;

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-stretch gap-2">
            {i > 0 && (
              <ChevronRight
                className="hidden h-4 w-4 shrink-0 self-center text-[var(--color-muted)] sm:block"
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
                    : "border-[var(--color-border)]",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                className="w-full flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done
                        ? "bg-emerald-600 text-white"
                        : isSelected
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : step.num}
                  </span>
                  <span className="font-medium">{step.label}</span>
                  {step.optional && (
                    <span className="rounded bg-[var(--color-panel-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                      {t("common.optional")}
                    </span>
                  )}
                  {isPage && (
                    <span className="text-xs text-[var(--color-muted)]">{t("setupFlow.thisPage")}</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  {step.summary}
                </p>
                <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                  {formatSetupStepMeta(t, step.id, status)}
                </p>
              </button>
              <div className="mt-auto flex min-h-7 justify-end pt-2">
                {!isPage && (
                  <Link
                    to={def.to}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                  >
                    {t("setupFlow.goConfigure")}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
