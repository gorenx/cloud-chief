import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { env } from "../env";
import { hashPassword } from "./crypto";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultDbPath = path.join(adminRoot, "data", "admin.db");
const legacyConfigPath = path.join(adminRoot, "gateway-api-paths.json");

let db: DatabaseSync | null = null;

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gateway_api_paths (
  gateway_id TEXT NOT NULL,
  provider_slug TEXT NOT NULL,
  chat_suffix TEXT NOT NULL,
  responses_suffix TEXT NOT NULL,
  custom_paths TEXT NOT NULL,
  PRIMARY KEY (gateway_id, provider_slug)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`;

const MIGRATIONS: Array<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: "local_resource_snapshots",
    sql: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  error TEXT,
  stats_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_scope ON sync_runs(source, scope, finished_at);
CREATE INDEX IF NOT EXISTS idx_sync_events_run ON sync_events(run_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_resource ON sync_events(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS cf_gateways (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  authentication INTEGER,
  collect_logs INTEGER,
  is_default INTEGER,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE IF NOT EXISTS cf_providers (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT,
  base_url TEXT,
  enabled INTEGER,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id),
  UNIQUE (account_id, slug)
);

CREATE TABLE IF NOT EXISTS cf_provider_configs (
  account_id TEXT NOT NULL,
  gateway_id TEXT NOT NULL,
  id TEXT NOT NULL,
  provider_slug TEXT,
  alias TEXT,
  default_config INTEGER,
  secret_present INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, gateway_id, id)
);

CREATE TABLE IF NOT EXISTS cf_d1_databases (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT,
  created_at_text TEXT,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE IF NOT EXISTS cf_workers (
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  workers_dev_url TEXT,
  subdomain_enabled INTEGER,
  compatibility_date TEXT,
  usage_model TEXT,
  vars_json TEXT NOT NULL DEFAULT '{}',
  secret_names_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, name)
);

CREATE TABLE IF NOT EXISTS cf_worker_domains (
  account_id TEXT NOT NULL,
  script_name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, script_name, hostname)
);

CREATE TABLE IF NOT EXISTS worker_projects (
  id TEXT PRIMARY KEY,
  root_rel TEXT NOT NULL,
  abs_dir TEXT NOT NULL,
  script_name TEXT,
  compatibility_date TEXT,
  toml_hash TEXT,
  dev_vars_hash TEXT,
  last_scanned_at INTEGER NOT NULL,
  missing INTEGER NOT NULL DEFAULT 0,
  UNIQUE (abs_dir)
);

CREATE TABLE IF NOT EXISTS worker_project_vars (
  project_id TEXT NOT NULL REFERENCES worker_projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wrangler',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, key)
);

CREATE TABLE IF NOT EXISTS worker_project_d1_bindings (
  project_id TEXT NOT NULL REFERENCES worker_projects(id) ON DELETE CASCADE,
  binding TEXT NOT NULL,
  database_name TEXT NOT NULL,
  database_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, binding)
);

CREATE TABLE IF NOT EXISTS worker_project_secret_names (
  project_id TEXT NOT NULL REFERENCES worker_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  value_hash TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, name, source)
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT,
  expires_at INTEGER NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS supabase_projects (
  ref TEXT PRIMARY KEY,
  name TEXT,
  organization_id TEXT,
  region TEXT,
  status TEXT,
  payload_json TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER
);
`,
  },
];

export function resolveDbPath(): string {
  const configured = env.ADMIN_DB_PATH.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(adminRoot, configured);
  }
  return defaultDbPath;
}

function seedDefaultAdmin(database: DatabaseSync): void {
  const row = database.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (row.n > 0) return;
  const now = Date.now();
  database
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run("admin", hashPassword("123456"), now);
}

function migrateGatewayPathsFromJson(database: DatabaseSync): void {
  const count = (
    database.prepare("SELECT COUNT(*) AS n FROM gateway_api_paths").get() as { n: number }
  ).n;
  if (count > 0 || !fs.existsSync(legacyConfigPath)) return;

  try {
    const raw = fs.readFileSync(legacyConfigPath, "utf8");
    const parsed = JSON.parse(raw) as {
      records?: Array<{
        gateway_id: string;
        provider_slug: string;
        chat_suffix: string;
        responses_suffix: string;
        custom_paths: string[];
      }>;
    };
    if (!Array.isArray(parsed.records)) return;

    const insert = database.prepare(`
      INSERT OR IGNORE INTO gateway_api_paths
        (gateway_id, provider_slug, chat_suffix, responses_suffix, custom_paths)
      VALUES (?, ?, ?, ?, ?)
    `);
    database.exec("BEGIN");
    try {
      for (const r of parsed.records ?? []) {
        insert.run(
          r.gateway_id,
          r.provider_slug,
          r.chat_suffix,
          r.responses_suffix,
          JSON.stringify(r.custom_paths ?? []),
        );
      }
      database.exec("COMMIT");
    } catch (e) {
      database.exec("ROLLBACK");
      throw e;
    }
  } catch {
    /* ignore corrupt legacy file */
  }
}

function ensureMigrationTable(database: DatabaseSync): void {
  database.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
`);
}

function applySchemaMigrations(database: DatabaseSync): void {
  ensureMigrationTable(database);
  const rows = database.prepare("SELECT version FROM schema_migrations").all() as Array<{
    version: number;
  }>;
  const applied = new Set(rows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    database.exec("BEGIN");
    try {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, Date.now());
      database.exec("COMMIT");
    } catch (e) {
      database.exec("ROLLBACK");
      throw e;
    }
  }
}

export function initDatabase(): DatabaseSync {
  if (db) return db;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  try {
    fs.chmodSync(dbPath, 0o600);
  } catch {
    /* best effort */
  }
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(BASE_SCHEMA);
  applySchemaMigrations(db);
  seedDefaultAdmin(db);
  migrateGatewayPathsFromJson(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!db) return initDatabase();
  return db;
}

/** @internal test helper */
export function closeDatabase(): void {
  db?.close();
  db = null;
}

/** @internal test helper */
export function legacyConfigFilePath(): string {
  return legacyConfigPath;
}
