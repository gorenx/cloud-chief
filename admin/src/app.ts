import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { env } from "./env";
import { cfApi } from "./cf";
import { admin } from "./routes/admin";
import { deploy } from "./routes/deploy";
import { chat } from "./routes/chat";

export function createApp(): Hono {
  const app = new Hono();

  // 聊天界面读取的运行时配置（含可选网关列表，供前端下拉选择）
  app.get("/config", async (c) => {
    let gateways: string[] = [];
    if (env.CF_API_TOKEN) {
      const r = await cfApi("GET", "/ai-gateway/gateways?per_page=50");
      if (r.json.success && Array.isArray(r.json.result)) {
        gateways = (r.json.result as Array<{ id?: string }>)
          .map((g) => g.id)
          .filter((id): id is string => typeof id === "string");
      }
    }
    if (env.CF_GATEWAY_ID && !gateways.includes(env.CF_GATEWAY_ID)) {
      gateways.unshift(env.CF_GATEWAY_ID);
    }
    return c.json({
      model: env.MODEL,
      gateway: env.CF_GATEWAY_ID,
      gateways,
      provider_slug: env.PROVIDER_SLUG,
    });
  });

  // 业务路由（注意：更具体的 /admin/worker 必须在 /admin 之前注册）
  app.route("/api/chat", chat);
  app.route("/admin/worker", deploy);
  app.route("/admin", admin);

  // 静态页面（相对 cwd=admin/）
  app.get("/", serveStatic({ path: "./public/index.html" }));
  app.get("/index.html", serveStatic({ path: "./public/index.html" }));
  app.get("/config.html", serveStatic({ path: "./public/config.html" }));

  return app;
}

export const app = createApp();
