# revenuecat-proxy

[English](README.md) | 简体中文

将 RevenueCat 凭据保留在服务端的 Cloudflare Worker。它提供用户范围的订阅读取、管理员指标、客户端触发的权益对账，以及将结果写入 Supabase `user_entitlements` 的 RevenueCat Webhook。

API 参考见 [`../doc/worker-revenuecat.zh-CN.md`](../doc/worker-revenuecat.zh-CN.md)。

## 开发与部署

```bash
cp .dev.vars.example .dev.vars
pnpm install
pnpm dev
pnpm test
pnpm deploy
```

RevenueCat API Key、Webhook Secret 和 Supabase service-role key 必须配置为 Worker Secret。`ALLOWED_SUBS` 只控制管理员指标，不限制普通用户路由。

RevenueCat `app_user_id` 必须等于 Supabase JWT `sub`，以便统一校验订阅归属。
