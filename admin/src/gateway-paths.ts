import { gatewayUrlWithAccount } from "./gateway-url";

/** Gateway `custom-{slug}/` 后的路径；前缀（如 /compatible-mode/v1）在 CF 提供商 base_url */
export const CHAT_API_PATH = "/chat/completions";
export const RESPONSES_API_PATH = "/responses";

export type GatewayPathKind = "chat" | "responses" | "custom";

export interface GatewayPathEntry {
  id: string;
  kind: GatewayPathKind;
  label: string;
  suffix: string;
  invoke_url: string;
  /** provider.base_url + suffix（展示用） */
  upstream_preview?: string;
}

/** 兼容旧字段：routing.path / invoke_url 默认指向 Responses */
export const PRIMARY_GATEWAY_PATH_ID = "responses";

export function normalizeGatewayPathSuffix(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.startsWith("/") ? t : `/${t}`;
}

/** 解析 admin/.env `GATEWAY_CUSTOM_PATHS`（逗号分隔） */
export function parseGatewayCustomPaths(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const suffix = normalizeGatewayPathSuffix(part);
    if (suffix && !seen.has(suffix)) {
      seen.add(suffix);
      out.push(suffix);
    }
  }
  return out;
}

export function joinProviderUpstreamUrl(baseUrl: string, suffix: string): string {
  return baseUrl.replace(/\/+$/, "") + suffix;
}

export function buildGatewayPathEntries(opts: {
  accountId: string;
  gatewayId: string;
  providerSlug: string;
  providerBaseUrl?: string;
  chatSuffix?: string;
  responsesSuffix?: string;
  customSuffixes?: string[];
}): GatewayPathEntry[] {
  const {
    accountId,
    gatewayId,
    providerSlug,
    providerBaseUrl,
    chatSuffix = CHAT_API_PATH,
    responsesSuffix = RESPONSES_API_PATH,
    customSuffixes = [],
  } = opts;
  if (!accountId || !gatewayId || !providerSlug) return [];

  const builtins: Array<{
    id: string;
    kind: GatewayPathKind;
    label: string;
    suffix: string;
  }> = [
    {
      id: "chat",
      kind: "chat",
      label: "Chat Completions",
      suffix: normalizeGatewayPathSuffix(chatSuffix) || CHAT_API_PATH,
    },
    {
      id: "responses",
      kind: "responses",
      label: "Responses",
      suffix: normalizeGatewayPathSuffix(responsesSuffix) || RESPONSES_API_PATH,
    },
  ];

  const entries: GatewayPathEntry[] = builtins.map((b) => {
    const invoke_url = gatewayUrlWithAccount(accountId, gatewayId, providerSlug, b.suffix);
    return {
      ...b,
      invoke_url,
      upstream_preview: providerBaseUrl
        ? joinProviderUpstreamUrl(providerBaseUrl, b.suffix)
        : undefined,
    };
  });

  customSuffixes.forEach((suffix, i) => {
    entries.push({
      id: `custom-${i}`,
      kind: "custom",
      label: suffix,
      suffix,
      invoke_url: gatewayUrlWithAccount(accountId, gatewayId, providerSlug, suffix),
      upstream_preview: providerBaseUrl
        ? joinProviderUpstreamUrl(providerBaseUrl, suffix)
        : undefined,
    });
  });

  return entries;
}

export function primaryGatewayPath(entries: GatewayPathEntry[]): GatewayPathEntry | null {
  return entries.find((e) => e.id === PRIMARY_GATEWAY_PATH_ID) ?? entries[0] ?? null;
}
