import { createHash } from "node:crypto";
import { getDb } from "./connection";

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function markMissingByAccount(
  table: string,
  accountId: string,
  seenIds: string[],
  idColumn = "id",
  extraWhere = "",
  extraParams: Array<string | number | null> = [],
): void {
  const placeholders = seenIds.map(() => "?").join(", ");
  const sql = `
    UPDATE ${table}
    SET deleted_at = COALESCE(deleted_at, ?)
    WHERE account_id = ?
      ${extraWhere}
      ${seenIds.length ? `AND ${idColumn} NOT IN (${placeholders})` : ""}
      AND deleted_at IS NULL
  `;
  getDb().prepare(sql).run(Date.now(), accountId, ...extraParams, ...seenIds);
}
