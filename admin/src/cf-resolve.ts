import { cfApi } from "./cf";
import { env } from "./env";
import {
  cfGatewaysLastSyncedAt,
  cfProvidersLastSyncedAt,
  listCfGateways,
  listCfProviders,
  upsertCfGateways,
  upsertCfProviders,
} from "./db/resource-store";
import {
  finishSyncRun,
  recordSyncEvent,
  startSyncRun,
  syncMeta,
  type SyncMeta,
} from "./db/sync-store";
import type { ProviderInfo } from "./routing";

export { CHAT_API_PATH, RESPONSES_API_PATH } from "./gateway-paths";

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

export async function loadCfLists(options: { refresh?: boolean } = {}): Promise<{
  gateways: GatewayRow[];
  providers: ProviderInfo[];
  gateways_error: unknown;
  providers_error: unknown;
  _sync: {
    gateways: SyncMeta;
    providers: SyncMeta;
  };
}> {
  return loadCfListsCached(options);
}

function cfErrorMessage(errors: unknown, fallback: string): string {
  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((e) =>
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: unknown }).message)
          : JSON.stringify(e),
      )
      .join("; ");
  }
  return fallback;
}

function shouldRefresh(lastSyncedAt: number | null, ttlMs: number, force: boolean): boolean {
  if (force) return true;
  if (lastSyncedAt === null) return true;
  return Date.now() - lastSyncedAt > ttlMs;
}

export async function loadCfListsCached(options: { refresh?: boolean } = {}): Promise<{
  gateways: GatewayRow[];
  providers: ProviderInfo[];
  gateways_error: unknown;
  providers_error: unknown;
  _sync: {
    gateways: SyncMeta;
    providers: SyncMeta;
  };
}> {
  const forceRefresh = Boolean(options.refresh) || Boolean(process.env.VITEST);
  const accountId = env.CF_ACCOUNT_ID;
  const ttlMs = 60_000;
  const cachedGateways = listCfGateways(accountId);
  const cachedProviders = listCfProviders(accountId);
  const gatewaysLast = cfGatewaysLastSyncedAt(accountId);
  const providersLast = cfProvidersLastSyncedAt(accountId);

  if (!env.CF_API_TOKEN) {
    const error = "未配置 CF_API_TOKEN";
    return {
      gateways: cachedGateways,
      providers: cachedProviders,
      gateways_error: cachedGateways.length ? error : [error],
      providers_error: cachedProviders.length ? error : [error],
      _sync: {
        gateways: syncMeta({
          source: cachedGateways.length ? "local_snapshot" : "none",
          lastSyncedAt: gatewaysLast,
          ttlMs,
          error,
        }),
        providers: syncMeta({
          source: cachedProviders.length ? "local_snapshot" : "none",
          lastSyncedAt: providersLast,
          ttlMs,
          error,
        }),
      },
    };
  }

  const refreshGateways = shouldRefresh(gatewaysLast, ttlMs, forceRefresh);
  const refreshProviders = shouldRefresh(providersLast, ttlMs, forceRefresh);
  if (!refreshGateways && !refreshProviders) {
    return {
      gateways: cachedGateways,
      providers: cachedProviders,
      gateways_error: null,
      providers_error: null,
      _sync: {
        gateways: syncMeta({ source: "local_snapshot", lastSyncedAt: gatewaysLast, ttlMs }),
        providers: syncMeta({ source: "local_snapshot", lastSyncedAt: providersLast, ttlMs }),
      },
    };
  }

  const runId = startSyncRun("cloudflare", "ai_gateway");
  const [gws, provs] = await Promise.all([
    cfApi("GET", "/ai-gateway/gateways?per_page=50"),
    cfApi("GET", "/ai-gateway/custom-providers?per_page=100"),
  ]);

  let gateways = cachedGateways;
  let providers = cachedProviders;
  let gatewaysError: unknown = null;
  let providersError: unknown = null;
  const now = Date.now();

  if (gws.json.success) {
    gateways = parseGatewayList(gws.json.result);
    upsertCfGateways(accountId, gateways, now);
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_gateways",
      resource_id: accountId,
      action: "refresh",
      status: "success",
      message: `${gateways.length} gateways`,
    });
  } else {
    gatewaysError = gws.json.errors;
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_gateways",
      resource_id: accountId,
      action: "refresh",
      status: "failed",
      message: cfErrorMessage(gws.json.errors, `Gateway 列表 HTTP ${gws.status}`),
    });
  }

  if (provs.json.success) {
    providers = parseProviderList(provs.json.result);
    upsertCfProviders(accountId, providers, now);
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_providers",
      resource_id: accountId,
      action: "refresh",
      status: "success",
      message: `${providers.length} providers`,
    });
  } else {
    providersError = provs.json.errors;
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_providers",
      resource_id: accountId,
      action: "refresh",
      status: "failed",
      message: cfErrorMessage(provs.json.errors, `Provider 列表 HTTP ${provs.status}`),
    });
  }

  const ok = gws.json.success && provs.json.success;
  finishSyncRun(runId, ok ? "success" : gws.json.success || provs.json.success ? "partial" : "failed", {
    error: ok
      ? null
      : [gatewaysError, providersError]
          .filter(Boolean)
          .map((e) => cfErrorMessage(e, "Cloudflare 同步失败"))
          .join("; "),
    stats: { gateways: gateways.length, providers: providers.length },
  });

  return {
    gateways,
    providers,
    gateways_error: gatewaysError,
    providers_error: providersError,
    _sync: {
      gateways: syncMeta({
        source: gws.json.success ? "live" : gateways.length ? "local_snapshot" : "none",
        lastSyncedAt: gws.json.success ? now : gatewaysLast,
        ttlMs,
        error: gatewaysError ? cfErrorMessage(gatewaysError, "Gateway 列表同步失败") : null,
        runId,
      }),
      providers: syncMeta({
        source: provs.json.success ? "live" : providers.length ? "local_snapshot" : "none",
        lastSyncedAt: provs.json.success ? now : providersLast,
        ttlMs,
        error: providersError ? cfErrorMessage(providersError, "Provider 列表同步失败") : null,
        runId,
      }),
    },
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
