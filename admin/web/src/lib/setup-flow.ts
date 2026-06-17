export type SetupStep = "gateway" | "provider" | "byok";

export interface SetupStepDef {
  id: SetupStep;
  num: number;
  label: string;
  optional?: boolean;
  summary: string;
  to: string;
}

export const SETUP_STEPS: SetupStepDef[] = [
  {
    id: "gateway",
    num: 1,
    label: "网关",
    summary: "在 Cloudflare 创建 AI Gateway 实例（入口 ID）",
    to: "/gateways",
  },
  {
    id: "provider",
    num: 2,
    label: "提供商",
    summary: "注册自定义上游，得到 slug（URL 中 custom- 后面部分）",
    to: "/providers",
  },
  {
    id: "byok",
    num: 3,
    label: "BYOK 密钥",
    optional: true,
    summary:
      "（可选）把上游 API Key 存入 Cloudflare；不配置时可在 .env 用 DASHSCOPE_API_KEY 直连",
    to: "/keys",
  },
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

export function nextSetupAction(
  status: SetupStatus,
  current: SetupStep,
): { text: string; to: string } | null {
  if (!status.gatewayDone) {
    return current === "gateway" ? null : { text: "请先创建网关", to: "/gateways" };
  }
  if (!status.providerDone) {
    return current === "provider"
      ? null
      : { text: "下一步：添加自定义提供商", to: "/providers" };
  }
  if (current === "byok" && !status.byokDone) return null;
  return { text: "必做已完成，去聊天调试", to: "/playground" };
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
