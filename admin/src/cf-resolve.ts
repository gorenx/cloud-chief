import { cfApi } from "./cf";
import type { ProviderInfo } from "./routing";

/** Cloudflare 不存储；百炼 OpenAI 兼容路径 */
export const CHAT_API_PATH = "/compatible-mode/v1/chat/completions";
export const RESPONSES_API_PATH = "/compatible-mode/v1/responses";

export interface GatewayRow {
  id: string;
  authentication?: boolean;
  collect_logs?: boolean;
  is_default?: boolean;
}

export function parseGatewayList(result: unknown): GatewayRow[] {
  if (!Array.isArray(result)) return [];
  return result
    .map((g) => g as { id?: string; authentication?: boolean; collect_logs?: boolean; is_default?: boolean })
    .filter((g): g is GatewayRow => typeof g.id === "string");
}

export function parseProviderList(result: unknown): ProviderInfo[] {
  if (!Array.isArray(result)) return [];
  return result as ProviderInfo[];
}

/** 优先 CF is_default，否则首个非内置 default，否则列表第一项 */
export function pickDefaultGateway(gateways: GatewayRow[]): GatewayRow | null {
  if (gateways.length === 0) return null;
  const marked = gateways.find((g) => g.is_default);
  if (marked) return marked;
  const custom = gateways.find((g) => g.id !== "default");
  return custom ?? gateways[0];
}

/** 首个已启用的自定义提供商 */
export function pickDefaultProvider(providers: ProviderInfo[]): ProviderInfo | null {
  const enabled = providers.filter((p) => p.slug && p.enable !== false);
  if (enabled.length > 0) return enabled[0];
  return providers.find((p) => p.slug) ?? null;
}

export async function loadCfLists(): Promise<{
  gateways: GatewayRow[];
  providers: ProviderInfo[];
  gateways_error: unknown;
  providers_error: unknown;
}> {
  const [gws, provs] = await Promise.all([
    cfApi("GET", "/ai-gateway/gateways?per_page=50"),
    cfApi("GET", "/ai-gateway/custom-providers?per_page=100"),
  ]);
  return {
    gateways: gws.json.success ? parseGatewayList(gws.json.result) : [],
    providers: provs.json.success ? parseProviderList(provs.json.result) : [],
    gateways_error: gws.json.success ? null : gws.json.errors,
    providers_error: provs.json.success ? null : provs.json.errors,
  };
}

export function resolveDefaults(
  gateways: GatewayRow[],
  providers: ProviderInfo[],
  overrides?: { gatewayId?: string; providerSlug?: string },
) {
  const gw =
    (overrides?.gatewayId
      ? gateways.find((g) => g.id === overrides.gatewayId)
      : null) ?? pickDefaultGateway(gateways);
  const provider =
    (overrides?.providerSlug
      ? providers.find((p) => p.slug === overrides.providerSlug)
      : null) ?? pickDefaultProvider(providers);
  return { gateway: gw, provider };
}
