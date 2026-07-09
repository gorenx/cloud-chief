import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db/connection";
import { decryptValue, encryptValue, isDbEncryptionEnabled } from "./db/crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(here, "..");
export const supabaseOAuthStorePath = path.join(adminRoot, ".supabase-oauth.json");

export interface SupabaseOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
}

function readLegacySupabaseOAuthTokens(): SupabaseOAuthTokens | null {
  try {
    const raw = fs.readFileSync(supabaseOAuthStorePath, "utf8");
    const j = JSON.parse(raw) as SupabaseOAuthTokens;
    if (!j.access_token || !j.refresh_token) return null;
    return j;
  } catch {
    return null;
  }
}

function removeLegacyStore(): void {
  try {
    fs.unlinkSync(supabaseOAuthStorePath);
  } catch {
    /* absent */
  }
}

export function readSupabaseOAuthTokens(): SupabaseOAuthTokens | null {
  const row = getDb()
    .prepare(
      `SELECT access_token, refresh_token, token_type, expires_at
       FROM oauth_tokens
       WHERE provider = 'supabase'`,
    )
    .get() as
    | {
        access_token: string;
        refresh_token: string;
        token_type: string | null;
        expires_at: number;
      }
    | undefined;

  if (row) {
    try {
      return {
        access_token: decryptValue(row.access_token),
        refresh_token: decryptValue(row.refresh_token),
        expires_at: row.expires_at,
        token_type: row.token_type ?? undefined,
      };
    } catch {
      return null;
    }
  }

  const legacy = readLegacySupabaseOAuthTokens();
  if (!legacy) return null;
  writeSupabaseOAuthTokens(legacy);
  removeLegacyStore();
  return legacy;
}

export function writeSupabaseOAuthTokens(tokens: SupabaseOAuthTokens): void {
  getDb()
    .prepare(
      `INSERT INTO oauth_tokens
        (provider, access_token, refresh_token, token_type, expires_at, encrypted, updated_at)
       VALUES ('supabase', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         token_type = excluded.token_type,
         expires_at = excluded.expires_at,
         encrypted = excluded.encrypted,
         updated_at = excluded.updated_at`,
    )
    .run(
      encryptValue(tokens.access_token),
      encryptValue(tokens.refresh_token),
      tokens.token_type ?? null,
      tokens.expires_at,
      isDbEncryptionEnabled() ? 1 : 0,
      Date.now(),
    );
  removeLegacyStore();
}

export function clearSupabaseOAuthTokens(): void {
  getDb().prepare("DELETE FROM oauth_tokens WHERE provider = 'supabase'").run();
  removeLegacyStore();
}
