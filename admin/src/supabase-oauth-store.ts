import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(here, "..");
export const supabaseOAuthStorePath = path.join(adminRoot, ".supabase-oauth.json");

export interface SupabaseOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
}

export function readSupabaseOAuthTokens(): SupabaseOAuthTokens | null {
  if (process.env.VITEST) return null;
  try {
    const raw = fs.readFileSync(supabaseOAuthStorePath, "utf8");
    const j = JSON.parse(raw) as SupabaseOAuthTokens;
    if (!j.access_token || !j.refresh_token) return null;
    return j;
  } catch {
    return null;
  }
}

export function writeSupabaseOAuthTokens(tokens: SupabaseOAuthTokens): void {
  if (process.env.VITEST) return;
  fs.writeFileSync(supabaseOAuthStorePath, `${JSON.stringify(tokens, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function clearSupabaseOAuthTokens(): void {
  if (process.env.VITEST) return;
  try {
    fs.unlinkSync(supabaseOAuthStorePath);
  } catch {
    /* absent */
  }
}
