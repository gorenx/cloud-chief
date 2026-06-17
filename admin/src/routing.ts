import { env, workerDir } from "./env";
import { gatewayUrl, gatewayUrlWithAccount } from "./cf";
import { lookupModel } from "./model-catalog";
import { RESPONSES_API_PATH } from "./cf-resolve";
import { readWranglerToml } from "./wrangler-vars";

export interface ProviderInfo {
  id?: string;
  slug: string;
  base_url: string;
  enable?: boolean;
}

export interface RoutingInfo {
  model: string;
  worker_model: string | null;
  provider_slug: string;
  provider: ProviderInfo | null;
  path: string;
  invoke_url: string;
  api_type: "responses";
  base_url: string;
}

/** Worker 边缘代理实际使用的路由（wrangler.toml [vars] + CF 提供商匹配） */
export interface WorkerRoutingInfo {
  account_id: string;
  gateway: string;
  provider_slug: string;
  default_model: string | null;
  provider: ProviderInfo | null;
  path: string;
  invoke_url: string;
  base_url: string;
  api_type: "responses";
}

function readWorkerVars() {
  return readWranglerToml(workerDir).vars;
}

function readWorkerModel(): string | null {
  return readWorkerVars().DEFAULT_MODEL ?? null;
}

export function buildWorkerRouting(providers: ProviderInfo[]): WorkerRoutingInfo {
  const vars = readWorkerVars();
  const accountId = vars.CF_ACCOUNT_ID ?? env.CF_ACCOUNT_ID;
  const gateway = vars.CF_GATEWAY_ID ?? "";
  const slug = vars.PROVIDER_SLUG ?? "";
  const pathStr = RESPONSES_API_PATH;
  const provider = providers.find((p) => p.slug === slug) ?? null;
  const invokeUrl =
    slug && gateway && accountId
      ? gatewayUrlWithAccount(accountId, gateway, slug, pathStr)
      : "";

  return {
    account_id: accountId,
    gateway,
    provider_slug: slug,
    default_model: vars.DEFAULT_MODEL ?? null,
    provider,
    path: pathStr,
    invoke_url: invokeUrl,
    base_url: provider?.base_url ?? "",
    api_type: "responses",
  };
}

export function buildRouting(
  gatewayId: string,
  provider: ProviderInfo | null,
  modelOverride?: string,
): RoutingInfo {
  const model = modelOverride ?? env.MODEL;
  const providerSlug = provider?.slug ?? "";
  const pathStr = RESPONSES_API_PATH;
  const invokeUrl =
    providerSlug && gatewayId
      ? gatewayUrl(gatewayId, providerSlug, pathStr)
      : "";

  return {
    model,
    worker_model: readWorkerModel(),
    provider_slug: providerSlug,
    provider,
    path: pathStr,
    invoke_url: invokeUrl,
    api_type: "responses",
    base_url: provider?.base_url ?? "",
  };
}

export function modelMetaFor(modelId: string) {
  return lookupModel(modelId);
}
