# aigateway-admin（配置 / 管理服务）

TypeScript + Hono 后端 + Vite + React 管理界面，用于：

- 管理 Cloudflare AI Gateway 资源：网关 / 自定义提供商 / BYOK 存储密钥。
- 网关详情页展示路由链与大模型元数据（invoke_url、模型系列、思考模式等）。
- 一键部署 `../worker`（边缘代理）并设置其 secret（调用本机 wrangler）。
- Playground 聊天调试（直连 AI Gateway，无需部署 Worker）。

**设计文档**（信息架构、技术架构、数据来源、API）：见 [docs/](./docs/README.md)。

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

**仅读取 `admin/.env`**（复制 `admin/.env.example`）。进程启动时加载；运行中修改文件会**自动热重载**（`PORT` / `ADMIN_BIND` 变更仍需重启才改监听地址）。

| 范围 | 配置文件 |
|------|----------|
| Admin 服务 + CLI | `admin/.env` |
| Worker 运行时 | `worker/wrangler.toml` + `worker/.dev.vars` |

- `ADMIN_TOKEN`（必填）：访问 `/admin/*` 需要 `Authorization: Bearer <ADMIN_TOKEN>`。
- `ADMIN_BIND`（默认 `127.0.0.1`）、`PORT`（默认 `8787`）。
- `CF_ACCOUNT_ID` / `CF_API_TOKEN`：调 Cloudflare API；路由默认从 CF 实时解析。
- `DASHSCOPE_API_KEY`：Playground 本地聊天代理。
- `CLOUDFLARE_API_TOKEN`（可选）：部署 Worker 时注入给 wrangler 子进程。

## 开发

**一键脚本（推荐）：**

```bash
cd admin
chmod +x run.sh
./run.sh          # 检查 .env → 安装依赖 → 启动开发模式
./run.sh start    # 构建并生产启动（:8787 托管 SPA）
```

从仓库根目录也可：`./admin.sh` 或 `./admin.sh start`。

手动步骤（已安装 pnpm 时优先 pnpm，否则自动用 npm）：

```bash
cd admin
pnpm install         # 或 npm run install:all
pnpm dev             # 或 npm run dev
```

浏览器访问 **http://127.0.0.1:5173**（Vite 代理 API 到 8787）。

单独启动：

```bash
pnpm dev:api         # 仅 Hono
pnpm dev:web         # 仅 Vite
```

在 **设置** 页填入与 `admin/.env` 中一致的 `ADMIN_TOKEN`。

## 内网部署

```bash
cd admin
./run.sh start       # 自动构建 web/dist 并启动 Hono
```

或手动：

```bash
cd admin
pnpm install && pnpm build && pnpm start
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
