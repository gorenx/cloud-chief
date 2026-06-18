import {
  WORKER_STEP_ANCHORS,
  type WorkerSetupStep,
} from "../../../src/worker-setup-flow";

export {
  WORKER_SETUP_STEPS,
  WORKER_STEP_ANCHORS,
  REQUIRED_WORKER_VARS,
  deriveWorkerSetupStatus,
  workerStepDone,
  workerCoreDone,
  workerSetupProgress,
  workerStepMeta,
  workerSetupWarnings,
  resolveWorkerSetupCurrent,
  nextWorkerSetupAction,
  type WorkerSetupStep,
  type WorkerSetupStepDef,
  type WorkerSetupStatus,
  type DeriveWorkerSetupInput,
} from "../../../src/worker-setup-flow";

export function scrollToWorkerStep(step: WorkerSetupStep): void {
  const el = document.getElementById(WORKER_STEP_ANCHORS[step]);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}
