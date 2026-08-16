# ai-gateway-proxy

[English](README.md) | 简体中文

处理模型生产流量的 Cloudflare Worker。它验证用户 JWT，通过 `@cloud-chief/gateway-core` 执行权益和配额策略，选择服务端权威模型，再经 Cloudflare AI Gateway 转发 Chat Completions 或 Responses 请求。

转发边界按 provider 组织，但当前内置适配仍使用 DashScope 命名的 Secret 和兼容路径。在引入 provider-neutral adapter contract 之前，这些名称属于当前实现细节。

API 参考见 [`API.zh-CN.md`](API.zh-CN.md)，客户端集成见 [`../doc/ai-gateway-worker.zh-CN.md`](../doc/ai-gateway-worker.zh-CN.md)。

## 路由

- `GET /health`：公开健康检查。
- `POST /v1/chat/completions`：需鉴权的 Chat Completions 代理。
- `POST /v1/responses`：需鉴权的 Responses 代理。

## 开发与部署

```bash
cp .dev.vars.example .dev.vars
pnpm install
pnpm dev
pnpm test
pnpm deploy
```

普通运行时变量写入 `wrangler.toml`。Gateway 凭据、当前适配使用的 `DASHSCOPE_API_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 必须使用 Secret；仅旧版 HS256 项目需要 `SUPABASE_JWT_SECRET`。

RevenueCat 同步由 [`../worker-revenuecat/`](../worker-revenuecat/) 负责；本 Worker 只读取同步后的权益状态。
