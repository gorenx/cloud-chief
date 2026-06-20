import type { ReactNode } from "react";
import type { TranslateFn } from "@/i18n";

export type WizardViewMode<TStep extends string> = TStep | "all";

export type WizardLocalizedStep<TStep extends string> = {
  id: TStep;
  num: number;
  label: string;
  summary: string;
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
  formatStepMeta: (t: TranslateFn, step: TStep, status: TStatus) => string;
};
