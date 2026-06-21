# revenuecat-proxy API

> 源码：`worker-revenuecat/src/index.ts`  
> 本地 dev：`http://127.0.0.1:8789`（`wrangler.toml` `[dev].port`）

边缘 RevenueCat 代理：客户端带 Supabase JWT，Worker 用服务端 **RevenueCat v2 Secret API Key** 拉取订阅数据；Webhook / sync 写入 Supabase `user_entitlements` 供 AI Gateway 读取 tier。

**前置条件**：RevenueCat SDK 中 `app_user_id` = Supabase 用户 UUID（JWT `sub`）。

Plus 权益 ID（webhook 过滤）：`wren Pro`（`gateway-core` `PLUS_ENTITLEMENT_ID`）。

---

## 路由与中间件顺序

注册顺序（`index.ts`）：

1. `GET /health` — 无鉴权
2. `POST /webhooks/revenuecat` — **不经过** `/v1/*` JWT 中间件
3. `/v1/*` JWT 中间件 — 作用于其下所有路由
4. 各 `/v1/*` 业务路由

---

## `/v1/*` 中间件

执行顺序：

1. **IP 限流**：key `ip:{cf-connecting-ip}`，fallback `x-forwarded-for` 首段，再 fallback `unknown`
2. 解析 Bearer token，缺失 → `401` `missing bearer token`
3. `verifySupabaseJWT`，失败 → `401` `invalid token`（**不含** jose 详情；详情写 Workers 日志）
4. 若存在 `sub`：**用户限流** key `sub:{uuid}`
5. 写入 claims，进入路由

> 与 ai-gateway-proxy 不同：有 IP 限流；401 为固定文案 `invalid token`。

---

## `GET /health`

| 项 | 值 |
|----|-----|
| 认证 | 无 |
| 成功 | `200`，body 纯文本 `ok` |

---

## `GET /v1/me`

当前用户的 RevenueCat 客户信息。

| 项 | 值 |
|----|-----|
| 认证 | Supabase JWT |
| 权限 | 已登录；JWT 须含 `sub`，否则 `403` `token missing sub claim` |
| 上游 | `GET /v2/projects/{RC_PROJECT_ID}/customers/{sub}` |

响应：RevenueCat v2 JSON，原样透传。

---

## `GET /v1/me/subscriptions`

当前用户订阅列表。

| 项 | 值 |
|----|-----|
| 上游 | `GET .../customers/{sub}/subscriptions` |

### 透传 Query 参数

仅以下参数会转发至 RevenueCat（`forwardQuery`）：

| 参数 | 说明 |
|------|------|
| `environment` | `production` / `sandbox` |
| `starting_after` | 分页游标 |
| `limit` | 每页条数 |

---

## `GET /v1/me/active-entitlements`

当前用户有效权益列表。

| 项 | 值 |
|----|-----|
| 上游 | `GET .../customers/{sub}/active_entitlements` |

Query 参数：同订阅列表（`environment`, `starting_after`, `limit`）。

---

## `GET /v1/me/subscriptions/:subscriptionId`

单条订阅详情，**校验归属**。

| 项 | 值 |
|----|-----|
| 上游 | `GET /v2/projects/{RC_PROJECT_ID}/subscriptions/{subscriptionId}` |
| 归属 | 若响应含 `customer_id` 或 `original_customer_id` 且不等于当前 `sub` → `403` `subscription does not belong to this user` |

---

## `GET /v1/metrics/overview`

项目订阅概览指标（管理员）。

| 项 | 值 |
|----|-----|
| 权限 | JWT `sub` 须在 `ALLOWED_SUBS` 白名单内；**白名单为空时始终 `403` `admin access required`** |
| 上游 | `GET .../metrics/overview` |

### 透传 Query

| 参数 | 说明 |
|------|------|
| `currency` | 如 `USD` |

---

## `GET /v1/charts/:chartName`

图表时序数据（管理员）。

| 项 | 值 |
|----|-----|
| 权限 | 同 metrics（`ALLOWED_SUBS` 非空白名单） |
| 上游 | `GET .../charts/{chartName}` |

`chartName` 为 RevenueCat 支持的 chart 标识（如 `mrr`、`active_subscriptions`）。

### 透传 Query

| 参数 | 说明 |
|------|------|
| `resolution` | `day` / `week` / `month` |
| `start_time` | 起始时间 |
| `end_time` | 结束时间 |
| `currency` | 如 `USD` |

---

## `POST /v1/sync-entitlement`

客户端触发的 Plus 权益对账，写入 Supabase `user_entitlements`。

