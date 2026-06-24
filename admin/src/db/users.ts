import { getDb } from "./connection";
import { verifyPassword } from "./crypto";

export type DbUser = {
  id: number;
  username: string;
  created_at: number;
};

export function findUserByUsername(username: string): (DbUser & { password_hash: string }) | null {
  const row = getDb()
    .prepare("SELECT id, username, password_hash, created_at FROM users WHERE username = ? COLLATE NOCASE")
    .get(username.trim()) as (DbUser & { password_hash: string }) | undefined;
  return row ?? null;
}

export function findUserById(id: number): DbUser | null {
  const row = getDb()
    .prepare("SELECT id, username, created_at FROM users WHERE id = ?")
    .get(id) as DbUser | undefined;
  return row ?? null;
}

export function authenticateUser(username: string, password: string): DbUser | null {
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, username: user.username, created_at: user.created_at };
}

export function countUsers(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}
