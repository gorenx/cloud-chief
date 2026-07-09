export type WorkerSetupStep = "project" | "vars" | "secrets" | "ci" | "deploy";
export type WorkerManualDeployState = "idle" | "running" | "failed" | "succeeded";

export interface WorkerSetupStepDef {
  id: WorkerSetupStep;
  num: number;
  label: string;
  optional?: boolean;
  summary: string;
}

export const WORKER_SETUP_STEPS: WorkerSetupStepDef[] = [
  {
    id: "project",
    num: 1,
    label: "项目",
    summary: "选择 monorepo 中的 worker 目录，确认 wrangler.toml 名称",
  },
  {
    id: "vars",
    num: 2,
    label: "Vars",
    summary: "配置 wrangler.toml [vars]（网关 ID、默认模型等）",
  },
  {
    id: "secrets",
    num: 3,
    label: "Secrets",
    summary: "填写本地 .dev.vars；生产环境需推送到 Cloudflare",
  },
  {
    id: "ci",
    num: 4,
    label: "GitHub CI",
    optional: true,
    summary: "连接 GitHub 后 push worker/ 变更可自动构建部署",
  },
  {
    id: "deploy",
    num: 5,
    label: "部署",
    summary: "本机 wrangler deploy，或 push 触发 Workers Builds",
  },
];

export const WORKER_STEP_ANCHORS: Record<WorkerSetupStep, string> = {
  project: "worker-step-project",
  vars: "worker-step-vars",
  secrets: "worker-step-secrets",
  ci: "worker-step-ci",
  deploy: "worker-step-deploy",
};

/** wrangler [vars] 中部署前建议填写的键 */
export const REQUIRED_WORKER_VARS = ["CF_GATEWAY_ID", "DEFAULT_MODEL"] as const;

export interface WorkerSetupStatus {
  projectDone: boolean;
  varsDone: boolean;
  secretsLocalDone: boolean;
  secretsProdDone: boolean;
  ciDone: boolean;
  ciWarn: boolean;
  deployDone: boolean;
  manualDeployState: WorkerManualDeployState;
  workerName: string | null;
  missingVars: string[];
  missingLocalSecrets: string[];
  missingProdSecrets: string[];
  /** 当前 worker 需关注的 secret 名（来自 .dev.vars.example / status） */
  secretNames: string[];
  ciConnected: boolean;
  ciTokenOk: boolean;
  nameMismatch: boolean;
  recentCiSuccess: boolean;
}

export interface WorkerSetupSecretRow {
  name: string;
  value: string;
  optional: boolean;
}

export interface WorkerSetupBuildSummary {
  build_outcome: string | null;
}

export interface WorkerSetupBuildsSnapshot {
  ok: boolean;
  token_configured: boolean;
  token_invalid?: boolean;
  name_mismatch: boolean;
  triggers: Array<{ repo?: { repo_name: string | null } | null }>;
  recent_builds: WorkerSetupBuildSummary[];
}

export interface WorkerSetupStatusSnapshot {
  worker_dir_exists: boolean;
  worker_name: string | null;
  secrets: Array<{ name: string; optional: boolean }>;
  dev_vars: Record<string, string>;
}

export interface DeriveWorkerSetupInput {
  workerDir: string;
  status: WorkerSetupStatusSnapshot | undefined;
  vars: Record<string, string>;
  secrets: WorkerSetupSecretRow[];
  prodSet: Set<string> | null;
  builds: WorkerSetupBuildsSnapshot | undefined;
  deployedScriptNames: Set<string>;
  matchedOnline: boolean;
  manualDeployState?: WorkerManualDeployState;
}

function trackedSecretNames(
  status: WorkerSetupStatusSnapshot | undefined,
  secrets: WorkerSetupSecretRow[],
): string[] {
  const fromStatus = (status?.secrets ?? [])
    .map((s) => s.name.trim())
    .filter(Boolean);
  if (fromStatus.length > 0) return fromStatus;
  return secrets.map((s) => s.name.trim()).filter(Boolean);
}

