import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { resolveSessionUser } from "./db/sessions";

export const SESSION_COOKIE = "admin_session";

type AuthContext = Parameters<typeof getCookie>[0];

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function bearerToken(c: AuthContext): string | null {
  const auth = c.req.header("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function resolveAdminUser(c: AuthContext): { id: number; username: string } | null {
  const session = getCookie(c, SESSION_COOKIE);
  if (session) {
    const user = resolveSessionUser(session);
    if (user) return user;
  }
  return null;
}

/**
 * 管理接口鉴权：优先校验登录 session cookie，其次兼容 ADMIN_TOKEN Bearer。
 */
export const adminAuth = createMiddleware(async (c, next) => {
  if (resolveAdminUser(c)) {
    await next();
    return;
  }

  const token = bearerToken(c);
  if (env.ADMIN_TOKEN && token && safeEqual(token, env.ADMIN_TOKEN)) {
    await next();
    return;
  }

  return c.json({ error: "unauthorized" }, 401);
});
