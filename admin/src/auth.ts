import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * admin 令牌中间件：要求 Authorization: Bearer <ADMIN_TOKEN>。
 * 未配置 ADMIN_TOKEN 时直接拒绝（503），避免管理接口裸奔。
 */
export const adminAuth = createMiddleware(async (c, next) => {
  if (!env.ADMIN_TOKEN) {
    return c.json(
      { error: "管理接口未启用：请在 admin/.env 设置 ADMIN_TOKEN 后重启服务" },
      503,
    );
  }
  const auth = c.req.header("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m || !safeEqual(m[1].trim(), env.ADMIN_TOKEN)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});
