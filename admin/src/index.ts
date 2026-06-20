import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./env";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hasWebDist = fs.existsSync(path.join(adminRoot, "web", "dist", "index.html"));
const isDev = process.env.ADMIN_DEV === "1";

serve({ fetch: app.fetch, port: env.PORT, hostname: env.ADMIN_BIND }, (info) => {
  const host = env.ADMIN_BIND === "0.0.0.0" ? "localhost" : env.ADMIN_BIND;
  console.log(`✅ API 已启动: http://${host}:${info.port}`);
  console.log(`   聊天界面: http://${host}:${info.port}/`);
  if (isDev) {
    console.log("   配置后台: http://localhost:5173/  （Vite 开发；API 代理至本端口）");
  } else if (hasWebDist) {
    console.log(`   配置后台: http://${host}:${info.port}/`);
  } else {
    console.log(`   配置后台: 未构建，请先运行 ./admin.sh build → http://${host}:${info.port}/`);
  }
  if (env.ADMIN_BIND !== "127.0.0.1") {
    console.log(`   ⚠️  绑定地址为 ${env.ADMIN_BIND}（非仅本机），确保 ADMIN_TOKEN 足够强`);
  }
  if (!env.ADMIN_TOKEN) {
    console.log("   ⚠️  未配置 ADMIN_TOKEN，/admin/* 管理接口将拒绝所有请求");
  }
  if (!env.CF_API_TOKEN) {
    console.log("   ⚠️  未配置 CF_API_TOKEN，无法管理 Cloudflare 资源");
  }
});
