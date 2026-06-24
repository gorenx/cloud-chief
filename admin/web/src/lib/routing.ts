import type { PublicConfig, RoutingInfo } from "@/types";
import { buildInvokeUrl } from "@/lib/api";

export function invokeUrlForGateway(
  config: PublicConfig,
  gateway: string,
  pathSuffix?: string,
): string {
  const accountId = config.worker_routing?.account_id ?? "";
  const slug = config.provider_slug;
  const suffix = pathSuffix ?? config.routing?.path ?? config.path;
  if (accountId && gateway && slug && suffix) {
    return buildInvokeUrl(accountId, gateway, slug, suffix);
  }
  const base = config.routing?.invoke_url ?? config.routing_preview;
  if (!base || !gateway) return "";
  if (gateway === config.gateway && !pathSuffix) return base;
  let url =
    gateway === config.gateway
      ? base
      : base.replace(/\/([^/]+)\/custom-/, `/${gateway}/custom-`);
  if (pathSuffix) {
    url = url.replace(/(\/custom-[^/]+)(\/.*)?$/, `$1${suffix}`);
  }
  return url;
}

export function playgroundRouting(
  config: PublicConfig,
  gateway: string,
  model: string,
  pathSuffix?: string,
): RoutingInfo {
  const base = config.routing ?? {
    model: config.model,
    worker_model: null,
    provider_slug: config.provider_slug,
    provider: null,
    path: config.path,
    invoke_url: config.routing_preview,
    api_type: "responses" as const,
    base_url: config.base_url,
  };
  const path = pathSuffix ?? base.path;
  return {
    ...base,
    model,
    path,
    invoke_url: invokeUrlForGateway(config, gateway, path),
  };
}
