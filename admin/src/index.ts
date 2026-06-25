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
  console.log(`✅ API 已启动: http://${host}:${info.port}`);
  console.log(`   聊天界面: http://${host}:${info.port}/`);
  if (isDev) {
    console.log(`   配置后台: ${devWebOrigin}/login  （Vite 开发；API 代理至本端口）`);
  } else if (hasWebDist) {
    console.log(`   配置后台: http://${host}:${info.port}/login`);
  } else {
    console.log(`   配置后台: 未构建，请先运行 ./admin.sh build → http://${host}:${info.port}/`);
  }
  if (env.ADMIN_BIND !== "127.0.0.1") {
    console.log(`   ⚠️  绑定地址为 ${env.ADMIN_BIND}（非仅本机），确保 ADMIN_TOKEN 足够强`);
  }
  console.log(`   SQLite: ${env.ADMIN_DB_PATH || "data/admin.db"}（加密: ${env.ADMIN_DB_ENCRYPT ? "开" : "关"}）`);
  console.log("   默认管理员: admin / 123456（首次初始化，请尽快修改密码）");
  if (!env.ADMIN_TOKEN) {
    console.log("   提示: 未配置 ADMIN_TOKEN，管理接口使用登录 session 鉴权");
  }
  if (!env.CF_API_TOKEN) {
    console.log("   ⚠️  未配置 CF_API_TOKEN，无法管理 Cloudflare 资源");
  }
});
