import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { FlowProgressBar } from "@/components/ui/SetupStepBadge";
import { cn } from "@/lib/utils";

export type FlowShellHeaderStep<TStep extends string> = {
  id: TStep;
  num: number;
  label: string;
};

export function FlowShellHeader<TStep extends string>({
  title,
  progressText,
  subtitle,
  progressPct,
  open,
  onToggle,
  collapsible = true,
  steps,
  stepDone,
  activeStep,
  onStepPillClick,
  coreDoneBadge,
}: {
  title: string;
  progressText?: string;
  subtitle: string;
  progressPct: number;
  open: boolean;
  onToggle: () => void;
  collapsible?: boolean;
  steps: FlowShellHeaderStep<TStep>[];
  stepDone: (step: TStep) => boolean;
  activeStep?: TStep | string;
  onStepPillClick?: (step: TStep) => void;
  coreDoneBadge?: string;
}) {
  const t = useT();

  const titleBlock = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        {progressText && <span className="text-xs text-[var(--color-muted)]">{progressText}</span>}
      </div>
      {collapsible && !open && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[var(--color-muted)]">
          {steps.map((step) => {
            const done = stepDone(step.id);
            const isActive = activeStep === step.id;
            const PillTag = onStepPillClick ? "button" : "span";
            return (
              <PillTag
                key={step.id}
                type={onStepPillClick ? "button" : undefined}
                onClick={onStepPillClick ? () => onStepPillClick(step.id) : undefined}
                title={step.label}
                aria-label={`${step.num}. ${step.label}`}
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  onStepPillClick &&
                    "transition-colors hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
                  isActive &&
                    "bg-[var(--color-accent-glow)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25",
                  !isActive && done && "bg-emerald-950/40 text-emerald-400 ring-1 ring-emerald-900/35",
                  !isActive &&
                    !done &&
                    "bg-[var(--color-panel-elevated)] text-[var(--color-muted)] ring-1 ring-[var(--color-border-subtle)]",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : step.num}
              </PillTag>
            );
          })}
        </p>
      )}
      {(collapsible ? open : true) && (
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>
      )}
      <FlowProgressBar value={progressPct} />
    </>
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 p-4",
        collapsible && open && "border-b border-[var(--color-border-subtle)]",
      )}
    >
      <div className="min-w-0 flex-1">
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-start gap-2 text-left"
          >
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform",
                !open && "-rotate-90",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">{titleBlock}</div>
          </button>
        ) : (
          titleBlock
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {coreDoneBadge && (
          <span className="rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-xs text-emerald-400">
            {coreDoneBadge}
          </span>
        )}
        {collapsible && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]"
          >
            {open ? t("btn.common.collapse") : t("btn.common.expand")}
          </button>
        )}
      </div>
    </div>
  );
}
