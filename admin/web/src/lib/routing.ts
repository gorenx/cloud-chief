import type { PublicConfig, RoutingInfo } from "@/types";

export function invokeUrlForGateway(config: PublicConfig, gateway: string): string {
  const base = config.routing?.invoke_url ?? config.routing_preview;
  if (!base || !gateway) return "";
  if (gateway === config.gateway) return base;
  return base.replace(/\/([^/]+)\/custom-/, `/${gateway}/custom-`);
}

export function playgroundRouting(
  config: PublicConfig,
  gateway: string,
  model: string,
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
  return {
    ...base,
    model,
    invoke_url: invokeUrlForGateway(config, gateway),
  };
}
