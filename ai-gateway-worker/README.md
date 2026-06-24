# ai-gateway-proxy（Cloudflare Worker）

生产 **AI 网关**：应用带 **Supabase access_token** 调用本 Worker。Worker 验 JWT、读 Postgres 权益、
对免费用户扣日配额，再用持有的 **网关令牌 + DashScope Key** 转发到 Cloudflare AI Gateway → 阿里云 MaaS。
密钥与 service role 永远不落到应用侧。

RevenueCat webhook / sync 在 **`worker-revenuecat/`**；共享逻辑在 **`packages/gateway-core/`**。

```
应用(Supabase 登录拿 access_token)
   │  Authorization: Bearer <supabase access_token>
   │  X-Device-Id: <optional，Sybil 软防>
   ▼
Worker  ── JWT → burst 限流 → 读 user_entitlements → free: 日配额 + device/IP
   │  服务端选 model → 注入 cf-aig-authorization + DashScope + cf-aig-metadata
   ▼
Cloudflare AI Gateway  ──>  阿里云 MaaS
```

## 技术栈

- **TypeScript** + **Hono**
- **@cloud-chief/gateway-core**（权益读取、配额、策略常量）
- **jose**（Supabase JWT）
- **Cloudflare Rate Limiting binding**（burst；业务日配额在 Postgres）
- **Vitest + @cloudflare/vitest-pool-workers**

## 目录结构

```
ai-gateway-worker/
├── src/
│   ├── index.ts     # 路由、鉴权、enforce + forward
│   ├── enforce.ts   # 权益 + 配额（调用 gateway-core）
│   ├── auth.ts
│   ├── gateway.ts
│   └── types.ts
├── test/
├── wrangler.toml
└── .dev.vars.example
```

## 路由

| 方法 + 路径 | 说明 |
|---|---|
| `POST /v1/chat/completions` | Chat Completions 代理（SSE 透传） |
| `POST /v1/responses` | Responses API 代理（SSE 透传） |
| `GET /health` | 健康检查 |

成功响应带 `X-Gateway-Tier` / `X-Gateway-Used` / `X-Gateway-Quota` 头。免费超额返回 `429`（`over_quota` / `throttled`）。

## 配置

编辑 `wrangler.toml` `[vars]`：

- `CF_ACCOUNT_ID` / `CF_GATEWAY_ID` / `PROVIDER_SLUG`
- `SUPABASE_URL`
- `JWT_AUDIENCE`（默认 `authenticated`，与 Supabase 用户 access_token 的 `aud` 一致）
- `FREE_MODEL` / `PLUS_MODEL`（默认均为 `qwen-plus`）
- `FREE_DAILY_CEILING` / `MAX_TOKENS` / `MAX_PROMPT_CHARS` / `DEVICE_DAILY_CAP` / `IP_DAILY_CAP`（默认见 `gateway-core` `policy.ts`）
- `ALLOWED_SUBS`

## Secrets

```bash
cd ai-gateway-worker
npm install

npx wrangler secret put CF_AIG_TOKEN
npx wrangler secret put DASHSCOPE_API_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# 仅 HS256 Supabase 项目：
# npx wrangler secret put SUPABASE_JWT_SECRET
```

## 开发 / 部署

```bash
cp .dev.vars.example .dev.vars
npm run dev          # http://127.0.0.1:8788
npm test
npm run deploy
```

### Workers Builds（monorepo）

| 设置项 | 值 |
|--------|-----|
| Root directory | `ai-gateway-worker` |
| Build command | `npm ci` |
| Deploy command | `npx wrangler deploy` |
| Build watch paths — Include | `ai-gateway-worker/*`, `packages/gateway-core/*` |

配置见 `cloudflare-builds.json`。

## 应用调用

```js
const resp = await fetch("https://ai-gateway-proxy.<子域>.workers.dev/v1/responses", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
    "X-Device-Id": deviceId,
  },
  body: JSON.stringify({
    model: "qwen-plus", // 服务端会按 tier 覆盖
    input: [{ role: "user", content: "你好" }],
    stream: true,
  }),
});
```

购后/sync 权益：`POST https://revenuecat-proxy.<子域>.workers.dev/v1/sync-entitlement`（见 `worker-revenuecat/README.md`）。
