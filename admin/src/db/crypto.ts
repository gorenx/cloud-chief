import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "../env";

const PREFIX = "enc:v1:";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "admin-db-salt", 32);
}

export function isDbEncryptionEnabled(): boolean {
  return env.ADMIN_DB_ENCRYPT;
}

export function encryptValue(plain: string): string {
  if (!isDbEncryptionEnabled()) return plain;
  const key = deriveKey(env.ADMIN_DB_ENCRYPTION_KEY);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, enc]).toString("base64url")}`;
}

export function decryptValue(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  if (!isDbEncryptionEnabled()) {
    throw new Error("数据库含加密配置，请设置 ADMIN_DB_ENCRYPT=1 与 ADMIN_DB_ENCRYPTION_KEY");
  }
  const key = deriveKey(env.ADMIN_DB_ENCRYPTION_KEY);
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = scryptSync(password, salt, 64);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function hashSessionToken(token: string): string {
  return scryptSync(token, "admin-session", 32).toString("hex");
}
