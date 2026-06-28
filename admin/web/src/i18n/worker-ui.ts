import {
  WORKER_SETUP_STEPS,
  workerSetupWarningKeys,
  nextWorkerSetupStep,
  type WorkerSetupStatus,
  type WorkerSetupStep,
  type WorkerSetupWarningKey,
} from "@/lib/worker-setup-flow";
import type { MessageKey, TranslateFn } from "@/i18n";
import type { FlowStepCardContent } from "@/lib/flow-card-content";
import { buildFlowCardStatus, truncateFlowLabel } from "@/lib/flow-card-content";

export type LocalizedWorkerStep = {
  id: WorkerSetupStep;
  num: number;
  label: string;
  summary: string;
  hint: string;
  optional?: boolean;
};

const STEP_LABEL_KEYS: Record<WorkerSetupStep, MessageKey> = {
  project: "worker.step.project.label",
  vars: "worker.step.vars.label",
  secrets: "worker.step.secrets.label",
  ci: "worker.step.ci.label",
  deploy: "worker.step.deploy.label",
};

const STEP_SUMMARY_KEYS: Record<WorkerSetupStep, MessageKey> = {
  project: "worker.step.project.summary",
  vars: "worker.step.vars.summary",
  secrets: "worker.step.secrets.summary",
  ci: "worker.step.ci.summary",
  deploy: "worker.step.deploy.summary",
};

const STEP_HINT_KEYS: Record<WorkerSetupStep, MessageKey> = {
  project: "worker.step.project.hint",
  vars: "worker.step.vars.hint",
  secrets: "worker.step.secrets.hint",
  ci: "worker.step.ci.hint",
  deploy: "worker.step.deploy.hint",
};

const ACTION_KEYS: Record<WorkerSetupStep, MessageKey> = {
  project: "worker.action.project",
  vars: "worker.action.vars",
  secrets: "worker.action.secrets",
  ci: "worker.action.ci",
  deploy: "worker.action.deploy",
};

const WARNING_KEYS: Record<WorkerSetupWarningKey, MessageKey> = {
  nameMismatch: "worker.warning.nameMismatch",
  prodSecretsPending: "worker.warning.prodSecretsPending",
  ciOptional: "worker.warning.ciOptional",
};

export function joinList(t: TranslateFn, items: string[]): string {
  return items.join(t("common.listSeparator"));
}

export function getLocalizedWorkerSteps(t: TranslateFn): LocalizedWorkerStep[] {
  return WORKER_SETUP_STEPS.map((step) => ({
    id: step.id,
    num: step.num,
    optional: step.optional,
    label: t(STEP_LABEL_KEYS[step.id]),
    summary: t(STEP_SUMMARY_KEYS[step.id]),
    hint: t(STEP_HINT_KEYS[step.id]),
  }));
}

export function formatWorkerStepCardContent(
  t: TranslateFn,
  step: WorkerSetupStep,
  status: WorkerSetupStatus,
): FlowStepCardContent {
  if (step === "project") {
    if (status.workerName) {
      const full = t("worker.meta.projectScript", { name: status.workerName });
      const display = t("worker.meta.projectScript", { name: truncateFlowLabel(status.workerName) });
      return buildFlowCardStatus(display, full, "done");
    }
    return { status: t("worker.meta.projectEmpty"), tone: "pending" };
  }
  if (step === "vars") {
    if (status.varsDone) return { status: t("worker.meta.varsReady"), tone: "done" };
    if (status.missingVars.length > 0) {
      return {
        status: t("worker.meta.varsMissingCount", { count: status.missingVars.length }),
        tone: "warn",
      };
    }
    return { status: t("worker.meta.varsPending"), tone: "pending" };
  }
  if (step === "secrets") {
    if (!status.secretsLocalDone) {
      if (status.missingLocalSecrets.length > 0) {
        return {
          status: t("worker.meta.secretsLocalMissingCount", {
            count: status.missingLocalSecrets.length,
          }),
          tone: "warn",
        };
      }
      return { status: t("worker.meta.secretsLocalPending"), tone: "pending" };
    }
    if (!status.secretsProdDone) {
      return {
        status: t("worker.meta.secretsProdPendingCount", {
          count: status.missingProdSecrets.length,
        }),
        tone: "warn",
      };
    }
    return { status: t("worker.meta.secretsAllDone"), tone: "done" };
  }
  if (step === "ci") {
    if (status.ciDone) return { status: t("worker.meta.ciDone"), tone: "done" };
    if (status.nameMismatch) return { status: t("worker.meta.ciNameMismatch"), tone: "warn" };
    if (!status.ciTokenOk) return { status: t("worker.meta.ciTokenInvalid"), tone: "warn" };
    if (!status.ciConnected) return { status: t("worker.meta.ciNotConnected"), tone: "muted" };
    return { status: t("worker.meta.ciIncomplete"), tone: "muted" };
  }
  if (status.deployDone) {
    if (status.recentCiSuccess) {
      return { status: t("worker.meta.deployDoneCiSuccess"), tone: "done" };
    }
    const name = status.workerName ?? "";
    if (!name) {
      return { status: t("worker.meta.deployDone", { name: "" }), tone: "done" };
    }
    const full = t("worker.meta.deployDone", { name });
    const display = t("worker.meta.deployDone", { name: truncateFlowLabel(name) });
    return buildFlowCardStatus(display, full, "done");
  }
  return { status: t("worker.meta.deployPending"), tone: "pending" };
}

export function formatWorkerSetupWarnings(
  t: TranslateFn,
  status: WorkerSetupStatus,
): string[] {
  return workerSetupWarningKeys(status).map((key) => {
    if (key === "prodSecretsPending") {
      return t(WARNING_KEYS[key], {
        secrets: joinList(t, status.missingProdSecrets),
      });
    }
    return t(WARNING_KEYS[key]);
  });
}

export function formatNextWorkerSetupAction(
  t: TranslateFn,
  status: WorkerSetupStatus,
): { text: string; step: WorkerSetupStep } | null {
  const step = nextWorkerSetupStep(status);
  if (!step) return null;
  return { text: t(ACTION_KEYS[step]), step };
}

export function getWorkerCiHints(t: TranslateFn) {
  return {
    section: t("worker.hint.ciSection"),
    reconfigureToken: t("worker.hint.ciReconfigureToken"),
    refresh: t("worker.hint.ciRefresh"),
    connectGithub: t("worker.hint.ciConnectGithub"),
    syncMonorepo: t("worker.hint.ciSyncMonorepo"),
    triggerBuild: t("worker.hint.ciTriggerBuild"),
  };
}
