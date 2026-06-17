# qwen-gateway-proxy（Cloudflare Worker）

边缘代理：应用带 **Supabase access_token** 调用本 Worker，Worker 校验通过后，用自己持有的
**网关令牌 + DashScope Key** 转发到 Cloudflare AI Gateway，再到阿里云 MaaS。密钥永远不落到应用侧。

```
应用(Supabase 登录拿 access_token)
   │  Authorization: Bearer <supabase access_token>
   ▼
Worker  ── 验 JWT(jose: JWKS/HS256) → 按用户限流 ──┐
   │  注入 cf-aig-authorization + Authorization(DashScope) + cf-aig-metadata
   ▼
Cloudflare AI Gateway  ──>  阿里云 MaaS (qwen3-max)
```

## 技术栈

- **TypeScript** + **Hono**（路由 / 中间件 / 错误处理）
- **jose**（验 Supabase JWT，自动处理 JWKS 拉取与密钥轮换）
- **Cloudflare Rate Limiting binding**（按用户 `sub` 限流）
- **Vitest + @cloudflare/vitest-pool-workers**（在真实 workerd 运行时里跑测试）

## 目录结构

```
worker/
├── src/
│   ├── index.ts     # Hono 应用：CORS、鉴权+限流中间件、两个聊天路由
│   ├── auth.ts      # 用 jose 校验 Supabase access_token（JWKS / HS256）
│   ├── gateway.ts   # 拼网关 URL、注入密钥、透传上游响应（含 SSE）
│   └── types.ts     # Env 绑定与类型
├── test/
│   └── index.test.ts
├── wrangler.toml
├── vitest.config.ts
├── tsconfig.json
└── .dev.vars.example
```

## 路由

| 方法 + 路径 | 转发到上游 |
|---|---|
| `POST /v1/chat/completions` | `/compatible-mode/v1/chat/completions` |
| `POST /v1/responses` | `/compatible-mode/v1/responses` |
| `GET /health` | 健康检查，返回 `ok` |

两个聊天路由都支持 SSE 流式（`"stream": true` 时上游 SSE 原样透传）。

## 一、配置

**Worker 环境独立于 `admin/.env`**：非敏感项在 `wrangler.toml` `[vars]`，密钥在 `.dev.vars` / Secrets。

编辑 `wrangler.toml` 里的 `[vars]`：

- `CF_ACCOUNT_ID` / `CF_GATEWAY_ID` / `PROVIDER_SLUG`：与你 AI Gateway 配置一致。
- `SUPABASE_URL`：**改成你的项目地址**，如 `https://abcd1234.supabase.co`（不要带末尾斜杠）。
- `JWT_AUDIENCE`：Supabase 用户 token 默认 `authenticated`，一般不用改。
- `ALLOWED_SUBS`：可选，逗号分隔的用户 UUID 白名单；留空表示所有已登录用户都放行。

限流在 `[[ratelimits]]`：默认每个用户 `60 秒内 60 次`。`period` 只能是 `10` 或 `60`。

## 二、注入密钥（Secrets）

```bash
cd worker
npm install

npx wrangler secret put CF_AIG_TOKEN        # cfut_ 开头的网关令牌
npx wrangler secret put DASHSCOPE_API_KEY   # sk- 开头的阿里云 DashScope Key
# 仅当你的 Supabase 项目仍用「旧版 HS256 共享密钥」时才需要：
# npx wrangler secret put SUPABASE_JWT_SECRET
```

> Supabase 验签说明：
> - **新项目（2025-10 起默认）** 用非对称 **ES256**，jose 自动从
>   `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` 拉公钥验签，**无需配置任何密钥**。
> - **老项目** 仍是 HS256 共享密钥，需要设置 `SUPABASE_JWT_SECRET`
>   （Supabase 控制台 → Project Settings → API → JWT Settings）。
>   建议尽快在控制台「JWT Keys」里迁移到 ES256。

## 三、开发 / 测试 / 部署

```bash
cp .dev.vars.example .dev.vars   # 填本地用的密钥
npm run dev                      # 本地起服务，默认 http://127.0.0.1:8788（见 wrangler.toml [dev]）
npm run typecheck                # tsc 类型检查
npm test                         # vitest 在 workerd 里跑测试
npm run deploy                   # 部署，得到 https://qwen-gateway-proxy.<子域>.workers.dev
```

本地开发时 Admin Playground 可通过 `WORKER_URL=http://127.0.0.1:8788` 或顶栏「启动本地 Worker」对接本服务。

## 四、应用怎么调用

前端/后端先经 Supabase 登录拿到 `access_token`，再带上它请求 Worker：

```js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data: { session } } = await supabase.auth.getSession();
const accessToken = session.access_token;

const resp = await fetch("https://qwen-gateway-proxy.<子域>.workers.dev/v1/responses", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,   // 注意：放的是 Supabase token，不是 DashScope Key
  },
  body: JSON.stringify({
    model: "qwen3-max",
    input: [{ role: "user", content: "你好" }],
    stream: true,
  }),
});
// resp.body 是 SSE 流，解析 response.output_text.delta 即可。
```

### curl 快速测试

```bash
TOKEN="<粘贴一个有效的 Supabase access_token>"
curl -N -X POST https://qwen-gateway-proxy.<子域>.workers.dev/v1/responses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3-max","input":[{"role":"user","content":"你好"}],"stream":true}'
```

返回码约定：`401` token 缺失/无效，`403` 不在白名单，`429` 触发限流，`404` 路径不存在。

## 安全要点

- 应用侧只持有自己的 Supabase token，**拿不到** 网关令牌和 DashScope Key。
- Supabase token 默认短时有效（新版默认 5 分钟），过期由 Supabase 客户端自动刷新。
- 网关日志里每条请求都带 `cf-aig-metadata`（含用户 `sub`/`email`/`role`），可按用户筛查与计量。
- 按用户限流由 Rate Limiting binding 强制；要更细可换 Durable Object 做精确滑窗。
