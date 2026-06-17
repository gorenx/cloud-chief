# 技术架构

## 总体分层

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器 (React SPA)                                          │
│  web/src — Vite 构建 → web/dist                              │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP
┌───────────────────────────▼─────────────────────────────────┐
│  Hono API 服务 (Node.js)                                     │
│  admin/src — :8787                                           │
│  ├─ 公开：/health /config /api/chat                          │
│  ├─ 管理：/admin/*        (ADMIN_TOKEN)                      │
│  └─ 部署：/admin/worker/* (ADMIN_TOKEN + wrangler 子进程)    │
└───────┬─────────────┬──────────────┬────────────────────────┘
        │             │              │
        ▼             ▼              ▼
   .env 文件    Cloudflare API    本地 worker/
   model-catalog  AI Gateway      wrangler.toml
                  Secrets Store   .dev.vars
```

Admin **不是** Next.js 全栈应用，而是：

- **后端**：常驻 Node 进程，提供 REST + SSE，兼托管生产静态资源。
- **前端**：独立 Vite SPA，开发时与 API 分端口，生产时由 Hono 同一端口托管。

## 运行模式

### 开发模式 (`pnpm dev`)

| 进程 | 端口 | 职责 |
|------|------|------|
| Hono (`tsx watch src/index.ts`) | 8787 | API |
| Vite (`web/`) | 5173 | 前端 + 热更新 |

Vite 将 `/admin`、`/api`、`/config`、`/health` 代理到 `127.0.0.1:8787`（见 `web/vite.config.ts`）。用户访问 **5173**，API 请求经代理打到 8787。

### 生产模式 (`pnpm build && pnpm start`)

1. `web` 构建产物写入 `web/dist/`
2. Hono 用 `serveStatic` 托管 `web/dist`，非 API 路径 fallback 到 `index.html`（SPA）
3. 仅 **8787** 一个端口对外

若 `web/dist` 不存在，降级提供 `public/index.html`、`public/config.html`（旧版静态页）。

## 后端模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 应用装配 | `app.ts` | 注册路由、静态托管、SPA fallback |
| 环境 | `env.ts` | 仅加载 `admin/.env`、zod 校验、`WORKER_DIR` 解析 |
| 鉴权 | `auth.ts` | `ADMIN_TOKEN` Bearer 校验 |
| CF 客户端 | `cf.ts` | `api.cloudflare.com` REST + `gatewayUrl()` |
| 路由聚合 | `routing.ts` | 合成 `invoke_url`、读 worker `DEFAULT_MODEL` |
| 模型目录 | `model-catalog.ts` | 本地 Qwen 元数据 |
| 资源管理 | `routes/admin.ts` | 网关 / 提供商 / BYOK |
| 聊天代理 | `routes/chat.ts` | Playground → AI Gateway |
| Worker 部署 | `routes/deploy.ts` | wrangler 子进程、本地 toml/devvars |

## 前端模块

| 模块 | 路径 | 职责 |
|------|------|------|
| 路由 | `App.tsx` | 7 个业务页 + Settings |
| 布局 | `layouts/AppShell.tsx` | 侧边栏导航、令牌状态 |
| 状态 | `contexts/AdminTokenContext.tsx` | `localStorage.admin_token` |
| 数据 | TanStack Query + `lib/api.ts` | 缓存、重试、统一 fetch |
| 流式 | `hooks/useSSEStream.ts` | Worker 部署日志、Playground 聊天 |

技术栈：React 19、React Router 7、Tailwind 4、TanStack Query 5。

## 鉴权架构

三套凭证，职责分离：

```
浏览器 ──Bearer ADMIN_TOKEN──► /admin/*
                                    │
                                    └──Bearer CF_API_TOKEN──► Cloudflare API

浏览器 ──(无 token)──────────► /config, /api/chat
                                    │
                                    └──DASHSCOPE_API_KEY, CF_AIG_TOKEN──► AI Gateway

Hono ──CLOUDFLARE_API_TOKEN 或 OAuth──► npx wrangler deploy/secret
```

| 凭证 | 保护对象 | 配置 |
|------|----------|------|
| `ADMIN_TOKEN` | 所有 `/admin/*` | `.env`；前端存 localStorage |
| `CF_API_TOKEN` | CF AI Gateway / Secrets Store API | `.env`；仅服务端 |
| `CLOUDFLARE_API_TOKEN` | wrangler 部署 | `.env`；注入子进程 env |
| `DASHSCOPE_API_KEY` | 上游 MaaS | `.env`；仅 `/api/chat` |
| `CF_AIG_TOKEN` | 网关级鉴权头（可选） | `.env` |

未配置 `ADMIN_TOKEN` 时管理接口返回 **503**（非裸奔）。默认绑定 `127.0.0.1`。

## 与 Worker 的关系

```
Playground (/api/chat)     生产流量
       │                        │
       ▼                        ▼
  AI Gateway  ◄──────────  Worker (边缘)
       │                        │
       └──── 阿里云 MaaS ───────┘
```

- **Playground**：浏览器 → Admin Hono → Cloudflare AI Gateway → 自定义提供商。不经过 Worker。
- **Worker**：边缘 JWT 鉴权、限流、代理到同一 AI Gateway URL。配置在 `../worker/wrangler.toml`。
- **Admin Worker 页**：读写本地 worker 目录，调用 `wrangler deploy`，不修改 CF 网关资源本身。

## Monorepo 与依赖

`admin/` 是 pnpm workspace 根，包含：

- `.` — API 包（`package.json`）
- `web/` — 前端子包

详见仓库内 `pnpm-workspace.yaml`、`admin/.npmrc`（`@types/*` 提升，改善 IDE 类型解析）。

## 测试

`test/app.test.ts`（vitest）覆盖：鉴权、入参校验、`GET /config` 结构、`GET /admin/gateways/:id/context` 聚合逻辑（mock CF API）。
