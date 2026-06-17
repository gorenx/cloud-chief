# aigateway-admin（配置 / 管理服务）

TypeScript + Hono 后端 + Vite + React 管理界面，用于：

- 管理 Cloudflare AI Gateway 资源：网关 / 自定义提供商 / BYOK 存储密钥。
- 网关详情页展示路由链与大模型元数据（invoke_url、模型系列、思考模式等）。
- 一键部署 `../worker`（边缘代理）并设置其 secret（调用本机 wrangler）。
- Playground 聊天调试（直连 AI Gateway，无需部署 Worker）。

## 技术栈

**后端**

- TypeScript + Hono（`@hono/node-server`）
- zod 入参校验，vitest 测试

**前端**（`web/`）

- Vite + React 19 + TypeScript
- React Router、TanStack Query、Tailwind CSS 4
- 工业运维台深色主题

## 目录结构

```
admin/
├── src/                 # Hono API 服务
│   ├── app.ts           # 路由 + 静态托管 web/dist
│   ├── model-catalog.ts # 大模型元数据目录
│   ├── routing.ts       # 路由链聚合（网关 × 提供商 × 模型）
│   └── routes/
│       ├── admin.ts     # /admin/* 资源管理
│       ├── deploy.ts    # /admin/worker/* 部署
│       └── chat.ts      # /api/chat 本地聊天代理
├── web/                 # Vite + React SPA
│   └── src/
│       ├── pages/       # Dashboard、Gateways、Playground、Worker…
│       └── components/  # GatewayDetailPanel、ModelDetailCard…
└── test/
```

## 配置

服务按顺序读取环境变量：真实 `process.env` > `admin/.env` > 仓库根 `.env`。

- `ADMIN_TOKEN`（必填）：访问 `/admin/*` 需要 `Authorization: Bearer <ADMIN_TOKEN>`。
- `ADMIN_BIND`（默认 `127.0.0.1`）、`PORT`（默认 `8787`）。
- `CF_ACCOUNT_ID` / `CF_API_TOKEN` / `CF_GATEWAY_ID` / `MODEL` 等：管理与路由展示用。
- `CLOUDFLARE_API_TOKEN`（可选）：部署 Worker 时注入给 wrangler 子进程。

## 开发

```bash
cd admin
npm install          # 安装后端依赖
cd web && npm install && cd ..   # 安装前端依赖
npm run dev          # 并行启动 Hono :8787 + Vite :5173
```

浏览器访问 **http://127.0.0.1:5173**（Vite 代理 API 到 8787）。

单独启动：

```bash
npm run dev:api      # 仅 Hono
npm run dev:web      # 仅 Vite
```

在 **设置** 页填入与 `.env` 一致的 `ADMIN_TOKEN`。

## 内网部署

```bash
cd admin
npm install
cd web && npm install && cd ..
npm run build        # 构建 web/dist + tsc
npm start            # Hono :8787 托管 SPA + API
```

运维清单：

1. 服务器安装 Node 18+、wrangler CLI。
2. `.env` 配置 `ADMIN_BIND=0.0.0.0` + 足够强的 `ADMIN_TOKEN`。
3. 前置 Nginx/Caddy 做 TLS 与 IP 白名单。
4. `CF_API_TOKEN` 与 wrangler 登录态需在**运行 admin 的机器**上可用。
5. 健康检查：`GET /health` → `{ "ok": true }`。

## 接口

| 方法 路径 | 鉴权 | 说明 |
|---|---|---|
| `GET /health` | 否 | 探活 |
| `GET /config` | 否 | Playground 配置：model、gateways、models 目录、routing_preview |
| `POST /api/chat` | 否 | 本地聊天代理（SSE） |
| `GET /admin/state` | 令牌 | 账号信息 + 网关/提供商列表 |
| `GET /admin/gateways/:id/context` | 令牌 | 网关详情：路由链 + BYOK + 模型元数据 |
| `POST/DELETE /admin/gateways` | 令牌 | 网关 upsert / 删除 |
| `POST/DELETE /admin/providers` | 令牌 | 自定义提供商 upsert / 删除 |
| `GET/POST/DELETE /admin/keys` | 令牌 | BYOK 存储密钥 |
| `GET /admin/worker/workers` | 令牌 | 列出 worker 目录 |
| `GET /admin/worker/status` | 令牌 | wrangler 状态 + `[vars]` + secrets 清单 |
| `GET /admin/worker/secrets` | 令牌 | 生产 secret 名列表 |
| `POST /admin/worker/deploy` | 令牌 | wrangler deploy（SSE 日志） |
| `POST /admin/worker/secret` | 令牌 | 推送生产 secret |
| `PUT /admin/worker/config` | 令牌 | 更新 wrangler.toml `[vars]` |
| `PUT /admin/worker/devvars` | 令牌 | 写入本地 `.dev.vars` |

## Worker 部署前提

- `wrangler login`（OAuth），或
- `CLOUDFLARE_API_TOKEN`（权限：**Workers Scripts - Edit**）。

> 与管理网关用的 `CF_API_TOKEN`（AI Gateway / Secrets Store）是**不同的 token**。

## 安全定位

默认仅绑 `127.0.0.1`，管理接口靠 `ADMIN_TOKEN` 保护。内网部署时务必使用强令牌并加 TLS。
