import { randomUUID } from "node:crypto";
import { getDb } from "./connection";

export type SyncSource = "cloudflare" | "supabase" | "worker_fs";
export type SyncRunStatus = "running" | "success" | "partial" | "failed";
export type SyncMetaSource = "live" | "local_snapshot" | "none";

export interface SyncMeta {
  source: SyncMetaSource;
  stale: boolean;
  last_synced_at: number | null;
  error: string | null;
  run_id?: string;
}

export interface SyncRunRow {
  id: string;
  source: SyncSource;
  scope: string;
  status: SyncRunStatus;
  started_at: number;
  finished_at: number | null;
  error: string | null;
  stats_json: string;
}

export interface SyncEventRow {
  id: number;
  run_id: string | null;
  resource_type: string;
  resource_id: string;
  action: string;
  status: "success" | "failed" | "skipped";
  message: string | null;
  created_at: number;
}

export interface SyncEventInput {
  run_id?: string | null;
  resource_type: string;
  resource_id: string;
  action: string;
  status: "success" | "failed" | "skipped";
  message?: string | null;
}

export function startSyncRun(source: SyncSource, scope: string): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO sync_runs (id, source, scope, status, started_at, stats_json)
       VALUES (?, ?, ?, 'running', ?, '{}')`,
    )
    .run(id, source, scope, Date.now());
  return id;
}

export function finishSyncRun(
  id: string,
  status: Exclude<SyncRunStatus, "running">,
  options: { error?: string | null; stats?: Record<string, unknown> } = {},
): void {
  getDb()
    .prepare(
      `UPDATE sync_runs
       SET status = ?, finished_at = ?, error = ?, stats_json = ?
       WHERE id = ?`,
    )
    .run(status, Date.now(), options.error ?? null, JSON.stringify(options.stats ?? {}), id);
}

export function recordSyncEvent(input: SyncEventInput): void {
  getDb()
    .prepare(
      `INSERT INTO sync_events
        (run_id, resource_type, resource_id, action, status, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.run_id ?? null,
      input.resource_type,
      input.resource_id,
      input.action,
      input.status,
      input.message ?? null,
      Date.now(),
    );
}

export function latestSyncRun(source: SyncSource, scope: string): SyncRunRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, source, scope, status, started_at, finished_at, error, stats_json
       FROM sync_runs
       WHERE source = ? AND scope = ?
       ORDER BY COALESCE(finished_at, started_at) DESC
       LIMIT 1`,
    )
    .get(source, scope) as SyncRunRow | undefined;
  return row ?? null;
}

export function syncMeta(params: {
  source: SyncMetaSource;
  lastSyncedAt: number | null;
  ttlMs?: number;
  error?: string | null;
  runId?: string | null;
}): SyncMeta {
  return {
    source: params.source,
    stale:
      params.lastSyncedAt === null
        ? params.source !== "none"
        : params.ttlMs !== undefined && Date.now() - params.lastSyncedAt > params.ttlMs,
    last_synced_at: params.lastSyncedAt,
    error: params.error ?? null,
    ...(params.runId ? { run_id: params.runId } : {}),
  };
}

export function latestSyncMeta(
  source: SyncSource,
  scope: string,
  ttlMs: number,
  fallbackSource: SyncMetaSource = "local_snapshot",
): SyncMeta {
  const latest = latestSyncRun(source, scope);
  return syncMeta({
    source: latest ? fallbackSource : "none",
    lastSyncedAt: latest?.finished_at ?? null,
    ttlMs,
    error: latest?.status === "failed" ? latest.error : null,
    runId: latest?.id ?? null,
  });
}

export function listLatestSyncRuns(): SyncRunRow[] {
  return getDb()
    .prepare(
      `SELECT r.id, r.source, r.scope, r.status, r.started_at, r.finished_at, r.error, r.stats_json
       FROM sync_runs r
       JOIN (
         SELECT source, scope, MAX(COALESCE(finished_at, started_at)) AS latest_at
         FROM sync_runs
         GROUP BY source, scope
       ) latest
         ON latest.source = r.source
        AND latest.scope = r.scope
        AND latest.latest_at = COALESCE(r.finished_at, r.started_at)
       ORDER BY r.source, r.scope`,
    )
    .all() as unknown as SyncRunRow[];
}

export function getSyncRun(id: string): SyncRunRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, source, scope, status, started_at, finished_at, error, stats_json
       FROM sync_runs
       WHERE id = ?`,
    )
    .get(id) as SyncRunRow | undefined;
  return row ?? null;
}

export function listSyncEventsForRun(runId: string): SyncEventRow[] {
  return getDb()
    .prepare(
      `SELECT id, run_id, resource_type, resource_id, action, status, message, created_at
       FROM sync_events
       WHERE run_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .all(runId) as unknown as SyncEventRow[];
}