| 项 | 值 |
|----|-----|
| 认证 | 经 `/v1/*` JWT 中间件 |
| 请求体 | 无 |
| 依赖 | `REVENUECAT_REST_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

### 成功 `200`

```json
{
  "is_plus": true,
  "expires_at": "2026-12-31T00:00:00.000Z",
  "product_id": "monthly_plus"
}
```

`expires_at`、`product_id` 可为 `null`（取决于 RevenueCat 状态）。

### 错误

| 状态 | Body |
|------|------|
| 403 | `{ "error": "token missing sub claim" }` |
| 500 | `{ "error": "sync_misconfigured" }` |
| 502 | `{ "error": "revenuecat_read_failed" }` |
| 500 | `{ "error": "<writeErr>" }`（Supabase 写入错误码） |

---

## `POST /webhooks/revenuecat`

RevenueCat Dashboard Webhook；**不使用 Supabase JWT**。

### 认证

Header 须**精确匹配**（大小写敏感 header 名 `Authorization`）：

```
Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
```

且须配置 `REVENUECAT_WEBHOOK_SECRET`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。

### 请求

- `Content-Type`: `application/json`
- Body：RevenueCat webhook payload，须含 `event` 对象及 `event.event_timestamp_ms`

### 处理逻辑摘要（`billing.ts`）

| 条件 | 响应 |
|------|------|
| 非 POST | `405` `method_not_allowed` |
| 认证/配置失败 | `401` `unauthorized` |
| JSON 解析失败 | `400` `bad_json` |
| 缺少 `event_timestamp_ms` | `400` `bad_event_time` |
| `event.type === "TRANSFER"` | 同步 `transferred_from` / `transferred_to` 中 UUID 用户 |
| `app_user_id` 非 UUID | `200` `ignored_non_uuid_user` |
| 非 Plus 权益事件 | `200` `ignored_other_entitlement` |
| 无法解析权益状态 | `200` `ignored_event` |
| RevenueCat REST 读取失败 | `500` `revenuecat_read_failed` |
| TRANSFER 但未配置 REST key | `500` `transfer_requires_rest_api` |
| 成功 | `200` `ok` |

幂等（`gateway-core`）：`200` `duplicate_event`、`200` `stale_event`；DB 错误 `500` `read_failed` / `write_failed`。

### Webhook URL

```
https://revenuecat-proxy.<account>.workers.dev/webhooks/revenuecat
```

> 所有 webhook 响应 body 为**纯文本**，非 JSON。

---

## 错误响应

### Hono 层（鉴权 / 授权）

| 状态 | `error` |
|------|---------|
| 401 | `missing bearer token` |
| 401 | `invalid token` |
| 403 | `token missing sub claim` |
| 403 | `admin access required` |
| 403 | `subscription does not belong to this user` |
| 429 | `rate limit exceeded` |

### RevenueCat 上游（`RevenueCatError`）

```json
{
  "error": "<message>",
  "detail": <RevenueCat 响应 body 或 null>
}
```

常见状态：上游 4xx/5xx 原样映射；Worker 侧 `504` `RevenueCat API timeout`；未配置 Secret → `500` `REVENUECAT_SECRET_API_KEY is not configured`。

### 未捕获异常

```json
{ "error": "internal error", "detail": "..." }
```

### `404`

```json
{
  "error": "not found",
  "hint": "use POST /webhooks/revenuecat, POST /v1/sync-entitlement, GET /v1/me/*"
}
```

---

## 客户端示例

```js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { session } } = await supabase.auth.getSession();
const token = session.access_token;

// 订阅列表
const subs = await fetch(
  "https://revenuecat-proxy.<account>.workers.dev/v1/me/subscriptions",
  { headers: { Authorization: `Bearer ${token}` } },
).then((r) => r.json());

// 购后对账
await fetch(
  "https://revenuecat-proxy.<account>.workers.dev/v1/sync-entitlement",
  { method: "POST", headers: { Authorization: `Bearer ${token}` } },
);
```

---

## 配置参考

### wrangler `[vars]`

| 变量 | 说明 |
|------|------|
| `RC_PROJECT_ID` | RevenueCat 项目 ID |
| `SUPABASE_URL`, `JWT_AUDIENCE` | JWT 校验 |
| `ALLOWED_SUBS` | 管理员 UUID 白名单（逗号分隔）；空 = 管理员接口不可访问 |
| `UPSTREAM_TIMEOUT_MS` | RevenueCat API 超时（默认 30000） |

### Secrets

| Secret | 用途 |
|--------|------|
| `REVENUECAT_SECRET_API_KEY` | v2 读客户/订阅/指标 |
| `REVENUECAT_REST_API_KEY` | v1 读 subscriber（webhook/sync） |
| `REVENUECAT_WEBHOOK_SECRET` | Webhook 认证 |
| `SUPABASE_SERVICE_ROLE_KEY` | 写 `user_entitlements` |
| `SUPABASE_JWT_SECRET` | 仅 HS256 Supabase 项目 |

### 限流 binding

```toml
[[ratelimits]]
name = "RATE_LIMITER"
  [ratelimits.simple]
  limit = 60
  period = 60
```

Key：`ip:{地址}`（所有 `/v1/*` 请求）、`sub:{uuid}`（JWT 有效且含 sub）。

---

## 相关文档

- [文档索引](./README.md)
- [ai-gateway-worker.md](./ai-gateway-worker.md) — 读取 `user_entitlements` 决定 AI tier
- [worker-revenuecat/README.md](../worker-revenuecat/README.md) — 部署与开发
