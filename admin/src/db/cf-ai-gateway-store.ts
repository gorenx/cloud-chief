import { getDb } from "./connection";
import { hashPayload, markMissingByAccount, parseJson } from "./store-utils";
import type { GatewayRow } from "../cf-resolve";
import type { ProviderInfo } from "../routing";

export interface ProviderConfigSnapshot {
  id: string;
  provider_slug?: string;
  alias?: string;
  default_config?: boolean;
  secret_present?: boolean;
  [key: string]: unknown;
}

export function upsertCfGateways(accountId: string, gateways: GatewayRow[], now = Date.now()): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO cf_gateways
      (account_id, id, authentication, collect_logs, is_default, payload_json, payload_hash,
       first_seen_at, last_seen_at, last_synced_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(account_id, id) DO UPDATE SET
       authentication = excluded.authentication,
       collect_logs = excluded.collect_logs,
       is_default = excluded.is_default,
       payload_json = excluded.payload_json,
       payload_hash = excluded.payload_hash,
       last_seen_at = excluded.last_seen_at,
       last_synced_at = excluded.last_synced_at,
       deleted_at = NULL`,
  );
  db.exec("BEGIN");
  try {
    for (const gateway of gateways) upsertGatewayWithStatement(insert, accountId, gateway, now);
    markMissingByAccount("cf_gateways", accountId, gateways.map((g) => g.id));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function upsertCfGateway(accountId: string, gateway: GatewayRow, now = Date.now()): void {
  const insert = getDb().prepare(
    `INSERT INTO cf_gateways
      (account_id, id, authentication, collect_logs, is_default, payload_json, payload_hash,
       first_seen_at, last_seen_at, last_synced_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(account_id, id) DO UPDATE SET
       authentication = excluded.authentication,
       collect_logs = excluded.collect_logs,
       is_default = excluded.is_default,
       payload_json = excluded.payload_json,
       payload_hash = excluded.payload_hash,
       last_seen_at = excluded.last_seen_at,
       last_synced_at = excluded.last_synced_at,
       deleted_at = NULL`,
  );
  upsertGatewayWithStatement(insert, accountId, gateway, now);
}

function upsertGatewayWithStatement(
  statement: ReturnType<ReturnType<typeof getDb>["prepare"]>,
  accountId: string,
  gateway: GatewayRow,
  now: number,
): void {
  const payload = JSON.stringify(gateway);
  statement.run(
    accountId,
    gateway.id,
    gateway.authentication === undefined ? null : gateway.authentication ? 1 : 0,
    gateway.collect_logs === undefined ? null : gateway.collect_logs ? 1 : 0,
    gateway.is_default === undefined ? null : gateway.is_default ? 1 : 0,
    payload,
    hashPayload(gateway),
    now,
    now,
    now,
  );
}

export function listCfGateways(accountId: string): GatewayRow[] {
  const rows = getDb()
    .prepare(
      `SELECT payload_json FROM cf_gateways
       WHERE account_id = ? AND deleted_at IS NULL
       ORDER BY is_default DESC, id ASC`,
    )
    .all(accountId) as Array<{ payload_json: string }>;
  return rows.map((row) => parseJson<GatewayRow>(row.payload_json, { id: "" })).filter((g) => g.id);
}

export function getCfGateway(accountId: string, id: string): GatewayRow | null {
  const row = getDb()
    .prepare(
      `SELECT payload_json FROM cf_gateways
       WHERE account_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .get(accountId, id) as { payload_json: string } | undefined;
  if (!row) return null;
  const parsed = parseJson<GatewayRow>(row.payload_json, { id: "" });
  return parsed.id ? parsed : null;
}

export function markCfGatewayDeleted(accountId: string, id: string): void {
  getDb()
    .prepare("UPDATE cf_gateways SET deleted_at = COALESCE(deleted_at, ?) WHERE account_id = ? AND id = ?")
    .run(Date.now(), accountId, id);
}

export function cfGatewaysLastSyncedAt(accountId: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT MAX(last_synced_at) AS at FROM cf_gateways
       WHERE account_id = ? AND deleted_at IS NULL`,
    )
    .get(accountId) as { at: number | null } | undefined;
  return row?.at ?? null;
}

export function cfGatewayLastSyncedAt(accountId: string, id: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT last_synced_at AS at FROM cf_gateways
       WHERE account_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .get(accountId, id) as { at: number | null } | undefined;
  return row?.at ?? null;
}

export function upsertCfProviders(accountId: string, providers: ProviderInfo[], now = Date.now()): void {
  const db = getDb();
  db.exec("BEGIN");
  try {
    for (const provider of providers) upsertCfProvider(accountId, provider, now);
    markMissingByAccount("cf_providers", accountId, providers.map((p) => p.id || p.slug));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function upsertCfProvider(accountId: string, provider: ProviderInfo, now = Date.now()): void {
  const id = provider.id || provider.slug;
  const payload = JSON.stringify(provider);
  getDb()
    .prepare(
      `INSERT INTO cf_providers
        (account_id, id, slug, name, base_url, enabled, payload_json, payload_hash,
         first_seen_at, last_seen_at, last_synced_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(account_id, id) DO UPDATE SET
         slug = excluded.slug,
         name = excluded.name,
         base_url = excluded.base_url,
         enabled = excluded.enabled,
         payload_json = excluded.payload_json,
         payload_hash = excluded.payload_hash,
         last_seen_at = excluded.last_seen_at,
         last_synced_at = excluded.last_synced_at,
         deleted_at = NULL`,
    )
    .run(
      accountId,
      id,
      provider.slug,
      (provider as { name?: string }).name ?? null,
      provider.base_url ?? null,
      provider.enable === undefined ? null : provider.enable ? 1 : 0,
      payload,
      hashPayload(provider),
      now,
      now,
      now,
    );
}

export function markCfProviderDeleted(accountId: string, id: string): void {
  getDb()
    .prepare("UPDATE cf_providers SET deleted_at = COALESCE(deleted_at, ?) WHERE account_id = ? AND id = ?")
    .run(Date.now(), accountId, id);
}

export function listCfProviders(accountId: string): ProviderInfo[] {
  const rows = getDb()
    .prepare(
      `SELECT payload_json FROM cf_providers
       WHERE account_id = ? AND deleted_at IS NULL
       ORDER BY slug ASC`,
    )
    .all(accountId) as Array<{ payload_json: string }>;
  return rows
    .map((row) => parseJson<ProviderInfo>(row.payload_json, { slug: "", base_url: "" }))
    .filter((p) => p.slug);
}

export function cfProvidersLastSyncedAt(accountId: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT MAX(last_synced_at) AS at FROM cf_providers
       WHERE account_id = ? AND deleted_at IS NULL`,
    )
    .get(accountId) as { at: number | null } | undefined;
  return row?.at ?? null;
}

export function upsertCfProviderConfigs(
  accountId: string,
  gatewayId: string,
  configs: ProviderConfigSnapshot[],
  now = Date.now(),
): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO cf_provider_configs
      (account_id, gateway_id, id, provider_slug, alias, default_config, secret_present,
       payload_json, payload_hash, first_seen_at, last_seen_at, last_synced_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(account_id, gateway_id, id) DO UPDATE SET
       provider_slug = excluded.provider_slug,
       alias = excluded.alias,
       default_config = excluded.default_config,
       secret_present = excluded.secret_present,
       payload_json = excluded.payload_json,
       payload_hash = excluded.payload_hash,
       last_seen_at = excluded.last_seen_at,
       last_synced_at = excluded.last_synced_at,
       deleted_at = NULL`,
  );
  db.exec("BEGIN");
  try {
    for (const config of configs) {
      const payload = JSON.stringify(config);
      insert.run(
        accountId,
        gatewayId,
        config.id,
        config.provider_slug ?? null,
        config.alias ?? null,
        config.default_config === undefined ? null : config.default_config ? 1 : 0,
        config.secret_present === false ? 0 : 1,
        payload,
        hashPayload(config),
        now,
        now,
        now,
      );
    }
    markMissingByAccount(
      "cf_provider_configs",
      accountId,
      configs.map((c) => c.id),
      "id",
      "AND gateway_id = ?",
      [gatewayId],
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function listCfProviderConfigs(accountId: string, gatewayId: string): ProviderConfigSnapshot[] {
  const rows = getDb()
    .prepare(
      `SELECT payload_json FROM cf_provider_configs
       WHERE account_id = ? AND gateway_id = ? AND deleted_at IS NULL
       ORDER BY provider_slug ASC, alias ASC, id ASC`,
    )
    .all(accountId, gatewayId) as Array<{ payload_json: string }>;
  return rows
    .map((row) => parseJson<ProviderConfigSnapshot>(row.payload_json, { id: "" }))
    .filter((k) => k.id);
}

export function markCfProviderConfigDeleted(accountId: string, gatewayId: string, id: string): void {
  getDb()
    .prepare(
      `UPDATE cf_provider_configs
       SET deleted_at = COALESCE(deleted_at, ?)
       WHERE account_id = ? AND gateway_id = ? AND id = ?`,
    )
    .run(Date.now(), accountId, gatewayId, id);
}

export function cfProviderConfigsLastSyncedAt(accountId: string, gatewayId: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT MAX(last_synced_at) AS at FROM cf_provider_configs
       WHERE account_id = ? AND gateway_id = ? AND deleted_at IS NULL`,
    )
    .get(accountId, gatewayId) as { at: number | null } | undefined;
  return row?.at ?? null;
}
