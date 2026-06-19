import {
  createRemoteJWKSet,
  jwtVerify,
  decodeProtectedHeader,
  type JWTPayload,
} from "jose";
import type { Env } from "./types";
import { JWT_AUDIENCE as DEFAULT_JWT_AUDIENCE } from "@cloud-chief/gateway-core";

// jose 的 createRemoteJWKSet 自带缓存与密钥轮换处理；按 JWKS URL 复用实例。
let cached: { url: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null;

function jwksFor(url: string) {
  if (!cached || cached.url !== url) {
    cached = { url, set: createRemoteJWKSet(new URL(url)) };
  }
  return cached.set;
}

/**
 * 校验 Supabase 用户 access_token。
 * - 新项目（默认）：非对称 ES256/RS256，走 JWKS 公钥验签，无需任何密钥。
 * - 旧项目：HS256 共享密钥，需要 env.SUPABASE_JWT_SECRET。
 */
export async function verifySupabaseJWT(token: string, env: Env): Promise<JWTPayload> {
  const issuer = `${env.SUPABASE_URL}/auth/v1`;
  const audience = env.JWT_AUDIENCE?.trim() || DEFAULT_JWT_AUDIENCE;
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
