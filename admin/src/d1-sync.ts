import { env } from "./env";
import { listD1Databases, type D1DatabaseRow } from "./d1-database";
import {
  cfD1LastSyncedAt,
  listCfD1Databases,
  upsertCfD1Databases,
} from "./db/resource-store";
import {
  finishSyncRun,
  recordSyncEvent,
  startSyncRun,
  syncMeta,
  type SyncMeta,
} from "./db/sync-store";

const D1_TTL_MS = 120_000;

export interface D1DatabaseListResult {
  ok: boolean;
  databases: D1DatabaseRow[];
  error?: string;
  _sync: SyncMeta;
}

export async function listD1DatabasesCached(options: { refresh?: boolean } = {}): Promise<D1DatabaseListResult> {
  const accountId = env.CF_ACCOUNT_ID;
  const cached = listCfD1Databases(accountId);
  const lastSyncedAt = cfD1LastSyncedAt(accountId);
  const shouldRefresh =
    options.refresh || Boolean(process.env.VITEST) || lastSyncedAt === null || Date.now() - lastSyncedAt > D1_TTL_MS;

  if (!env.CF_API_TOKEN) {
    return {
      ok: cached.length > 0,
      databases: cached,
      error: "未配置 CF_API_TOKEN",
      _sync: syncMeta({
        source: cached.length ? "local_snapshot" : "none",
        lastSyncedAt,
        ttlMs: D1_TTL_MS,
        error: "未配置 CF_API_TOKEN",
      }),
    };
  }

  if (!shouldRefresh && cached.length > 0) {
    return {
      ok: true,
      databases: cached,
      _sync: syncMeta({ source: "local_snapshot", lastSyncedAt, ttlMs: D1_TTL_MS }),
    };
  }

  const runId = startSyncRun("cloudflare", "d1");
  const listed = await listD1Databases();
  if (!listed.ok) {
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_d1_databases",
      resource_id: accountId,
      action: "refresh",
      status: "failed",
      message: listed.error,
    });
    finishSyncRun(runId, "failed", { error: listed.error });
    return {
      ok: cached.length > 0,
      databases: cached,
      error: listed.error,
      _sync: syncMeta({
        source: cached.length ? "local_snapshot" : "none",
        lastSyncedAt,
        ttlMs: D1_TTL_MS,
        error: listed.error,
        runId,
      }),
    };
  }

  upsertCfD1Databases(accountId, listed.databases);
  recordSyncEvent({
    run_id: runId,
    resource_type: "cf_d1_databases",
    resource_id: accountId,
    action: "refresh",
    status: "success",
    message: `${listed.databases.length} databases`,
  });
  finishSyncRun(runId, "success", { stats: { count: listed.databases.length } });

  return {
    ok: true,
    databases: listed.databases,
    _sync: syncMeta({
      source: "live",
      lastSyncedAt: Date.now(),
      ttlMs: D1_TTL_MS,
      runId,
    }),
  };
}
