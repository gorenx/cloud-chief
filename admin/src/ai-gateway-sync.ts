import { cfApi } from "./cf";
import { env } from "./env";
import { gatewayContextMeta } from "./field-meta";
import { loadCfLists, pickDefaultProvider } from "./cf-resolve";
import { buildRouting, modelMetaFor } from "./routing";
import {
  cfGatewayLastSyncedAt,
  cfProviderConfigsLastSyncedAt,
  getCfGateway,
  listCfProviderConfigs,
  upsertCfGateway,
  upsertCfProviderConfigs,
  type ProviderConfigSnapshot,
} from "./db/resource-store";
import {
  finishSyncRun,
  recordSyncEvent,
  startSyncRun,
  syncMeta,
  type SyncMeta,
} from "./db/sync-store";

const AI_GATEWAY_TTL_MS = 60_000;

export async function getGatewayContextCached(
  id: string,
  options: { refresh?: boolean } = {},
): Promise<{
  gateway: unknown;
  gateway_error: unknown;
  routing: ReturnType<typeof buildRouting>;
  keys: ProviderConfigSnapshot[];
  keys_error: unknown;
  model_meta: ReturnType<typeof modelMetaFor>;
  _meta: ReturnType<typeof gatewayContextMeta>;
  _sync: {
    gateway: SyncMeta;
    keys: SyncMeta;
  };
}> {
  const accountId = env.CF_ACCOUNT_ID;
  const refresh = Boolean(options.refresh);
  const cachedGateway = getCfGateway(accountId, id);
  const gatewayLast = cfGatewayLastSyncedAt(accountId, id);
  const keysLast = cfProviderConfigsLastSyncedAt(accountId, id);
  const cachedKeys = listCfProviderConfigs(accountId, id);
  const loadLists = await loadCfLists({ refresh });
  const providers = loadLists.providers;

  let gateway: unknown = cachedGateway;
  let gatewayError: unknown = null;
  let keys = cachedKeys;
  let keysError: unknown = null;
  const refreshGateway =
    refresh || !cachedGateway || !gatewayLast || Date.now() - gatewayLast > AI_GATEWAY_TTL_MS;
  const refreshKeys =
    refresh || !keysLast || Date.now() - keysLast > AI_GATEWAY_TTL_MS;
  const runId = refreshGateway || refreshKeys ? startSyncRun("cloudflare", `gateway_context:${id}`) : null;

  if (env.CF_API_TOKEN && refreshGateway) {
    const gwRes = await cfApi("GET", `/ai-gateway/gateways/${id}`);
    if (gwRes.json.success) {
      gateway = gwRes.json.result;
      if (gateway && typeof gateway === "object" && "id" in gateway) {
        upsertCfGateway(accountId, gateway as { id: string });
      }
      recordGatewayContextEvent(runId, "cf_gateway", id, "success");
    } else {
      gatewayError = gwRes.json.errors;
      recordGatewayContextEvent(runId, "cf_gateway", id, "failed", stringifyError(gwRes));
    }
  } else if (!env.CF_API_TOKEN && refreshGateway) {
    gatewayError = "未配置 CF_API_TOKEN";
  }

  if (env.CF_API_TOKEN && refreshKeys) {
    const keysRes = await cfApi("GET", `/ai-gateway/gateways/${id}/provider_configs?per_page=100`);
    if (keysRes.json.success) {
      keys = Array.isArray(keysRes.json.result)
        ? (keysRes.json.result as ProviderConfigSnapshot[])
        : [];
      upsertCfProviderConfigs(accountId, id, keys);
      recordGatewayContextEvent(runId, "cf_provider_configs", id, "success", `${keys.length} keys`);
    } else {
      keysError = keysRes.json.errors;
      recordGatewayContextEvent(runId, "cf_provider_configs", id, "failed", stringifyError(keysRes));
    }
  } else if (!env.CF_API_TOKEN && refreshKeys) {
    keysError = "未配置 CF_API_TOKEN";
  }

  if (runId) {
    finishSyncRun(runId, gatewayError || keysError ? "partial" : "success", {
      error: gatewayError || keysError ? JSON.stringify(gatewayError ?? keysError) : null,
      stats: { keys: keys.length },
    });
  }

  const provider = pickDefaultProvider(providers);
  const routing = buildRouting(id, provider);

  return {
    gateway,
    gateway_error: gatewayError,
    routing,
    keys,
    keys_error: keysError,
    model_meta: modelMetaFor(routing.model),
    _meta: gatewayContextMeta(id),
    _sync: {
      gateway: syncMeta({
        source: gatewayError
          ? cachedGateway
            ? "local_snapshot"
            : "none"
          : runId && refreshGateway
            ? "live"
            : cachedGateway
              ? "local_snapshot"
              : "none",
        lastSyncedAt: runId && refreshGateway && !gatewayError ? Date.now() : gatewayLast,
        ttlMs: AI_GATEWAY_TTL_MS,
        error: gatewayError ? JSON.stringify(gatewayError) : null,
        runId,
      }),
      keys: syncMeta({
        source: keysError
          ? cachedKeys.length
            ? "local_snapshot"
            : "none"
          : runId && refreshKeys
            ? "live"
            : cachedKeys.length
              ? "local_snapshot"
              : "none",
        lastSyncedAt: runId && refreshKeys && !keysError ? Date.now() : keysLast,
        ttlMs: AI_GATEWAY_TTL_MS,
        error: keysError ? JSON.stringify(keysError) : null,
        runId,
      }),
    },
  };
}

