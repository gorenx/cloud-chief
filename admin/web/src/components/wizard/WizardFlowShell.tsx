import { forwardRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { ClickTarget } from "@/components/ui/ClickTarget";
import { FlowPanel, FlowProgressBar } from "@/components/ui/SetupStepBadge";
import { WizardFlowStepNav } from "@/components/wizard/WizardFlowStepNav";
import type { WizardLocalizedStep, WizardStepHandlers, WizardViewMode } from "@/components/wizard/types";
import type { TranslateFn } from "@/i18n";
import { cn } from "@/lib/utils";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";

export type WizardFlowShellProps<TStep extends string, TStatus> = {
  flowStatus: TStatus;
  activeStep: WizardViewMode<TStep>;
  onGoToStep: (step: TStep) => void;
  steps: WizardLocalizedStep<TStep>[];
  navSelected: TStep;
  title: string;
  subtitle: string;
  progressText: string;
  progressPct: number;
  coreDone: boolean;
  coreDoneBadge?: string;
  action: { text: string; step: TStep } | null;
  warnings: string[];
  statusChips: ReactNode;
  showAllDone?: boolean;
  allDoneMessage?: string;
  optionalLabel?: string;
} & WizardStepHandlers<TStep, TStatus> & {
  formatStepDetail?: (t: TranslateFn, step: TStep, status: TStatus) => string | null;
};

function WizardFlowShellInner<TStep extends string, TStatus>(
  {
    flowStatus,
    activeStep,
    onGoToStep,
    steps,
    navSelected,
    title,
    subtitle,
    progressText,
    progressPct,
    coreDone,
    coreDoneBadge,
    action,
    warnings,
    statusChips,
    showAllDone,
    allDoneMessage,
    optionalLabel,
    stepDone,
    stepWarn,
    formatStepMeta,
    formatStepDetail,
  }: WizardFlowShellProps<TStep, TStatus>,
  ref: React.Ref<HTMLDivElement>,
) {
  const t = useT();
  const scrollRef = useScrollContainer();
  const [open, setOpen] = useState(!coreDone);
  const toggleOpen = () => setOpen((v) => !v);

  return (
    <FlowPanel ref={ref}>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 p-4",
          open && "border-b border-[var(--color-border-subtle)]",
        )}
      >
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform",
              !open && "-rotate-90",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-semibold">{title}</h2>
              <span className="text-xs text-[var(--color-muted)]">{progressText}</span>
            </div>
            {!open && (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
                {steps.map((step) => {
                  const done = stepDone(step.id, flowStatus);
                  return (
                    <span
                      key={step.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                        activeStep === step.id &&
                          "bg-[var(--color-accent-glow)] text-[var(--color-accent)]",
                        activeStep !== step.id && done && "text-emerald-400",
                      )}
                    >
                      {step.num}. {step.label}
                      {done && <Check className="h-3 w-3" />}
                    </span>
                  );
                })}
              </p>
            )}
            {open && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>}
            <FlowProgressBar value={progressPct} />
          </div>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {coreDone && coreDoneBadge && (
            <span className="rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-xs text-emerald-400">
              {coreDoneBadge}
            </span>
          )}
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={open}
            className="rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]"
          >
            {open ? t("btn.common.collapse") : t("btn.common.expand")}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 p-4 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">{statusChips}</div>

          <WizardFlowStepNav
            steps={steps}
            status={flowStatus}
            selectedStep={navSelected}
            onSelect={onGoToStep}
            stepDone={stepDone}
            stepWarn={stepWarn}
            formatStepMeta={formatStepMeta}
            formatStepDetail={formatStepDetail}
            optionalLabel={optionalLabel}
          />

          {action && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/40 px-3 py-2.5">
              <p className="text-xs text-[var(--color-muted)]">{action.text}</p>
              <ClickTarget
                onClick={() => onGoToStep(action.step)}
                scrollRef={scrollRef}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-glow)]"
              >
                {t("btn.common.goTo")}
              </ClickTarget>
            </div>
          )}

          {warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-[var(--radius-md)] border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/8 px-3 py-2.5 text-xs text-[var(--color-warn)]">
              {warnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          )}

          {showAllDone && allDoneMessage && (
            <p className="text-xs text-emerald-400">{allDoneMessage}</p>
          )}
        </div>
      )}
    </FlowPanel>
  );
}

export const WizardFlowShell = forwardRef(WizardFlowShellInner) as <
  TStep extends string,
  TStatus,
>(
  props: WizardFlowShellProps<TStep, TStatus> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement;