function requiredSecrets(
  status: WorkerSetupStatusSnapshot | undefined,
  secrets: WorkerSetupSecretRow[],
): Array<{ name: string; optional: boolean }> {
  const fromStatus = status?.secrets ?? [];
  if (fromStatus.length > 0) return fromStatus.filter((s) => !s.optional);
  return secrets
    .filter((s) => s.name.trim() && !s.optional)
    .map((s) => ({ name: s.name.trim(), optional: false }));
}

function secretHasLocalValue(
  name: string,
  secrets: WorkerSetupSecretRow[],
  devVars: Record<string, string>,
): boolean {
  const row = secrets.find((s) => s.name.trim() === name);
  if (row?.value.trim()) return true;
  return Boolean(devVars[name]?.trim());
}

export function deriveWorkerSetupStatus(input: DeriveWorkerSetupInput): WorkerSetupStatus {
  const { status, vars, secrets, prodSet, builds, deployedScriptNames, matchedOnline } = input;
  const workerName = status?.worker_name ?? null;
  const devVars = status?.dev_vars ?? {};
  const manualDeployState = input.manualDeployState ?? "idle";

  const projectDone = Boolean(
    input.workerDir && status?.worker_dir_exists && workerName,
  );

  const missingVars = REQUIRED_WORKER_VARS.filter((k) => !vars[k]?.trim());
  const varsDone = projectDone && missingVars.length === 0;

  const required = requiredSecrets(status, secrets);
  const secretNames = trackedSecretNames(status, secrets);
  const missingLocalSecrets = required
    .map((s) => s.name)
    .filter((name) => !secretHasLocalValue(name, secrets, devVars));
  const secretsLocalDone = projectDone && missingLocalSecrets.length === 0;

  const missingProdSecrets =
    prodSet === null
      ? required.map((s) => s.name)
      : required.map((s) => s.name).filter((name) => !prodSet.has(name));
  const secretsProdDone = secretsLocalDone && missingProdSecrets.length === 0;

  const ciConnected = Boolean(builds?.triggers?.some((t) => t.repo?.repo_name));
  const ciTokenOk = Boolean(builds?.token_configured && !builds?.token_invalid && builds?.ok);
  const nameMismatch = Boolean(builds?.name_mismatch);
  const ciWarn = Boolean(builds?.token_configured && (!ciTokenOk || nameMismatch));
  const ciDone = Boolean(
    ciTokenOk && ciConnected && !nameMismatch && (builds?.triggers?.length ?? 0) > 0,
  );

  const recentCiSuccess = Boolean(
    builds?.recent_builds?.some((b) => isSuccessfulBuild(b)),
  );
  const cloudDeployDone = Boolean(
    workerName &&
      deployedScriptNames.has(workerName) &&
      (matchedOnline || recentCiSuccess),
  );
  const deployDone =
    manualDeployState === "succeeded"
      ? true
      : manualDeployState === "failed" || manualDeployState === "running"
        ? false
        : cloudDeployDone;

  return {
    projectDone,
    varsDone,
    secretsLocalDone,
    secretsProdDone,
    ciDone,
    ciWarn,
    deployDone,
    manualDeployState,
    workerName,
    missingVars: [...missingVars],
    missingLocalSecrets,
    missingProdSecrets,
    secretNames,
    ciConnected,
    ciTokenOk,
    nameMismatch,
    recentCiSuccess,
  };
}

function isSuccessfulBuild(b: WorkerSetupBuildSummary): boolean {
  const outcome = b.build_outcome?.toLowerCase() ?? "";
  return outcome === "success" || outcome === "succeeded" || outcome === "ok";
}

export function workerStepDone(step: WorkerSetupStep, status: WorkerSetupStatus): boolean {
  if (step === "project") return status.projectDone;
  if (step === "vars") return status.varsDone;
  if (step === "secrets") return status.secretsLocalDone;
  if (step === "ci") return status.ciDone;
  return status.deployDone;
}

