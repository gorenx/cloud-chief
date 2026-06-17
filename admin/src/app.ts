import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env";
import { cfApi } from "./cf";
import { listModels } from "./model-catalog";
import { buildRouting } from "./routing";
import { admin } from "./routes/admin";
import { deploy } from "./routes/deploy";
import { chat } from "./routes/chat";

const here = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(here, "..");
const webDist = path.join(adminRoot, "web", "dist");

export function createApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/config", async (c) => {
    let gateways: string[] = [];
    let providers: Array<{ slug: string; base_url: string; enable?: boolean }> = [];
    if (env.CF_API_TOKEN) {
      const [gwRes, provRes] = await Promise.all([
        cfApi("GET", "/ai-gateway/gateways?per_page=50"),
        cfApi("GET", "/ai-gateway/custom-providers?per_page=100"),
      ]);
      if (gwRes.json.success && Array.isArray(gwRes.json.result)) {
        gateways = (gwRes.json.result as Array<{ id?: string }>)
          .map((g) => g.id)
          .filter((id): id is string => typeof id === "string");
      }
      if (provRes.json.success && Array.isArray(provRes.json.result)) {
        providers = provRes.json.result as typeof providers;
      }
    }
    if (env.CF_GATEWAY_ID && !gateways.includes(env.CF_GATEWAY_ID)) {
      gateways.unshift(env.CF_GATEWAY_ID);
    }

    const routing = buildRouting(env.CF_GATEWAY_ID, providers);

    return c.json({
      model: env.MODEL,
      gateway: env.CF_GATEWAY_ID,
      gateways,
      provider_slug: env.PROVIDER_SLUG,
      base_url: env.PROVIDER_BASE_URL,
      path: env.PROVIDER_PATH,
      models: listModels(),
      routing,
      routing_preview: routing.invoke_url,
    });
  });

  app.route("/api/chat", chat);
  app.route("/admin/worker", deploy);
  app.route("/admin", admin);

  const hasWebDist = fs.existsSync(path.join(webDist, "index.html"));

  if (hasWebDist) {
    app.use("/*", serveStatic({ root: webDist }));
    app.get("*", (c) => {
      const p = c.req.path;
      if (p.startsWith("/admin") || p.startsWith("/api") || p === "/config" || p === "/health") {
        return c.notFound();
      }
      return c.html(fs.readFileSync(path.join(webDist, "index.html"), "utf8"));
    });
  } else {
    app.get("/", serveStatic({ path: "./public/index.html" }));
    app.get("/index.html", serveStatic({ path: "./public/index.html" }));
    app.get("/config.html", serveStatic({ path: "./public/config.html" }));
  }

  return app;
}

export const app = createApp();
