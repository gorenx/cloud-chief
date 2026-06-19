# revenuecat-proxy（Cloudflare Worker）

边缘代理：应用带 **Supabase access_token** 调用本 Worker，Worker 校验通过后，用服务端持有的
**RevenueCat v2 Secret API Key** 拉取订阅数据。密钥永远不落到应用侧。

```
应用(Supabase 登录拿 access_token)
   │  Authorization: Bearer <supabase access_token>
   ▼
Worker  ── 验 JWT → 按用户限流 ──>  RevenueCat REST API v2
   │  JWT sub 作为 RevenueCat app_user_id / customer_id
   ▼
订阅状态、权益、（管理员）项目指标
```

## 技术栈

- **TypeScript** + **Hono**
- **jose**（验 Supabase JWT）
- **Cloudflare Rate Limiting binding**
- **Vitest + @cloudflare/vitest-pool-workers**

## 目录结构

```
worker-revenuecat/
├── src/
│   ├── index.ts        # 路由与鉴权
│   ├── auth.ts         # Supabase JWT 校验
│   ├── revenuecat.ts   # RevenueCat API 客户端
│   └── types.ts
├── test/
│   └── index.test.ts
├── wrangler.toml
└── .dev.vars.example
```

## 路由

| 方法 + 路径 | 说明 | 权限 |
|---|---|---|
| `GET /health` | 健康检查 | 公开 |
| `GET /v1/me` | 当前用户 RevenueCat 客户信息 | 已登录用户 |
| `GET /v1/me/subscriptions` | 当前用户订阅列表 | 已登录用户 |
| `GET /v1/me/active-entitlements` | 当前用户有效权益 | 已登录用户 |
| `GET /v1/me/subscriptions/:id` | 单条订阅详情（校验归属） | 已登录用户 |
| `GET /v1/metrics/overview` | 项目订阅概览指标 | `ALLOWED_SUBS` 白名单 |
| `GET /v1/charts/:chartName` | 图表时序数据（如 `mrr`、`active_subscriptions`） | `ALLOWED_SUBS` 白名单 |
| `POST /v1/sync-entitlement` | 客户端触发的 Plus 对账（写 `user_entitlements`） | 已登录用户 |
| `POST /webhooks/revenuecat` | RevenueCat webhook（写 `user_entitlements`） | `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` |

### Query 参数

- 列表类：`environment`（`production` / `sandbox`）、`starting_after`、`limit`
- 指标：`currency`（如 `USD`）
- 图表：`resolution`（`day` / `week` / `month`）、`start_time`、`end_time`、`currency`

## 前置条件

1. **RevenueCat SDK** 里把 `app_user_id` 设为 Supabase 用户 UUID（与 JWT `sub` 一致）。
2. 在 RevenueCat Dashboard 创建 **v2 Secret API Key**，权限至少包含：
   - `customer_information:customers:read`
   - `customer_information:subscriptions:read`
   - （管理员接口）`charts_metrics:overview:read`、`charts_metrics:charts:read`

## 配置

编辑 `wrangler.toml` 里的 `[vars]`：

- `RC_PROJECT_ID`：RevenueCat 项目 ID（形如 `projxxxx`）。
- `SUPABASE_URL`：你的 Supabase 项目地址。
- `ALLOWED_SUBS`：可选，逗号分隔的管理员 UUID；留空则 `/v1/metrics/*` 与 `/v1/charts/*` 不可访问。

## 注入密钥

```bash
cd worker-revenuecat
npm install

npx wrangler secret put REVENUECAT_SECRET_API_KEY
npx wrangler secret put REVENUECAT_REST_API_KEY
npx wrangler secret put REVENUECAT_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# 仅旧版 HS256 Supabase 才需要：
# npx wrangler secret put SUPABASE_JWT_SECRET
```

本地开发：

```bash
cp .dev.vars.example .dev.vars
npm run dev    # http://127.0.0.1:8789
npm test
npm run deploy
```

## 应用调用示例

```js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { session } } = await supabase.auth.getSession();

const res = await fetch("https://revenuecat-proxy.<子域>.workers.dev/v1/me/subscriptions", {
  headers: { Authorization: `Bearer ${session.access_token}` },
});
const subscriptions = await res.json();
```

返回码：`401` token 无效，`403` 无权限或订阅不属于当前用户，`429` 限流，`404` 路径不存在。

## RevenueCat Webhook

Dashboard → **Webhooks** → URL：

```
https://revenuecat-proxy.<子域>.workers.dev/webhooks/revenuecat
```

Authorization header：`Bearer <REVENUECAT_WEBHOOK_SECRET>`（与 `wrangler secret` 相同）。
Webhook 与 `POST /v1/sync-entitlement` 均写入 Supabase `user_entitlements`；`ai-gateway-worker` 读取该表定 tier。

## GitHub / Workers Builds

| 设置项 | 值 |
|--------|-----|
| Root directory | `worker-revenuecat` |
| Build command | `npm ci` |
| Deploy command | `npx wrangler deploy` |
| Build watch paths — Include | `worker-revenuecat/*` |

配置已写入 `cloudflare-builds.json`。
