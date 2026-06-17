# aigateway-admin（配置 / 管理服务）

把原来的零依赖 `server.js` 升级为生产级的 **TypeScript + Hono** 服务，用于：

- 管理 Cloudflare AI Gateway 资源：网关 / 自定义提供商 / BYOK 存储密钥。
- 一键部署 `../worker`（边缘代理）并设置其 secret（调用本机 wrangler）。
- 本地聊天调试页（`/` 直连 AI Gateway，方便不部署 Worker 也能测）。

## 技术栈

- **TypeScript + Hono**（`@hono/node-server` 跑在 Node 上）
- **zod** 入参校验，**vitest** 测试
- 默认只绑 `127.0.0.1`，`/admin/*` 全部需要 admin 令牌

## 目录结构

```
admin/
├── src/
│   ├── index.ts      # @hono/node-server 启动，绑 127.0.0.1
│   ├── app.ts        # 组装 Hono 路由 + 静态服务
│   ├── env.ts        # zod 校验环境变量（读根 .env / admin/.env）
│   ├── auth.ts       # admin 令牌中间件（timingSafeEqual）
│   ├── cf.ts         # Cloudflare API 封装
│   ├── wrangler.ts   # spawn wrangler 子进程
│   ├── schemas.ts    # zod 请求体 + secret 名白名单
│   └── routes/
│       ├── admin.ts  # /admin/* 资源管理（需令牌）
│       ├── deploy.ts # /admin/worker/* 部署（需令牌，SSE 日志）
│       └── chat.ts   # /api/chat 本地聊天代理（无令牌）
├── public/           # index.html（聊天）、config.html（配置后台）
└── test/             # vitest
```

## 配置

服务按顺序读取环境变量：真实 `process.env` > `admin/.env` > 仓库根 `.env`。
通常复用仓库根 `.env`，只需补充本服务新增项（见 [.env.example](.env.example)）：

- `ADMIN_TOKEN`（必填）：访问 `/admin/*` 需要 `Authorization: Bearer <ADMIN_TOKEN>`。未设置则管理接口全部拒绝。
- `ADMIN_BIND`（默认 `127.0.0.1`）、`PORT`（默认 `8787`）。
- `CF_ACCOUNT_ID` / `CF_API_TOKEN` / `CF_GATEWAY_ID` 等：管理资源用。
- `CLOUDFLARE_API_TOKEN`（可选）：部署 Worker 时注入给 wrangler 子进程。

## 运行

```bash
cd admin
npm install
npm run dev        # tsx watch，开发热重载
# 或
npm start          # 直接运行
# 打开 http://127.0.0.1:8787/config.html ，右上角填入 ADMIN_TOKEN
```

其它脚本：`npm run typecheck`、`npm test`、`npm run build`。

## 接口

| 方法 路径 | 鉴权 | 说明 |
|---|---|---|
| `GET /config` | 否 | 聊天页读取的 model / gateway |
| `POST /api/chat` | 否 | 本地聊天代理（SSE） |
| `GET /admin/state` | 令牌 | 账号信息 + 网关/提供商列表 |
| `POST/DELETE /admin/gateways` | 令牌 | 网关 upsert / 删除 |
| `POST/DELETE /admin/providers` | 令牌 | 自定义提供商 upsert / 删除 |
| `GET/POST/DELETE /admin/keys` | 令牌 | BYOK 存储密钥 |
| `GET /admin/worker/workers` | 令牌 | 列出 `WORKER_ROOT` 下可选的 worker 目录 |
| `GET /admin/worker/status` | 令牌 | wrangler 版本 / 登录态 / worker 名 / `[vars]` / 私密清单与本地状态（`?dir=` 选目录） |
| `GET /admin/worker/secrets` | 令牌 | 生产已设置的 secret 名（`wrangler secret list`，值不可读回） |
| `POST /admin/worker/deploy` | 令牌 | `wrangler deploy`，SSE 实时日志 |
| `POST /admin/worker/secret` | 令牌 | 推送生产 secret（名为合法标识符，值走 stdin） |
| `PUT /admin/worker/config` | 令牌 | 更新 wrangler.toml 的 `[vars]`（任意键值） |
| `PUT /admin/worker/devvars` | 令牌 | 写入本地 `.dev.vars`（仅供 `wrangler dev`） |

## Worker 部署前提

部署功能调用本机 `wrangler`，需要其自身已鉴权：

- `wrangler login`（OAuth），或
- 设置 `CLOUDFLARE_API_TOKEN`（权限：**Workers Scripts - Edit**）。

> 这与管理网关用的 `CF_API_TOKEN`（AI Gateway / Secrets Store 权限）是**不同的 token**。

### 选择 worker 目录

部署面板可在 `WORKER_ROOT` 下选择不同的 worker 项目（凡含 `wrangler.toml` 的目录都会被列出）。

- `WORKER_DIR`：默认选中的 worker 目录（默认 `../worker`）。
- `WORKER_ROOT`：可选目录的白名单根（默认仓库根 `..`）。所有目录参数都会强制限制在此根内，**禁止目录穿越**，避免任意文件写入与任意命令执行。

## 安全定位

本服务是**本地/内部运维工具**：默认仅绑 `127.0.0.1`，管理接口靠 `ADMIN_TOKEN` 保护。
密钥从浏览器经 localhost 传到服务、再交给 wrangler（值经 stdin，不进命令行）。
若要放到局域网（`ADMIN_BIND=0.0.0.0`），务必使用足够强的 `ADMIN_TOKEN`，并自行加 TLS。
