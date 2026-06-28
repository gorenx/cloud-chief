import {
  WORKER_SETUP_STEPS,
  workerSetupWarningKeys,
  nextWorkerSetupStep,
  type WorkerSetupStatus,
  type WorkerSetupStep,
  type WorkerSetupWarningKey,
} from "@/lib/worker-setup-flow";
import type { MessageKey, TranslateFn } from "@/i18n";

export type LocalizedWorkerStep = {
  id: WorkerSetupStep;
  num: number;
  label: string;
  summary: string;
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
  }));
}

export function formatWorkerStepMeta(
  t: TranslateFn,
  step: WorkerSetupStep,
  status: WorkerSetupStatus,
): string {
  if (step === "project") {
    return status.workerName
      ? t("worker.meta.projectScript", { name: status.workerName })
      : t("worker.meta.projectEmpty");
  }
  if (step === "vars") {
    if (status.varsDone) return t("worker.meta.varsReady");
    if (status.missingVars.length > 0) {
      return t("worker.meta.varsMissing", { vars: joinList(t, status.missingVars) });
    }
    return t("worker.meta.varsPending");
  }
  if (step === "secrets") {
    if (!status.secretsLocalDone) {
      return status.missingLocalSecrets.length > 0
        ? t("worker.meta.secretsLocalMissing", {
            secrets: joinList(t, status.missingLocalSecrets),
          })
        : t("worker.meta.secretsLocalPending");
    }
    if (!status.secretsProdDone) {
      return t("worker.meta.secretsProdPending", {
        secrets: joinList(t, status.missingProdSecrets),
      });
    }
    return t("worker.meta.secretsAllDone");
  }
  if (step === "ci") {
    if (status.ciDone) return t("worker.meta.ciDone");
    if (status.nameMismatch) return t("worker.meta.ciNameMismatch");
    if (!status.ciTokenOk) return t("worker.meta.ciTokenInvalid");
    if (!status.ciConnected) return t("worker.meta.ciNotConnected");
    return t("worker.meta.ciIncomplete");
  }
  if (status.deployDone) {
    return status.recentCiSuccess
      ? t("worker.meta.deployDoneCiSuccess")
      : t("worker.meta.deployDone", { name: status.workerName ?? "" });
  }
  return t("worker.meta.deployPending");
}

export function formatWorkerStepDetail(
  t: TranslateFn,
  step: WorkerSetupStep,
  status: WorkerSetupStatus,
): string | null {
  if (step === "secrets" && status.secretNames.length > 0) {
    return joinList(t, status.secretNames);
  }
  if (step === "vars" && status.missingVars.length > 0) {
    return joinList(t, status.missingVars);
  }
  return null;
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
