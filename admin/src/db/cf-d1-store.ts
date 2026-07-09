import { getDb } from "./connection";
import { hashPayload, markMissingByAccount, parseJson } from "./store-utils";
import type { D1DatabaseRow } from "../d1-database";

export function upsertCfD1Databases(accountId: string, databases: D1DatabaseRow[], now = Date.now()): void {
  const db = getDb();
  db.exec("BEGIN");
  try {
    for (const database of databases) upsertCfD1Database(accountId, database, now);
    markMissingByAccount("cf_d1_databases", accountId, databases.map((d) => d.id));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function upsertCfD1Database(accountId: string, database: D1DatabaseRow, now = Date.now()): void {
  const payload = JSON.stringify(database);
  getDb()
    .prepare(
      `INSERT INTO cf_d1_databases
        (account_id, id, name, version, created_at_text, payload_json, payload_hash,
         first_seen_at, last_seen_at, last_synced_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(account_id, id) DO UPDATE SET
         name = excluded.name,
         version = excluded.version,
         created_at_text = excluded.created_at_text,
         payload_json = excluded.payload_json,
         payload_hash = excluded.payload_hash,
         last_seen_at = excluded.last_seen_at,
         last_synced_at = excluded.last_synced_at,
         deleted_at = NULL`,
    )
    .run(
      accountId,
      database.id,
      database.name,
      database.version ?? null,
      database.created_at ?? null,
      payload,
      hashPayload(database),
      now,
      now,
      now,
    );
}

export function listCfD1Databases(accountId: string): D1DatabaseRow[] {
  const rows = getDb()
    .prepare(
      `SELECT payload_json FROM cf_d1_databases
       WHERE account_id = ? AND deleted_at IS NULL
       ORDER BY name ASC`,
    )
    .all(accountId) as Array<{ payload_json: string }>;
  return rows
    .map((row) => parseJson<D1DatabaseRow>(row.payload_json, { id: "", name: "" }))
    .filter((d) => d.id && d.name);
}

export function cfD1LastSyncedAt(accountId: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT MAX(last_synced_at) AS at FROM cf_d1_databases
       WHERE account_id = ? AND deleted_at IS NULL`,
    )
    .get(accountId) as { at: number | null } | undefined;
  return row?.at ?? null;
}

