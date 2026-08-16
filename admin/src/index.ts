import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { app } from "./app";
import { env, startEnvWatcher } from "./env";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hasWebDist = fs.existsSync(path.join(adminRoot, "web", "dist", "index.html"));
const isDev = process.env.ADMIN_DEV === "1";
const devWebOrigin = env.ADMIN_WEB_ORIGIN.trim() || "http://localhost:5173";

startEnvWatcher();

serve({ fetch: app.fetch, port: env.PORT, hostname: env.ADMIN_BIND }, (info) => {
  const host = env.ADMIN_BIND === "0.0.0.0" ? "localhost" : env.ADMIN_BIND;
  console.log(`✅ API started: http://${host}:${info.port}`);
  console.log(`   Chat UI: http://${host}:${info.port}/`);
  if (isDev) {
    console.log(`   Admin UI: ${devWebOrigin}/login  (Vite dev server; API proxied to this port)`);
  } else if (hasWebDist) {
    console.log(`   Admin UI: http://${host}:${info.port}/login`);
  } else {
    console.log(`   Admin UI: not built; run ./admin.sh build first → http://${host}:${info.port}/`);
  }
  if (env.ADMIN_BIND !== "127.0.0.1") {
    console.log(`   ⚠️  Bound to ${env.ADMIN_BIND}, not loopback only; use a strong ADMIN_TOKEN`);
  }
  console.log(`   SQLite: ${env.ADMIN_DB_PATH || "data/admin.db"} (encryption: ${env.ADMIN_DB_ENCRYPT ? "enabled" : "disabled"})`);
  console.log("   Default admin: admin / 123456 (change the password after first setup)");
  if (!env.ADMIN_TOKEN) {
    console.log("   Note: ADMIN_TOKEN is not set; Admin API access uses the login session");
  }
  if (!env.CF_API_TOKEN) {
    console.log("   ⚠️  CF_API_TOKEN is not set; Cloudflare resources cannot be managed");
  }
});