export async function listProviderConfigsCached(
  gatewayId: string,
  options: { refresh?: boolean } = {},
): Promise<{ result: ProviderConfigSnapshot[]; errors?: unknown; _sync: SyncMeta }> {
  const accountId = env.CF_ACCOUNT_ID;
  const cached = listCfProviderConfigs(accountId, gatewayId);
  const lastSyncedAt = cfProviderConfigsLastSyncedAt(accountId, gatewayId);

  if (!env.CF_API_TOKEN) {
    return {
      result: cached,
      errors: "未配置 CF_API_TOKEN",
      _sync: syncMeta({
        source: cached.length ? "local_snapshot" : "none",
        lastSyncedAt,
        ttlMs: AI_GATEWAY_TTL_MS,
        error: "未配置 CF_API_TOKEN",
      }),
    };
  }

  if (!options.refresh && lastSyncedAt !== null && Date.now() - lastSyncedAt <= AI_GATEWAY_TTL_MS) {
    return {
      result: cached,
      _sync: syncMeta({ source: "local_snapshot", lastSyncedAt, ttlMs: AI_GATEWAY_TTL_MS }),
    };
  }

  const res = await cfApi("GET", `/ai-gateway/gateways/${gatewayId}/provider_configs?per_page=100`);
  if (res.json.success) {
    const rows = Array.isArray(res.json.result) ? (res.json.result as ProviderConfigSnapshot[]) : [];
    upsertCfProviderConfigs(accountId, gatewayId, rows);
    return {
      result: rows,
      _sync: syncMeta({ source: "live", lastSyncedAt: Date.now(), ttlMs: AI_GATEWAY_TTL_MS }),
    };
  }

  return {
    result: cached,
    errors: res.json.errors,
    _sync: syncMeta({
      source: cached.length ? "local_snapshot" : "none",
      lastSyncedAt,
      ttlMs: AI_GATEWAY_TTL_MS,
      error: stringifyError(res),
    }),
  };
}

function recordGatewayContextEvent(
  runId: string | null,
  resourceType: string,
  resourceId: string,
  status: "success" | "failed",
  message?: string,
): void {
  if (!runId) return;
  recordSyncEvent({
    run_id: runId,
    resource_type: resourceType,
    resource_id: resourceId,
    action: "refresh",
    status,
    message,
  });
}

function stringifyError(res: Awaited<ReturnType<typeof cfApi>>): string {
  return JSON.stringify(res.json.errors ?? res.json.raw ?? `HTTP ${res.status}`);
}
