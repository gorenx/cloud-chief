import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env";
import { listModels, ensureModelCatalog } from "./model-catalog";
import { buildRouting, buildWorkerRouting } from "./routing";
import { configMeta, patchWorkerRuntimeMeta } from "./field-meta";
import { loadCfLists, pickDefaultGateway, pickDefaultProvider, RESPONSES_API_PATH } from "./cf-resolve";
import { buildWorkerDebugInfo } from "./worker-debug";
import { getWorkerRuntimeConfig } from "./worker-runtime";
import { admin } from "./routes/admin";
import { deploy } from "./routes/deploy";
import { chat } from "./routes/chat";
import { workerChat } from "./routes/worker-chat";
import { supabaseConnect } from "./routes/supabase-connect";

const here = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(here, "..");
const webDist = path.join(adminRoot, "web", "dist");

export function createApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/config", async (c) => {
    const { gateways, providers } = await loadCfLists();
    const defaultGw = pickDefaultGateway(gateways);
    const defaultProvider = pickDefaultProvider(providers);
    const gatewayId = defaultGw?.id ?? "";
    const runtime = await getWorkerRuntimeConfig();
    const routing = buildRouting(
      gatewayId,
      defaultProvider,
      undefined,
      runtime.vars.DEFAULT_MODEL ?? null,
    );
    const workerRouting = buildWorkerRouting(providers, runtime.vars);
    const catalogSync = ensureModelCatalog([
      env.MODEL,
      workerRouting.default_model ?? "",
    ]);

    return c.json({
      model: env.MODEL,
      gateway: gatewayId,
      gateways: gateways.map((g) => g.id),
      provider_slug: defaultProvider?.slug ?? "",
      base_url: defaultProvider?.base_url ?? "",
      path: RESPONSES_API_PATH,
      models: listModels(),
      catalog_synced: catalogSync.added,
      routing,
      routing_preview: routing.invoke_url,
      worker_routing: workerRouting,
      worker: buildWorkerDebugInfo(runtime),
      _meta: patchWorkerRuntimeMeta(configMeta(), runtime),
    });
  });

  app.route("/api/chat", chat);
  app.route("/api/worker-chat", workerChat);
  app.route("/admin/supabase", supabaseConnect);
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
