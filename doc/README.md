# Cloud Chief Workers API 文档

边缘 Cloudflare Workers 代理：客户端仅携带 **Supabase `access_token`**，服务端密钥（DashScope、RevenueCat、AI Gateway 等）不暴露给应用。

## 文档索引

| 文档 | Worker 部署名 | 职责 |
|------|---------------|------|
| [ai-gateway-worker/API.md](../ai-gateway-worker/API.md) | `ai-gateway-proxy` | **API 参考**（端点、错误码、SSE） |
| [ai-gateway-worker.md](./ai-gateway-worker.md) | `ai-gateway-proxy` | 调用指南（架构、集成示例） |
| [worker-revenuecat.md](./worker-revenuecat.md) | `revenuecat-proxy` | 订阅查询、权益对账、RevenueCat Webhook |

共享业务逻辑见 [`packages/gateway-core/`](../packages/gateway-core/)（JWT audience、配额策略、RevenueCat 权益镜像）。

## 架构

```
┌─────────────┐     Bearer JWT      ┌──────────────────┐
│   客户端     │ ──────────────────> │ ai-gateway-proxy │
└─────────────┘                     │  POST /v1/*      │
       │                            └────────┬─────────┘
       │                                     │ 读 user_entitlements
       │ Bearer JWT                          ▼
       │                            ┌──────────────────┐
       └──────────────────────────> │ revenuecat-proxy │
                                    │  GET /v1/me/*    │
                                    │  POST sync       │
                                    └────────┬─────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              ▼                              ▼                              ▼
     Cloudflare AI Gateway           RevenueCat REST API v2          Supabase Postgres
     → 阿里云 MaaS (DashScope)       (Secret / REST API Key)         user_entitlements
```

**协作关系**

1. RevenueCat SDK 将 `app_user_id` 设为 Supabase 用户 UUID（JWT `sub`）。
2. `POST /webhooks/revenuecat` 或 `POST /v1/sync-entitlement` 写入 Supabase `user_entitlements`。
3. AI Gateway 读取 `user_entitlements` 决定 `plus` / `free` tier 与模型、配额。

## 基址

| 环境 | AI Gateway | RevenueCat |
|------|------------|------------|
| 生产 | `https://ai-gateway-proxy.<account>.workers.dev` | `https://revenuecat-proxy.<account>.workers.dev` |
| 本地 dev | `http://127.0.0.1:8788` | `http://127.0.0.1:8789` |

## 共享认证（`/v1/*`）

| 项 | 值 |
|----|-----|
| Header | `Authorization: Bearer <supabase_access_token>` |
| Issuer | `{SUPABASE_URL}/auth/v1` |
| Audience | `authenticated`（`JWT_AUDIENCE` 可覆盖） |
| 用户 ID | JWT `sub` |

JWT 验签：默认 ES256/RS256 走 Supabase JWKS；HS256 旧项目需配置 `SUPABASE_JWT_SECRET`。

## 路由速览

### ai-gateway-proxy

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/health` | 无 |
| `POST` | `/v1/chat/completions` | Supabase JWT |
| `POST` | `/v1/responses` | Supabase JWT |

### revenuecat-proxy

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/health` | 无 |
| `POST` | `/webhooks/revenuecat` | `Bearer <REVENUECAT_WEBHOOK_SECRET>` |
| `POST` | `/v1/sync-entitlement` | Supabase JWT |
| `GET` | `/v1/me` | Supabase JWT |
| `GET` | `/v1/me/subscriptions` | Supabase JWT |
| `GET` | `/v1/me/active-entitlements` | Supabase JWT |
| `GET` | `/v1/me/subscriptions/:subscriptionId` | Supabase JWT |
| `GET` | `/v1/metrics/overview` | Supabase JWT + `ALLOWED_SUBS` 白名单 |
| `GET` | `/v1/charts/:chartName` | Supabase JWT + `ALLOWED_SUBS` 白名单 |

## 限流差异

两 Worker 均使用 Cloudflare Rate Limiting binding，默认 **60 次 / 60 秒**（见各 Worker `wrangler.toml`）。

| Worker | 限流 key | 时机 |
|--------|----------|------|
| ai-gateway-proxy | `{sub}`（无前缀） | JWT 校验通过后 |
| revenuecat-proxy | `ip:{地址}` | 进入 `/v1/*` 时（含未带 token 请求） |
| revenuecat-proxy | `sub:{uuid}` | JWT 校验通过且存在 `sub` 时 |

超限：`429`，`{ "error": "rate limit exceeded" }`。

## 错误响应约定

**JSON 路由**（Hono `HTTPException` 与业务错误）：

```json
{ "error": "描述字符串" }
```

部分路由带 `detail` 或额外字段（见各 Worker 文档）。

**Webhook**（`/webhooks/revenuecat`）：响应为**纯文本**，非 JSON。

## CORS

| Worker | 允许方法 | 允许请求头 | 暴露响应头 |
|--------|----------|------------|------------|
| ai-gateway-proxy | `GET`, `POST`, `OPTIONS` | `authorization`, `content-type`, `x-device-id` | `x-gateway-tier`, `x-gateway-used`, `x-gateway-quota` |
| revenuecat-proxy | `GET`, `POST`, `OPTIONS` | `authorization`, `content-type` | — |

## `ALLOWED_SUBS` 语义差异

| Worker | 留空时 | 非空时 |
|--------|--------|--------|
| ai-gateway-proxy | 所有已登录用户可调用 `/v1/*` | 仅白名单 UUID 可调用 |
| revenuecat-proxy | 用户路由正常；**管理员路由不可访问** | 白名单 UUID 可访问 `/v1/metrics/*`、`/v1/charts/*` |

## 源码入口

| Worker | 路由 | 鉴权 | 业务 |
|--------|------|------|------|
| ai-gateway-proxy | `ai-gateway-worker/src/index.ts` | 同文件 + `auth.ts` | `enforce.ts`, `gateway.ts` |
| revenuecat-proxy | `worker-revenuecat/src/index.ts` | 同文件 + `auth.ts` | `revenuecat.ts`, `billing.ts` |

文档与上述源码保持一致；若实现变更，请同步更新本目录。
