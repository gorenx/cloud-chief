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
import type { FlowStepCardContent } from "@/lib/flow-card-content";
import { buildFlowCardStatus, truncateFlowLabel } from "@/lib/flow-card-content";
import { joinList } from "@/i18n/worker-ui";

export type LocalizedSetupStep = {
  id: SetupStep;
  num: number;
  label: string;
  hint: string;
  optional?: boolean;
  to: string;
};

const STEP_LABEL_KEYS: Record<SetupStep, MessageKey> = {
  gateway: "setupFlow.step.gateway.label",
  provider: "setupFlow.step.provider.label",
  byok: "setupFlow.step.byok.label",
};

const STEP_HINT_KEYS: Record<SetupStep, MessageKey> = {
  gateway: "setupFlow.step.gateway.hint",
  provider: "setupFlow.step.provider.hint",
  byok: "setupFlow.step.byok.hint",
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
    hint: t(STEP_HINT_KEYS[step.id]),
  }));
}

export function formatSetupStepCardContent(
  t: TranslateFn,
  step: SetupStep,
  status: SetupStatus,
): FlowStepCardContent {
  if (step === "gateway") {
    if (status.gatewayCount === 0) {
      return { status: t("setupFlow.metaGwEmpty"), tone: "pending" };
    }
    const base = t("setupFlow.metaGwCount", { count: status.gatewayCount });
    if (!status.defaultGateway) {
      return { status: base, tone: "done" };
    }
    const full = base + t("setupFlow.metaGwDefault", { gateway: status.defaultGateway });
    const display = base + t("setupFlow.metaGwDefault", { gateway: truncateFlowLabel(status.defaultGateway) });
    return buildFlowCardStatus(display, full, "done");
  }
  if (step === "provider") {
    if (status.providerCount === 0) {
      return { status: t("setupFlow.metaPvEmpty"), tone: "pending" };
    }
    const base = t("setupFlow.metaPvCount", { count: status.providerCount });
    if (!status.defaultSlug) {
      return { status: base, tone: "done" };
    }
    const full = base + t("setupFlow.metaPvDefault", { slug: status.defaultSlug });
    const display = base + t("setupFlow.metaPvDefault", { slug: truncateFlowLabel(status.defaultSlug) });
    return buildFlowCardStatus(display, full, "done");
  }
  if (status.keyCount > 0) {
    return {
      status: t("setupFlow.metaByokCount", { count: status.keyCount }),
      tone: "done",
    };
  }
  return { status: t("setupFlow.metaByokEmpty"), tone: "muted" };
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
): { text: string; to: string; step: SetupStep } | null {
  const action = nextSetupAction(status, current);
  if (!action) return null;
  const step = SETUP_STEPS.find((s) => s.to === action.to)?.id;
  if (!step) return null;
  return { text: t(ACTION_KEYS[action.key]), to: action.to, step };
}

export { joinList };
