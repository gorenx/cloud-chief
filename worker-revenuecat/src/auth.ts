import {
  createRemoteJWKSet,
  jwtVerify,
  decodeProtectedHeader,
  type JWTPayload,
} from "jose";
import type { Env } from "./types";

let cached: { url: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null;

function jwksFor(url: string) {
  if (!cached || cached.url !== url) {
    cached = { url, set: createRemoteJWKSet(new URL(url)) };
  }
  return cached.set;
}

export async function verifySupabaseJWT(token: string, env: Env): Promise<JWTPayload> {
  const issuer = `${env.SUPABASE_URL}/auth/v1`;
  const audience = env.JWT_AUDIENCE || undefined;
  const { alg } = decodeProtectedHeader(token);

  if (alg === "HS256") {
    if (!env.SUPABASE_JWT_SECRET) {
      throw new Error("received HS256 token but SUPABASE_JWT_SECRET is not configured");
    }
    const key = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, key, { issuer, audience });
    return payload;
  }

  const jwks = jwksFor(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
  const { payload } = await jwtVerify(token, jwks, { issuer, audience });
  return payload;
}

export function isAdmin(claims: JWTPayload, env: Env): boolean {
  const allow = env.ALLOWED_SUBS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (!allow.length) return false;
  return !!claims.sub && allow.includes(claims.sub);
}
