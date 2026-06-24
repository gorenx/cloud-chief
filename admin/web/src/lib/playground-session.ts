export type DebugTab = "gateway" | "worker";
export type ChatPath = "gateway" | "worker";
export type WorkerConfigSource = "worker" | "ui";
import {
  parseWorkerEndpoint,
  WORKER_ENDPOINT_LOCAL,
  WORKER_ENDPOINT_WORKERS_DEV,
  type WorkerEndpointKind,
  type WorkerEndpointOption,
} from "@admin/worker-endpoints";
import { CHAT_API_PATH, normalizeGatewayPathSuffix, RESPONSES_API_PATH } from "@admin/gateway-paths";

export type { WorkerEndpointKind, WorkerEndpointOption };
export { parseWorkerEndpoint, WORKER_ENDPOINT_LOCAL, WORKER_ENDPOINT_WORKERS_DEV };

/** Playground 选中的 Worker 基址：local | workers_dev | custom:hostname（兼容 online） */
export type WorkerTarget = string;

export const DEBUG_TAB_KEY = "admin-playground-active-tab";
export const WORKER_ENDPOINT_KEY = "admin-playground-worker-endpoint";

export interface WorkerCapabilities {
  uses_gateway: boolean;
  uses_model: boolean;
  supports_chat: boolean;
}

export function readWorkerEndpoint(): WorkerTarget {
  try {
    const v = localStorage.getItem(WORKER_ENDPOINT_KEY);
    if (v) return parseWorkerEndpoint(v);
  } catch {
    /* ignore */
  }
  return WORKER_ENDPOINT_LOCAL;
}

export const GATEWAY_API_PATH_KEY = "admin-playground-gateway-api-path";

export function readGatewayApiPath(): string {
  try {
    return localStorage.getItem(GATEWAY_API_PATH_KEY) ?? "";
  } catch {
    return "";
  }
}

export function persistGatewayApiPath(path: string) {
  try {
    if (path) localStorage.setItem(GATEWAY_API_PATH_KEY, path);
    else localStorage.removeItem(GATEWAY_API_PATH_KEY);
  } catch {
    /* ignore */
  }
}

export function persistWorkerEndpoint(endpoint: WorkerTarget) {
  try {
    localStorage.setItem(WORKER_ENDPOINT_KEY, parseWorkerEndpoint(endpoint));
  } catch {
    /* ignore */
  }
}

export function readDebugTab(): DebugTab {
  try {
    const v = localStorage.getItem(DEBUG_TAB_KEY);
    if (v === "gateway" || v === "worker") return v;
    if (v === "chat") {
      localStorage.setItem(DEBUG_TAB_KEY, "gateway");
      return "gateway";
    }
  } catch {
    /* ignore */
  }
  return "gateway";
}

export function resolveInspectTarget(tab: DebugTab): "gateway" | "worker" {
  return tab === "worker" ? "worker" : "gateway";
}

export function resolveRequestPath(tab: DebugTab): ChatPath {
  return tab === "worker" ? "worker" : "gateway";
}

export function resolveWorkerDisplayUrl(
  worker: {
    local_url?: string;
    online_url?: string | null;
    url: string;
    url_endpoints?: import("@admin/worker-endpoints").WorkerEndpointOption[];
  } | null,
  endpointId: WorkerTarget,
): string {
  if (!worker) return "";
  const id = parseWorkerEndpoint(endpointId);
  const match = worker.url_endpoints?.find((e) => e.id === id);
  if (match) return match.url;
  if (id === WORKER_ENDPOINT_WORKERS_DEV) return worker.online_url ?? worker.url;
  if (id === WORKER_ENDPOINT_LOCAL) return worker.local_url ?? worker.url;
  return worker.url;
}

export interface PlaygroundConfigSlice {
  model: string;
  provider_slug?: string;
  worker_routing?: {
    gateway: string;
    default_model: string | null;
    free_model: string | null;
    plus_model: string | null;
  };
}

export interface PlaygroundSessionFlags {
  useWorkerToml: boolean;
  modelLocked: boolean;
  gatewayLocked: boolean;
  workerModelEnforced: boolean;
  hideGatewayModel: boolean;
  supportsChat: boolean;
}

