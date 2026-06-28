import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { ClickTarget } from "@/components/ui/ClickTarget";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import { SetupStepBadge, setupStepCardClasses } from "@/components/ui/SetupStepBadge";
import type { FlowStepCardContent } from "@/lib/flow-card-content";
import {
  flowCardStatusClass,
  flowStepCardWrapperClass,
  flowStepNavLayoutClass,
} from "@/lib/flow-card-content";
import type { TranslateFn } from "@/i18n";
import { cn } from "@/lib/utils";

export type FlowStepCardStep<TStep extends string> = {
  id: TStep;
  num: number;
  label: string;
  hint: string;
  optional?: boolean;
};

function FlowStepArrow() {
  return (
    <ChevronRight
      className="mx-0.5 h-4 w-4 shrink-0 self-center snap-none text-[var(--color-muted)]/50"
      aria-hidden
    />
  );
}

export function FlowStepCardNav<TStep extends string, TStatus>({
  steps,
  status,
  selectedStep,
  onSelect,
  stepDone,
  stepWarn,
  formatStepCardContent,
  optionalLabel,
  pageStep,
  currentPageLabel,
}: {
  steps: FlowStepCardStep<TStep>[];
  status: TStatus;
  selectedStep: TStep;
  onSelect: (step: TStep) => void;
  stepDone: (step: TStep, status: TStatus) => boolean;
  stepWarn?: (step: TStep, status: TStatus) => boolean;
  formatStepCardContent: (t: TranslateFn, step: TStep, status: TStatus) => FlowStepCardContent;
  optionalLabel?: string;
  pageStep?: TStep;
  currentPageLabel?: string;
}) {
  const t = useT();
  const scrollRef = useScrollContainer();
  const stepCount = steps.length;

  return (
    <div className={flowStepNavLayoutClass()}>
      {steps.map((step, i) => {
        const done = stepDone(step.id, status);
        const warn = stepWarn?.(step.id, status) ?? false;
        const isSelected = step.id === selectedStep;
        const isPage = pageStep === step.id;
        const content = formatStepCardContent(t, step.id, status);
        const showHint = !done && !isSelected;

        return (
          <Fragment key={step.id}>
            {i > 0 && <FlowStepArrow />}
            <div className={flowStepCardWrapperClass(stepCount)}>
              <div className={setupStepCardClasses({ isSelected, done, warn })}>
                <ClickTarget
                  onClick={() => onSelect(step.id)}
                  scrollRef={scrollRef}
                  className="flex h-full flex-col px-3 py-2.5 text-left"
                >
                  <div className="flex shrink-0 items-center gap-1.5">
                    <SetupStepBadge done={done} warn={warn} selected={isSelected} num={step.num} />
                    <span className="min-w-0 truncate font-medium" title={step.label}>
                      {step.label}
                    </span>
                    {step.optional && optionalLabel && (
                      <span className="shrink-0 rounded bg-[var(--color-panel-elevated)] px-1 py-0.5 text-[10px] text-[var(--color-muted)]">
                        {optionalLabel}
                      </span>
                    )}
                    {isPage && currentPageLabel && (
                      <span className="shrink-0 text-[10px] text-[var(--color-ice)]">
                        {currentPageLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]">
                    <p
                      className={cn(
                        "text-xs font-medium leading-relaxed",
                        flowCardStatusClass(content.tone),
                      )}
                      title={content.statusTitle}
                    >
                      {content.status}
                    </p>
                    {showHint && (
                      <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                        {step.hint}
                      </p>
                    )}
                  </div>
                </ClickTarget>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
