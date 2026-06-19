import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { formatSetupStepMeta, getLocalizedSetupSteps } from "@/i18n/setup-flow-ui";
import { SETUP_STEPS, type SetupStatus, type SetupStep } from "@/lib/setup-flow";
import { SetupStepBadge, setupStepCardClasses } from "@/components/ui/SetupStepBadge";
import { ClickTarget } from "@/components/ui/ClickTarget";

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
                className="hidden h-4 w-4 shrink-0 self-center text-[var(--color-muted)]/50 sm:block"
                aria-hidden
              />
            )}
            <div className={setupStepCardClasses({ isSelected, done })}>
              <ClickTarget onClick={() => onSelect(step.id)} className="w-full flex-1 text-left">
                <div className="flex items-center gap-2">
                  <SetupStepBadge done={done} selected={isSelected} num={step.num} />
                  <span className="font-medium">{step.label}</span>
                  {step.optional && (
                    <span className="rounded bg-[var(--color-panel-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                      {t("common.optional")}
                    </span>
                  )}
                  {isPage && (
                    <span className="text-xs text-[var(--color-ice)]">{t("setupFlow.thisPage")}</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  {step.summary}
                </p>
                <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                  {formatSetupStepMeta(t, step.id, status)}
                </p>
              </ClickTarget>
              <div className="mt-auto flex min-h-7 justify-end pt-2">
                {!isPage && (
                  <Link
                    to={def.to}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2 py-1 text-xs text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-glow)]"
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
