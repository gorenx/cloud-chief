export type FlowStepCardTone = "done" | "warn" | "pending" | "muted";

export type FlowStepCardContent = {
  status: string;
  tone?: FlowStepCardTone;
  /** 完整 status 文案，display 被截断时用于 title tooltip */
  statusTitle?: string;
};

export function truncateFlowLabel(value: string, max = 16): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function buildFlowCardStatus(
  displayStatus: string,
  fullStatus: string,
  tone?: FlowStepCardTone,
): FlowStepCardContent {
  return {
    status: displayStatus,
    tone,
    statusTitle: displayStatus !== fullStatus ? fullStatus : undefined,
  };
}

/** 卡片容器：窄屏定宽滑动，lg+ flex-1 均分 */
export function flowStepCardWrapperClass(stepCount: number): string {
  const mobile =
    stepCount >= 5 ? "w-[8.75rem]" : stepCount >= 4 ? "w-[9.25rem]" : "w-[10.5rem]";
  return [
    flowStepCardSnapClass(),
    "shrink-0",
    mobile,
    "lg:w-auto lg:min-w-0 lg:flex-1",
  ].join(" ");
}

export function flowStepNavLayoutClass(): string {
  return [
    "flex items-stretch gap-0 overflow-x-auto pb-0.5 snap-x snap-mandatory",
    "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    "lg:overflow-visible lg:snap-none lg:pb-0",
  ].join(" ");
}

export function flowStepCardSnapClass(): string {
  return "snap-start";
}

export function flowCardStatusClass(tone: FlowStepCardTone = "muted"): string {
  switch (tone) {
    case "done":
      return "text-emerald-400";
    case "warn":
      return "text-[var(--color-warn)]";
    case "pending":
      return "text-[var(--color-accent)]";
    default:
      return "text-[var(--color-muted)]";
  }
}
