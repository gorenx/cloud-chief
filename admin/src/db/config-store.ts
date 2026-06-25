import { getDb } from "./connection";
import { decryptValue, encryptValue, isDbEncryptionEnabled } from "./crypto";

export function getConfigValue(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM app_config WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (!row) return null;
  try {
    return decryptValue(row.value);
  } catch {
    return null;
  }
}

export function setConfigValue(key: string, value: string): void {
  const stored = encryptValue(value);
  getDb()
    .prepare(
      `INSERT INTO app_config (key, value, encrypted, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         encrypted = excluded.encrypted,
         updated_at = excluded.updated_at`,
    )
    .run(key, stored, isDbEncryptionEnabled() ? 1 : 0, Date.now());
}

export function deleteConfigValue(key: string): void {
  getDb().prepare("DELETE FROM app_config WHERE key = ?").run(key);
}

export function hasConfigValue(key: string): boolean {
  return getConfigValue(key) !== null;
}

export function listConfigKeys(): string[] {
  const rows = getDb().prepare("SELECT key FROM app_config ORDER BY key").all() as Array<{
    key: string;
  }>;
  return rows.map((r) => r.key);
}
