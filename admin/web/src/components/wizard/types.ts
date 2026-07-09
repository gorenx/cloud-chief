import type { TranslateFn } from "@/i18n";
import type { FlowStepCardContent } from "@/lib/flow-card-content";

export type WizardViewMode<TStep extends string> = TStep | "all";

export type WizardLocalizedStep<TStep extends string> = {
  id: TStep;
  num: number;
  label: string;
  hint: string;
  optional?: boolean;
};

export type WizardSidebarHandlers<TStep extends string, TStatus> = {
  stepDone: (step: TStep, status: TStatus) => boolean;
  stepWarn?: (step: TStep, status: TStatus) => boolean;
};

export type WizardStepHandlers<TStep extends string, TStatus> = WizardSidebarHandlers<
  TStep,
  TStatus
> & {
  formatStepCardContent: (
    t: TranslateFn,
    step: TStep,
    status: TStatus,
  ) => FlowStepCardContent;
};
