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

const SCHEMA = `
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

export function initDatabase(): DatabaseSync {
  if (db) return db;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
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
