export type CallMode = "gateway" | "worker";
export type WorkerConfigSource = "worker" | "ui";
export type WorkerTarget = "local" | "online";

/** 按切换目标解析展示 / 请求用的 Worker URL */
export function resolveWorkerDisplayUrl(
  worker: { local_url?: string; online_url?: string | null; url: string } | null,
  target: WorkerTarget,
): string {
  if (!worker) return "";
  if (target === "online" && worker.online_url) return worker.online_url;
  return worker.local_url ?? worker.url;
}

/** Playground 派生逻辑所需的最小 config 切片（避免 @/ 路径依赖） */
export interface PlaygroundConfigSlice {
  model: string;
  provider_slug?: string;
  worker_routing?: { gateway: string; default_model: string | null };
}

export interface PlaygroundSessionFlags {
  isWorker: boolean;
  useWorkerToml: boolean;
  /** 顶栏网关/模型选择器始终展示；Worker 配置模式下只读 */
  modelLocked: boolean;
  gatewayLocked: boolean;
}

export function deriveSessionFlags(
  callMode: CallMode,
  workerConfigSource: WorkerConfigSource,
): PlaygroundSessionFlags {
  const isWorker = callMode === "worker";
  const useWorkerToml = isWorker && workerConfigSource === "worker";
  return {
    isWorker,
    useWorkerToml,
    modelLocked: useWorkerToml,
    gatewayLocked: useWorkerToml,
  };
}

/** Worker 配置：wrangler DEFAULT_MODEL；其余：调试界面所选 model */
export function resolveEffectiveModel(
  config: PlaygroundConfigSlice | null,
  uiModel: string,
  useWorkerToml: boolean,
): string {
  if (useWorkerToml) return config?.worker_routing?.default_model ?? "";
  return uiModel;
}

/** Worker 配置：wrangler CF_GATEWAY_ID；其余：调试界面所选 gateway */
export function resolveEffectiveGateway(
  config: PlaygroundConfigSlice | null,
  uiGateway: string,
  useWorkerToml: boolean,
): string {
  if (useWorkerToml) return config?.worker_routing?.gateway ?? uiGateway;
  return uiGateway;
}

export function emptyChatHint(flags: PlaygroundSessionFlags): string {
  if (!flags.isWorker) {
    return "通过 Cloudflare AI Gateway 对话，输入消息开始。";
  }
  if (flags.useWorkerToml) {
    return "经 Worker 对话，使用 wrangler.toml 中的 DEFAULT_MODEL。";
  }
  return "经 Worker 对话，模型与网关由调试界面选择（Worker 仍固定 wrangler 路由）。";
}

export interface ChatRequestParams {
  callMode: CallMode;
  effectiveModel: string;
  messages: Array<{ role: string; content: string }>;
  gateway: string;
  providerSlug?: string;
  workerAccessToken: string;
  workerTestEmail?: string;
  workerTestPassword?: string;
  workerTarget?: WorkerTarget;
  useWorkerToml: boolean;
}

export function buildChatRequest(params: ChatRequestParams): {
  url: string;
  body: Record<string, unknown>;
} {
  if (params.callMode === "worker") {
    const body: Record<string, unknown> = {
      model: params.effectiveModel,
      messages: params.messages,
      endpoint: "responses",
      use_worker_config: params.useWorkerToml,
      worker_target: params.workerTarget ?? "local",
    };
    const token = params.workerAccessToken.trim();
    if (token) body.access_token = token;
    const email = params.workerTestEmail?.trim();
    const password = params.workerTestPassword;
    if (email) body.email = email;
    if (password) body.password = password;
    return { url: "/api/worker-chat", body };
  }
  return {
    url: "/api/chat",
    body: {
      model: params.effectiveModel,
      messages: params.messages,
      gateway: params.gateway || undefined,
      provider_slug: params.providerSlug || undefined,
    },
  };
}
