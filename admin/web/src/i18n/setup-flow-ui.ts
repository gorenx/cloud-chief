import {
  SETUP_STEPS,
  nextSetupAction,
  setupSetupWarningKeys,
  type SetupActionKey,
  type SetupStatus,
  type SetupStep,
  type SetupWarningKey,
} from "@/lib/setup-flow";
import type { MessageKey, TranslateFn } from "@/i18n";
import { joinList } from "@/i18n/worker-ui";

export type LocalizedSetupStep = {
  id: SetupStep;
  num: number;
  label: string;
  summary: string;
  optional?: boolean;
  to: string;
};

const STEP_LABEL_KEYS: Record<SetupStep, MessageKey> = {
  gateway: "setupFlow.step.gateway.label",
  provider: "setupFlow.step.provider.label",
  byok: "setupFlow.step.byok.label",
};

const STEP_SUMMARY_KEYS: Record<SetupStep, MessageKey> = {
  gateway: "setupFlow.step.gateway.summary",
  provider: "setupFlow.step.provider.summary",
  byok: "setupFlow.step.byok.summary",
};

const ACTION_KEYS: Record<SetupActionKey, MessageKey> = {
  createGateway: "setupFlow.actionGw",
  addProvider: "setupFlow.actionPv",
  goPlayground: "setupFlow.actionPlayground",
};

const WARNING_KEYS: Record<SetupWarningKey, MessageKey> = {
  hintGateway: "setupFlow.hintGateway",
  hintProvider: "setupFlow.hintProvider",
};

export function getLocalizedSetupSteps(t: TranslateFn): LocalizedSetupStep[] {
  return SETUP_STEPS.map((step) => ({
    id: step.id,
    num: step.num,
    optional: step.optional,
    to: step.to,
    label: t(STEP_LABEL_KEYS[step.id]),
    summary: t(STEP_SUMMARY_KEYS[step.id]),
  }));
}

export function formatSetupStepMeta(
  t: TranslateFn,
  step: SetupStep,
  status: SetupStatus,
): string {
  if (step === "gateway") {
    const base =
      status.gatewayCount > 0
        ? t("setupFlow.metaGwCount", { count: status.gatewayCount })
        : t("setupFlow.metaGwEmpty");
    return status.defaultGateway
      ? base + t("setupFlow.metaGwDefault", { gateway: status.defaultGateway })
      : base;
  }
  if (step === "provider") {
    const base =
      status.providerCount > 0
        ? t("setupFlow.metaPvCount", { count: status.providerCount })
        : t("setupFlow.metaPvEmpty");
    return status.defaultSlug
      ? base + t("setupFlow.metaPvDefault", { slug: status.defaultSlug })
      : base;
  }
  return status.keyCount > 0
    ? t("setupFlow.metaByokCount", { count: status.keyCount })
    : t("setupFlow.metaByokEmpty");
}

export function formatSetupWarnings(
  t: TranslateFn,
  status: SetupStatus,
  pageStep?: SetupStep,
): string[] {
  return setupSetupWarningKeys(status, pageStep).map((key) => t(WARNING_KEYS[key]));
}

export function formatNextSetupAction(
  t: TranslateFn,
  status: SetupStatus,
  current: SetupStep,
): { text: string; to: string } | null {
  const action = nextSetupAction(status, current);
  if (!action) return null;
  return { text: t(ACTION_KEYS[action.key]), to: action.to };
}

export { joinList };