export function workerCoreDone(status: WorkerSetupStatus): boolean {
  return status.projectDone && status.varsDone && status.secretsLocalDone;
}

export function workerSetupProgress(status: WorkerSetupStatus): {
  coreDone: number;
  coreTotal: number;
  totalDone: number;
  totalSteps: number;
} {
  const coreDone = [status.projectDone, status.varsDone, status.secretsLocalDone].filter(
    Boolean,
  ).length;
  const totalDone = WORKER_SETUP_STEPS.filter((s) => workerStepDone(s.id, status)).length;
  return { coreDone, coreTotal: 3, totalDone, totalSteps: WORKER_SETUP_STEPS.length };
}

export function workerStepMeta(step: WorkerSetupStep, status: WorkerSetupStatus): string {
  if (step === "project") {
    return status.workerName ? `脚本 ${status.workerName}` : "尚未选择有效项目";
  }
  if (step === "vars") {
    if (status.varsDone) return "必填 Vars 已就绪";
    if (status.missingVars.length > 0) return `缺少 ${status.missingVars.join("、")}`;
    return "待配置";
  }
  if (step === "secrets") {
    if (!status.secretsLocalDone) {
      return status.missingLocalSecrets.length > 0
        ? `待填写 ${status.missingLocalSecrets.join("、")}`
        : "待填写本地密钥";
    }
    if (!status.secretsProdDone) {
      return `本地已就绪 · 生产待推送 ${status.missingProdSecrets.join("、")}`;
    }
    return "本地与生产均已配置";
  }
  if (step === "ci") {
    if (status.ciDone) return "GitHub 已连接 · Token 有效";
    if (status.nameMismatch) return "Worker 名称不一致，请先在 Dashboard 修正";
    if (!status.ciTokenOk) return "请配置有效的 CF_WORKER_BUILDER";
    if (!status.ciConnected) return "未连接 GitHub（可跳过，改用手动部署）";
    return "未完成（可跳过）";
  }
  if (status.deployDone) {
    return status.recentCiSuccess
      ? "已部署 · 最近 CI 构建成功"
      : `已上线 ${status.workerName ?? ""}`;
  }
  if (status.manualDeployState === "running") return "正在部署";
  if (status.manualDeployState === "failed") return "最近部署失败";
  return "尚未部署到 Cloudflare";
}

export function workerSetupWarningKeys(status: WorkerSetupStatus): WorkerSetupWarningKey[] {
  const keys: WorkerSetupWarningKey[] = [];
  if (status.nameMismatch) {
    keys.push("nameMismatch");
  }
  if (status.secretsLocalDone && !status.secretsProdDone && status.missingProdSecrets.length > 0) {
    keys.push("prodSecretsPending");
  }
  if (status.deployDone && !status.ciDone) {
    keys.push("ciOptional");
  }
  return keys;
}

export type WorkerSetupWarningKey = "nameMismatch" | "prodSecretsPending" | "ciOptional";

export function nextWorkerSetupStep(status: WorkerSetupStatus): WorkerSetupStep | null {
  if (!status.projectDone) return "project";
  if (!status.varsDone) return "vars";
  if (!status.secretsLocalDone) return "secrets";
  if (!status.deployDone) return "deploy";
  if (!status.ciDone) return "ci";
  return null;
}

/** @deprecated Use nextWorkerSetupStep — kept for tests */
export function nextWorkerSetupAction(
  status: WorkerSetupStatus,
): { step: WorkerSetupStep } | null {
  const step = nextWorkerSetupStep(status);
  return step ? { step } : null;
}

export function resolveWorkerSetupCurrent(status: WorkerSetupStatus): WorkerSetupStep {
  if (!status.projectDone) return "project";
  if (!status.varsDone) return "vars";
  if (!status.secretsLocalDone) return "secrets";
  if (!status.deployDone) return "deploy";
  return "deploy";
}
