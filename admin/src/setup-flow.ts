export type SetupStep = "gateway" | "provider" | "byok";

export interface SetupStepDef {
  id: SetupStep;
  num: number;
  optional?: boolean;
  to: string;
}

export const SETUP_STEPS: SetupStepDef[] = [
  { id: "gateway", num: 1, to: "/gateways" },
  { id: "provider", num: 2, to: "/providers" },
  { id: "byok", num: 3, optional: true, to: "/keys" },
];

export interface SetupStatus {
  gatewayDone: boolean;
  providerDone: boolean;
  byokDone: boolean;
  defaultGateway: string;
  defaultSlug: string;
  gatewayCount: number;
  providerCount: number;
  keyCount: number;
}

export function setupSetupProgress(status: SetupStatus): {
  done: number;
  total: number;
  coreDone: number;
  coreTotal: number;
} {
  const coreTotal = 2;
  const coreDone = (status.gatewayDone ? 1 : 0) + (status.providerDone ? 1 : 0);
  const total = SETUP_STEPS.length;
  const done = coreDone + (status.byokDone ? 1 : 0);
  return { done, total, coreDone, coreTotal };
}

export function stepDone(step: SetupStep, status: SetupStatus): boolean {
  if (step === "gateway") return status.gatewayDone;
  if (step === "provider") return status.providerDone;
  return status.byokDone;
}

export function deriveSetupStatus(
  state: {
    defaults: { gateway: string; provider_slug: string };
    gateways: { id: string }[];
    providers: { slug: string }[];
  } | undefined,
  keyCount = 0,
): SetupStatus {
  const defaultGateway = state?.defaults.gateway ?? "";
  const defaultSlug = state?.defaults.provider_slug ?? "";
  const gatewayCount = state?.gateways.length ?? 0;
  const providerCount = state?.providers.length ?? 0;

  const gatewayDone =
    gatewayCount > 0 &&
    (!defaultGateway || state!.gateways.some((g) => g.id === defaultGateway));

  const providerDone =
    providerCount > 0 &&
    (!defaultSlug || state!.providers.some((p) => p.slug === defaultSlug));

  return {
    gatewayDone,
    providerDone,
    byokDone: keyCount > 0,
    defaultGateway,
    defaultSlug,
    gatewayCount,
    providerCount,
    keyCount,
  };
}

export type SetupActionKey = "createGateway" | "addProvider" | "goPlayground";

export function nextSetupAction(
  status: SetupStatus,
  current: SetupStep,
): { key: SetupActionKey; to: string } | null {
  if (!status.gatewayDone) {
    return current === "gateway" ? null : { key: "createGateway", to: "/gateways" };
  }
  if (!status.providerDone) {
    return current === "provider" ? null : { key: "addProvider", to: "/providers" };
  }
  if (current === "byok" && !status.byokDone) return null;
  return { key: "goPlayground", to: "/playground" };
}

export type SetupWarningKey = "hintGateway" | "hintProvider";

export function setupSetupWarningKeys(
  status: SetupStatus,
  pageStep?: SetupStep,
): SetupWarningKey[] {
  const keys: SetupWarningKey[] = [];
  if (pageStep === "gateway" && !status.gatewayDone) keys.push("hintGateway");
  if (pageStep === "provider" && status.gatewayDone && !status.providerDone) {
    keys.push("hintProvider");
  }
  return keys;
}

export function resolveSetupCurrent(
  currentProp: SetupStep | undefined,
  status: SetupStatus,
): SetupStep {
  const auto: SetupStep | null = !status.gatewayDone
    ? "gateway"
    : !status.providerDone
      ? "provider"
      : null;
  return currentProp ?? auto ?? "provider";
}

/** 概览等无 pageStep 时，默认选中的流程步骤 */
export function defaultSelectedStep(
  pageStep: SetupStep | undefined,
  status: SetupStatus,
): SetupStep {
  if (pageStep) return pageStep;
  if (!status.gatewayDone) return "gateway";
  if (!status.providerDone) return "provider";
  return "byok";
}
