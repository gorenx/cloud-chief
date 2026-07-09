import { getDb } from "./connection";
import { hashPayload, markMissingByAccount, parseJson } from "./store-utils";
import type { CfDeployedWorker } from "../cf-worker-resolve";

export function upsertCfWorkers(accountId: string, workers: CfDeployedWorker[], now = Date.now()): void {
  const db = getDb();
  const insertWorker = db.prepare(
    `INSERT INTO cf_workers
      (account_id, name, workers_dev_url, subdomain_enabled, compatibility_date, usage_model,
       vars_json, secret_names_json, payload_json, payload_hash,
       first_seen_at, last_seen_at, last_synced_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(account_id, name) DO UPDATE SET
       workers_dev_url = excluded.workers_dev_url,
       subdomain_enabled = excluded.subdomain_enabled,
       compatibility_date = excluded.compatibility_date,
       usage_model = excluded.usage_model,
       vars_json = excluded.vars_json,
       secret_names_json = excluded.secret_names_json,
       payload_json = excluded.payload_json,
       payload_hash = excluded.payload_hash,
       last_seen_at = excluded.last_seen_at,
       last_synced_at = excluded.last_synced_at,
       deleted_at = NULL`,
  );
  db.exec("BEGIN");
  try {
    for (const worker of workers) {
      upsertCfWorkerWithStatement(insertWorker, accountId, worker, now);
    }
    markMissingByAccount("cf_workers", accountId, workers.map((w) => w.name), "name");
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function upsertCfWorker(accountId: string, worker: CfDeployedWorker, now = Date.now()): void {
  const insertWorker = getDb().prepare(
    `INSERT INTO cf_workers
      (account_id, name, workers_dev_url, subdomain_enabled, compatibility_date, usage_model,
       vars_json, secret_names_json, payload_json, payload_hash,
       first_seen_at, last_seen_at, last_synced_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(account_id, name) DO UPDATE SET
       workers_dev_url = excluded.workers_dev_url,
       subdomain_enabled = excluded.subdomain_enabled,
       compatibility_date = excluded.compatibility_date,
       usage_model = excluded.usage_model,
       vars_json = excluded.vars_json,
       secret_names_json = excluded.secret_names_json,
       payload_json = excluded.payload_json,
       payload_hash = excluded.payload_hash,
       last_seen_at = excluded.last_seen_at,
       last_synced_at = excluded.last_synced_at,
       deleted_at = NULL`,
  );
  upsertCfWorkerWithStatement(insertWorker, accountId, worker, now);
}

function upsertCfWorkerWithStatement(
  statement: ReturnType<ReturnType<typeof getDb>["prepare"]>,
  accountId: string,
  worker: CfDeployedWorker,
  now: number,
): void {
  const payload = JSON.stringify(worker);
  statement.run(
    accountId,
    worker.name,
    worker.url,
    worker.subdomain_enabled ? 1 : 0,
    worker.compatibility_date,
    worker.usage_model,
    JSON.stringify(worker.vars ?? {}),
    JSON.stringify(worker.secret_names ?? []),
    payload,
    hashPayload(worker),
    now,
    now,
    now,
  );
}

export function listCfWorkers(accountId: string): CfDeployedWorker[] {
  const rows = getDb()
    .prepare(
      `SELECT payload_json FROM cf_workers
       WHERE account_id = ? AND deleted_at IS NULL
       ORDER BY name ASC`,
    )
    .all(accountId) as Array<{ payload_json: string }>;
  return rows
    .map((row) =>
      parseJson<CfDeployedWorker>(row.payload_json, {
        name: "",
        url: null,
        subdomain_enabled: false,
        vars: {},
        secret_names: [],
        compatibility_date: null,
        usage_model: null,
      }),
    )
    .filter((w) => w.name);
}

export function getCfWorker(accountId: string, name: string): CfDeployedWorker | null {
  const row = getDb()
    .prepare(
      `SELECT payload_json FROM cf_workers
       WHERE account_id = ? AND name = ? AND deleted_at IS NULL`,
    )
    .get(accountId, name) as { payload_json: string } | undefined;
  if (!row) return null;
  const worker = parseJson<CfDeployedWorker>(row.payload_json, {
    name: "",
    url: null,
    subdomain_enabled: false,
    vars: {},
    secret_names: [],
    compatibility_date: null,
    usage_model: null,
  });
  return worker.name ? worker : null;
}

export function cfWorkersLastSyncedAt(accountId: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT MAX(last_synced_at) AS at FROM cf_workers
       WHERE account_id = ? AND deleted_at IS NULL`,
    )
    .get(accountId) as { at: number | null } | undefined;
  return row?.at ?? null;
}

export function upsertCfWorkerDomains(
  accountId: string,
  scriptName: string,
  hostnames: string[],
  now = Date.now(),
): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO cf_worker_domains (account_id, script_name, hostname, last_seen_at, deleted_at)
     VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(account_id, script_name, hostname) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       deleted_at = NULL`,
  );
  db.exec("BEGIN");
  try {
    for (const hostname of hostnames) insert.run(accountId, scriptName, hostname, now);
    const placeholders = hostnames.map(() => "?").join(", ");
    db.prepare(
      `UPDATE cf_worker_domains
       SET deleted_at = COALESCE(deleted_at, ?)
       WHERE account_id = ? AND script_name = ?
         ${hostnames.length ? `AND hostname NOT IN (${placeholders})` : ""}
         AND deleted_at IS NULL`,
    ).run(now, accountId, scriptName, ...hostnames);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function listCfWorkerDomains(accountId: string, scriptName: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT hostname FROM cf_worker_domains
       WHERE account_id = ? AND script_name = ? AND deleted_at IS NULL
       ORDER BY hostname ASC`,
    )
    .all(accountId, scriptName) as Array<{ hostname: string }>;
  return rows.map((row) => row.hostname);
}
