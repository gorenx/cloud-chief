import { randomBytes } from "node:crypto";
import { getDb } from "./connection";
import { hashSessionToken } from "./crypto";
import type { DbUser } from "./users";
import { findUserById } from "./users";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = Pick<DbUser, "id" | "username">;

export function createSession(userId: number): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString("hex");
  const id = hashSessionToken(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  getDb()
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(id, userId, expiresAt, now);
  return { token, expiresAt };
}

export function deleteSession(token: string): void {
  getDb()
    .prepare("DELETE FROM sessions WHERE id = ?")
    .run(hashSessionToken(token));
}

export function resolveSessionUser(token: string): SessionUser | null {
  const id = hashSessionToken(token);
  const row = getDb()
    .prepare(
      `SELECT s.expires_at, u.id, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(id) as { expires_at: number; id: number; username: string } | undefined;

  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  return { id: row.id, username: row.username };
}

export function purgeExpiredSessions(): void {
  getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}
