export type DebugTab = "chat" | "gateway" | "worker";
export type ChatPath = "gateway" | "worker";
export type WorkerConfigSource = "worker" | "ui";
export type WorkerTarget = "local" | "online";

export const DEBUG_TAB_KEY = "admin-playground-active-tab";
export const CHAT_PATH_KEY = "admin-playground-chat-path";

export function readDebugTab(): DebugTab {
  try {
    const v = localStorage.getItem(DEBUG_TAB_KEY);
    if (v === "chat" || v === "gateway" || v === "worker") return v;
  } catch {
    /* ignore */
  }
  return "chat";
}

export function readChatPath(): ChatPath {
  try {
    const v = localStorage.getItem(CHAT_PATH_KEY);
    if (v === "gateway" || v === "worker") return v;
  } catch {
    /* ignore */
  }
  return "gateway";
}

export function resolveInspectTarget(tab: DebugTab, chatPath: ChatPath): "gateway" | "worker" {
  if (tab === "gateway") return "gateway";
  if (tab === "worker") return "worker";
  return chatPath;
}

export function resolveRequestPath(tab: DebugTab, chatPath: ChatPath): ChatPath {
  if (tab === "gateway") return "gateway";
  if (tab === "worker") return "worker";
  return chatPath;
}

/** 按切换目标解析展示 / 请求用的 Worker URL */
export function resolveWorkerDisplayUrl(
  worker: { local_url?: string; online_url?: string | null; url: string } | null,
  target: WorkerTarget,
): string {
  if (!worker) return "";
  if (target === "online" && worker.online_url) return worker.online_url;
  return worker.local_url ?? worker.url;
}

export interface PlaygroundConfigSlice {
  model: string;
  provider_slug?: string;
  worker_routing?: { gateway: string; default_model: string | null };
}

export interface PlaygroundSessionFlags {
  useWorkerToml: boolean;
  modelLocked: boolean;
  gatewayLocked: boolean;
}

export function deriveSessionFlags(
  inspectTarget: "gateway" | "worker",
  workerConfigSource: WorkerConfigSource,
): PlaygroundSessionFlags {
  if (inspectTarget === "gateway") {
    return { useWorkerToml: false, modelLocked: false, gatewayLocked: false };
  }
  const useWorkerToml = workerConfigSource === "worker";
  return {
    useWorkerToml,
    modelLocked: useWorkerToml,
    gatewayLocked: useWorkerToml,
  };
}

export function resolveEffectiveModel(
  config: PlaygroundConfigSlice | null,
  uiModel: string,
  useWorkerToml: boolean,
): string {
  if (useWorkerToml) return config?.worker_routing?.default_model ?? "";
  return uiModel;
}

export function resolveEffectiveGateway(
  config: PlaygroundConfigSlice | null,
  uiGateway: string,
  useWorkerToml: boolean,
): string {
  if (useWorkerToml) return config?.worker_routing?.gateway ?? uiGateway;
  return uiGateway;
}

export interface ChatRequestParams {
  path: ChatPath;
  effectiveModel: string;
  messages: Array<{ role: string; content: string }>;
  gateway?: string;
  providerSlug?: string;
  workerAccessToken?: string;
  workerTestEmail?: string;
  workerTestPassword?: string;
  workerTarget?: WorkerTarget;
  workerDir?: string;
  useWorkerToml: boolean;
}

export function buildChatRequest(params: ChatRequestParams): {
  url: string;
  body: Record<string, unknown>;
} {
  if (params.path === "gateway") {
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

  const body: Record<string, unknown> = {
    model: params.effectiveModel,
    messages: params.messages,
    endpoint: "responses",
    use_worker_config: params.useWorkerToml,
    worker_target: params.workerTarget ?? "local",
  };
  if (params.workerDir?.trim()) body.worker_dir = params.workerDir.trim();
  const token = params.workerAccessToken?.trim();
  if (token) body.access_token = token;
  const email = params.workerTestEmail?.trim();
  const password = params.workerTestPassword;
  if (email) body.email = email;
  if (password) body.password = password;
  return { url: "/api/worker-chat", body };
}
