import { serve } from "@hono/node-server";
import { app } from "./app";
import { env } from "./env";

serve({ fetch: app.fetch, port: env.PORT, hostname: env.ADMIN_BIND }, (info) => {
  const host = env.ADMIN_BIND === "0.0.0.0" ? "localhost" : env.ADMIN_BIND;
  console.log(`✅ 配置服务已启动: http://${host}:${info.port}`);
  console.log(`   聊天界面: http://${host}:${info.port}/`);
  console.log(`   配置后台: http://${host}:${info.port}/config.html`);
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