function autoShowGatewayModel(caps: WorkerCapabilities | null): boolean {
  if (!caps) return false;
  return caps.uses_gateway || caps.uses_model;
}

/** Worker 是否具备网关/模型 wrangler 变量（决定是否渲染该控件区） */
export function workerHasGatewayModelVars(caps: WorkerCapabilities | null): boolean {
  return autoShowGatewayModel(caps);
}

/** 是否展示网关 / 模型控件（Worker 路径：按 wrangler vars 自动判断） */
export function resolveShowGatewayModelControls(
  inspectTarget: "gateway" | "worker",
  caps: WorkerCapabilities | null,
): boolean {
  if (inspectTarget === "gateway") return true;
  return autoShowGatewayModel(caps);
}

export function deriveSessionFlags(
  inspectTarget: "gateway" | "worker",
  workerConfigSource: WorkerConfigSource,
  caps: WorkerCapabilities | null,
): PlaygroundSessionFlags {
  const showGatewayModel = resolveShowGatewayModelControls(inspectTarget, caps);
  const supportsChat = caps?.supports_chat ?? false;

  if (inspectTarget === "gateway") {
    return {
      useWorkerToml: false,
      modelLocked: false,
      gatewayLocked: false,
      workerModelEnforced: false,
      hideGatewayModel: false,
      supportsChat: true,
    };
  }

  if (!showGatewayModel) {
    return {
      useWorkerToml: false,
      modelLocked: false,
      gatewayLocked: false,
      workerModelEnforced: false,
      hideGatewayModel: true,
      supportsChat,
    };
  }

  const useWorkerToml = workerConfigSource === "worker";
  return {
    useWorkerToml,
    modelLocked: false,
    gatewayLocked: useWorkerToml,
    workerModelEnforced: supportsChat,
    hideGatewayModel: false,
    supportsChat,
  };
}

export function resolveWorkerTierModels(
  config: Pick<PlaygroundConfigSlice, "worker_routing"> | null,
): { free: string; plus: string } | null {
  const wr = config?.worker_routing;
  if (!wr) return null;
  const free = wr.free_model ?? wr.default_model;
  const plus = wr.plus_model ?? free;
  if (!free && !plus) return null;
  return { free: free ?? "", plus: plus ?? free ?? "" };
}

export function resolveEffectiveModel(
  config: PlaygroundConfigSlice | null,
  uiModel: string,
  flags: Pick<PlaygroundSessionFlags, "useWorkerToml">,
): string {
  if (uiModel.trim()) return uiModel.trim();
  if (flags.useWorkerToml) {
    return config?.worker_routing?.default_model ?? config?.model ?? "";
  }
  return config?.model ?? "";
}

export function resolveEffectiveGateway(
  config: PlaygroundConfigSlice | null,
  uiGateway: string,
  useWorkerToml: boolean,
): string {
  if (useWorkerToml) return config?.worker_routing?.gateway ?? uiGateway;
  return uiGateway;
}

export function isResponsesGatewayPath(path?: string): boolean {
  const normalized = normalizeGatewayPathSuffix(path ?? "");
  return normalized.endsWith(RESPONSES_API_PATH);
}

export interface ChatRequestParams {
  path: ChatPath;
  effectiveModel: string;
  messages: Array<{ role: string; content: string }>;
  gateway?: string;
  providerSlug?: string;
  gatewayApiPath?: string;
  previousResponseId?: string | null;
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
    const apiPath =
      normalizeGatewayPathSuffix(params.gatewayApiPath ?? CHAT_API_PATH) || CHAT_API_PATH;
    const body: Record<string, unknown> = {
      model: params.effectiveModel,
      messages: params.messages,
      gateway: params.gateway || undefined,
      provider_slug: params.providerSlug || undefined,
      path: apiPath,
    };
    if (isResponsesGatewayPath(apiPath) && params.previousResponseId) {
      body.previous_response_id = params.previousResponseId;
    }
    return { url: "/api/chat", body };
  }

  const body: Record<string, unknown> = {
    model: params.effectiveModel,
    messages: params.messages,
    endpoint: "chat",
    use_worker_config: params.useWorkerToml,
    worker_target: parseWorkerEndpoint(params.workerTarget ?? WORKER_ENDPOINT_LOCAL),
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
