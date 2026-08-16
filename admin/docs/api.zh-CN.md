# API 参考

[English](api.md) | 简体中文

Base URL：开发 `http://127.0.0.1:5173`（经 Vite 代理）或 `http://127.0.0.1:8787`；生产为 Hono 监听地址。

数据来源细节见 [data-sources.zh-CN.md](./data-sources.zh-CN.md)。

## 鉴权约定

| 标记            | 要求                                                    |
| --------------- | ------------------------------------------------------- |
| 公开            | 无头                                                    |
| 管理            | `Authorization: Bearer <ADMIN_TOKEN>`                   |
| 管理 + CF       | 服务端另需 `CF_API_TOKEN` 调 Cloudflare                 |
| 管理 + wrangler | 服务端需 `CLOUDFLARE_API_TOKEN` 或本机 `wrangler login` |

---

## 公开端点

### `GET /health`

探活。

```json
{ "ok": true }
```

---

### `GET /config`

Playground 与公开配置。无需 ADMIN_TOKEN。

**响应字段**

| 字段              | 类型              | 来源                                                               |
| ----------------- | ----------------- | ------------------------------------------------------------------ |
| `model`           | string            | env `MODEL`                                                        |
| `gateway`         | string            | env `CF_GATEWAY_ID`                                                |
| `gateways`        | string[]          | CF API；env 网关可能 prepend                                       |
| `provider_slug`   | string            | env                                                                |
| `base_url`        | string            | env                                                                |
| `path`            | string            | env                                                                |
| `models`          | ModelMeta[]       | `model-catalog.ts`                                                 |
| `routing`         | RoutingInfo       | `buildRouting()`                                                   |
| `routing_preview` | string            | `routing.invoke_url`（兼容字段）                                   |
| `worker`          | WorkerDebugInfo   | Worker 运行时（URL、vars 来源、has_anon_key 等；**不含**测试邮箱） |
| `worker_routing`  | WorkerRoutingInfo | wrangler `[vars]` 路由链                                           |
| `catalog_synced`  | string[]?         | 本次自动写入 `MODEL_CATALOG` 的 id                                 |
| `_meta`           | ResponseMeta      | 各字段数据来源，见下                                               |

**`_meta.fields` 常用键**

| 键                           | `source`   | 说明                                                |
| ---------------------------- | ---------- | --------------------------------------------------- |
| `gateway`                    | `cf`       | Cloudflare 网关 id                                  |
| `gateways`                   | `cf`       | 下拉列表，`GET /ai-gateway/gateways`                |
| `model`                      | `catalog`  | model-catalog.ts 中的模型 id                        |
| `models`                     | `catalog`  | 模型目录列表                                        |
| `provider_slug` / `base_url` | `cf`       | CF 自定义提供商列表                                 |
| `path`                       | `derived`  | 代码常量 `RESPONSES_API_PATH`                       |
| `routing.invoke_url`         | `derived`  | 由 account + gateway + slug + path 拼接             |
| `routing.worker_model`       | `wrangler` | `wrangler.toml [vars].DEFAULT_MODEL`                |
| `chat.authorization`         | `env`      | `DASHSCOPE_API_KEY`；Playground 聊天专用，不经 BYOK |

`source` 枚举：`env` | `cf` | `wrangler` | `catalog` | `derived`。每项可选 `key`、`dependsOn`、`hint`。

**调用方**：`PlaygroundPage` → `fetchPublicConfig()`

---

### `POST /api/chat`

本地聊天代理，SSE 响应。

**请求体**

```json
{
  "model": "可选，默认 env.MODEL",
  "messages": [],
  "input": "与 messages 二选一",
  "gateway": "可选，默认 env.CF_GATEWAY_ID",
  "provider_slug": "可选，默认 env.PROVIDER_SLUG"
}
```

**前置**：env 中 `PROVIDER_SLUG` 与当前内置适配使用的 `DASHSCOPE_API_KEY` 必填。该变量名是现有实现细节，并不限制架构只能使用 DashScope。

**上游**：`https://gateway.ai.cloudflare.com/v1/...`；可选头 `cf-aig-authorization`。

**调用方**：`PlaygroundPage` 直连 Gateway 模式 `fetch("/api/chat")`

---

### `GET /api/worker-chat/health`

探测 Worker `/health`。

**Query**：`target=local`（默认，`:8788`）或 `target=online`（workers.dev）。

```json
{
  "ok": true,
  "status": 200,
  "body": "ok",
  "worker_url": "http://127.0.0.1:8788",
  "target": "local"
}
```

失败时 `ok: false`，`error` 为中文说明（含连接超时、未启动等）。

---

### `GET /api/worker-chat/info`

Worker 调试元数据（与 `GET /config` 的 `worker` 字段同源）。

---

### `POST /api/worker-chat`

Playground **经 Worker** 模式：Admin 代持 Supabase JWT，代理到 Worker。

**请求体**

```json
{
  "model": "可选",
  "messages": [],
  "access_token": "可选；留空则用 body email/password 或 env 测试账号代登录",
  "email": "可选",
  "password": "可选",
  "endpoint": "responses | chat，默认 responses",
  "use_worker_config": true,
  "worker_target": "local | online，默认 local"
}
```

**前置**：`worker/wrangler.toml [vars].SUPABASE_URL`；JWT 来源三选一：`access_token`、请求体测试账号、或 env `SUPABASE_ANON_KEY` + `SUPABASE_TEST_*`。

**上游**：`{picked_worker_url}/v1/responses`；鉴权 `Authorization: Bearer <supabase access_token>`。Admin 上游超时 15s。

**调用方**：`PlaygroundPage` 经 Worker 模式 `fetch("/api/worker-chat")`

---

## 管理端点 — 资源 (`/admin`)

均需 ADMIN_TOKEN。以下为 Admin 封装；成功时多返回 CF 原始 JSON（含 `success`、`result`）。

### `GET /admin/state`

账号快照 + 资源列表。

```json
{
  "account_id": "string",
  "has_api_token": true,
  "defaults": {
    "gateway": "string",
    "provider_slug": "string",
    "base_url": "string",
    "path": "string",
    "model": "string"
  },
  "gateways": [],
  "gateways_error": null,
  "providers": [],
  "providers_error": null
}
```

**调用方**：Dashboard、Gateways、Providers、Keys

---

### `GET /admin/gateways/:id/context`

单网关聚合视图。

```json
{
  "gateway": { "id": "...", "authentication": false, "is_default": false },
  "gateway_error": null,
  "routing": {
    "model": "string",
    "worker_model": "string | null",
    "provider_slug": "string",
    "provider": { "slug": "...", "base_url": "..." },
    "path": "string",
    "invoke_url": "string",
    "api_type": "responses",
    "base_url": "string"
  },
  "keys": [],
  "keys_error": null,
  "model_meta": {
    "id": "...",
    "display_name": "...",
    "family": "max",
    "supports_thinking": true
  },
  "_meta": {
    "fields": {
      "gateway.id": { "source": "cf" },
      "routing.provider_slug": { "source": "env", "key": "PROVIDER_SLUG" },
      "keys": { "source": "cf" },
      "model_meta": { "source": "catalog" }
    }
  }
}
```

`_meta` 结构与 `GET /config` 相同（`field-meta.ts` 生成）；路由链里 `gateway` 为 `cf`，`routing.model` 为 `catalog`。

**调用方**：Dashboard、Gateways、Keys、Playground（有 Admin Token 时）

---

### `POST /admin/gateways`

Upsert 网关。

```json
{ "id": "qwen-gw", "authentication": false }
```

存在则 `PUT`，否则 `POST` 到 CF。

---

### `DELETE /admin/gateways?id=`

删除网关。Query `id` 必填。

---

### `POST /admin/providers`

创建或更新自定义提供商。

```json
{
  "id": "可选，更新时用",
  "slug": "qwen-beijing-maas",
  "base_url": "https://...",
  "name": "可选",
  "description": "可选",
  "enable": true
}
```

---

### `DELETE /admin/providers?id=`

删除提供商。

---

### `GET /admin/keys?gateway=`

列出网关 BYOK 配置。返回 CF JSON（`result` 数组）。

---

### `POST /admin/keys`

添加 BYOK 密钥。

```json
{
  "gateway": "qwen-gw",
  "provider_slug": "qwen-beijing-maas",
  "alias": "可选",
  "default_config": true,
  "secret": "sk-..."
}
```

---

### `DELETE /admin/keys?gateway=&id=`

删除 BYOK 配置。

---

## 管理端点 — Worker (`/admin/worker`)

均需 ADMIN_TOKEN。多数支持 `?dir=`（相对 `WORKER_ROOT`，默认 `../worker`）。

### `GET /admin/worker/workers`

```json
{ "root": "/abs/path", "default": "../worker", "workers": ["worker", "..."] }
```

---

### `GET /admin/worker/status?dir=`

```json
{
  "worker_dir": "string",
  "worker_dir_rel": "string",
  "worker_dir_exists": true,
  "worker_name": "ai-gateway-proxy",
  "vars": { "CF_GATEWAY_ID": "...", "DEFAULT_MODEL": "..." },
  "secrets": ["CF_AIG_TOKEN", "DASHSCOPE_API_KEY"],
  "dev_vars": {},
  "local_secrets": {},
  "has_dev_vars": true,
  "wrangler_version": "string | null",
  "wrangler_error": "string | null",
  "logged_in": true,
  "whoami": "string | null"
}
```

**调用方**：Dashboard、Worker

---

### `GET /admin/worker/secrets?dir=`

```json
{ "ok": true, "names": ["DASHSCOPE_API_KEY"] }
```

仅 secret 名称，无值。

---

### `PUT /admin/worker/config?dir=`

更新 `wrangler.toml` `[vars]`。

```json
{ "vars": { "DEFAULT_MODEL": "qwen3-plus" } }
```

---

### `PUT /admin/worker/devvars?dir=`

写入 `.dev.vars`（本地开发 secret）。

```json
{ "secrets": { "DASHSCOPE_API_KEY": "..." } }
```

---

### `POST /admin/worker/secret?dir=`

推送生产 secret（stdin 传给 wrangler）。

```json
{ "name": "DASHSCOPE_API_KEY", "value": "..." }
```

---

### `POST /admin/worker/deploy?dir=`

SSE 流：`wrangler deploy` 实时输出。

- 普通行：`data: ...`
- 结束：`event: done` + `data: <exitCode>`
- 错误：`event: error`

**调用方**：`WorkerPage` + `useSSEStream`

---

### `GET /admin/worker/dev/status?dir=`

本地 `wrangler dev` 进程与健康探测。

```json
{
  "running": false,
  "pid": null,
  "healthy": true,
  "worker_dir": "/abs/path/worker"
}
```

---

### `POST /admin/worker/dev/start?dir=`

若 `:8788` 未响应则 spawn `npx wrangler dev`（最多等待 30s）。已运行则 `already_running: true`。

```json
{ "ok": true, "already_running": false }
```

**调用方**：Playground 顶栏「启动本地 Worker」

---

## 管理端点 — Supabase (`/admin/supabase`)

均需 ADMIN_TOKEN。OAuth 回调 `GET /admin/supabase/oauth/callback` 为公开（cookie 存 token）。

**前提**：`SUPABASE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI`；OAuth App 须勾选 **Projects Read** 与 **Database Read/Write**（迁移步骤需要）；`ADMIN_BIND` 为 `127.0.0.1` 或 `localhost`；开发时用 `http://localhost:5173` 打开前端。

### `POST /admin/supabase/connect`

返回 Supabase 授权 URL（PKCE）；浏览器跳转完成 OAuth。

### `GET /admin/supabase/status`

```json
{
  "oauth_configured": true,
  "connected": true,
  "account": {
    "primary_email": null,
    "projects_count": 3,
    "test_email": "user@example.com"
  },
  "local_test": { "email": "user@example.com", "configured": true },
  "local_only": true,
  "oauth_apps_url": "https://supabase.com/dashboard/org/_/apps"
}
```

不调用 Supabase `/v1/profile`（OAuth token 不支持）；`account.projects_count` 来自 Management API。

### `GET /admin/supabase/projects`

```json
{ "projects": [{ "id": "...", "ref": "abcd", "name": "My Project" }] }
```

### `POST /admin/supabase/apply`

```json
{ "ref": "abcd1234" }
```

写入 `admin/.env` 的 `SUPABASE_ANON_KEY` 与 `worker/wrangler.toml` 的 `SUPABASE_URL`；热重载 env。

### `POST /admin/supabase/test-credentials`

```json
{ "email": "user@example.com", "password": "..." }
```

写入 `SUPABASE_TEST_EMAIL` / `SUPABASE_TEST_PASSWORD` 到 `admin/.env`。

### `POST /admin/supabase/disconnect`

清除本地 OAuth token 文件。

### `GET /admin/supabase/migrations/browse?path=`

浏览本机目录（用于目录选择弹窗）。`path` 为空时从已配置目录或用户主目录开始。仅 `ADMIN_BIND=127.0.0.1`（或 `localhost`）时可用。

```json
{
  "path": "/Users/me/Projects/cloud-chief/supabase/migrations",
  "parent": "/Users/me/Projects/cloud-chief/supabase",
  "migration_count": 1,
  "entries": [
    {
      "name": "archive",
      "path": "/Users/me/Projects/cloud-chief/supabase/migrations/archive",
      "has_children": false
    }
  ]
}
```

### `GET /admin/supabase/migrations/dirs`

返回当前配置的迁移目录及常用候选（绝对路径）。

```json
{
  "current": "/Users/me/Projects/cloud-chief/wren-supabase/migrations",
  "current_readable": true,
  "candidates": [
    { "path": "/Users/me/Projects/cloud-chief/supabase/migrations", "count": 2 }
  ]
}
```

`current_readable` 为 `false` 时表示配置路径不存在或无权读取；服务端会依次尝试 `WORKER_ROOT/wren-supabase/migrations` 与旧路径 `supabase/migrations`，前端应提示用户重新选择目录。

### `POST /admin/supabase/migrations/dir`

保存迁移目录到 `admin/.env` 的 `SUPABASE_MIGRATIONS_DIR`（绝对路径；相对路径仍兼容，会解析为 `WORKER_ROOT` 下路径）。仅 `ADMIN_BIND=127.0.0.1`（或 `localhost`）时可用。

```json
{ "dir": "/Users/me/Projects/cloud-chief/supabase/migrations" }
```

### `GET /admin/supabase/migrations/local`

列出所选目录下的 `*.sql`（不含 SQL 正文）。可选 `?dir=` 覆盖当前配置。

```json
{
  "migrations": [{ "version": "001_profiles", "filename": "001_profiles.sql" }],
  "migrations_dir": "/Users/me/Projects/cloud-chief/supabase/migrations"
}
```

### `GET /admin/supabase/migrations/status?ref=abcd1234`

对比本地 SQL 解析出的表与线上 `public` 表。应用在表级别执行。可选 `?dir=`。缺少 Database scope 时 `403` + `needs_db_scope: true`。

```json
{
  "migration_files": [
    {
      "version": "0001_wren_state",
      "filename": "0001_wren_state.sql",
      "tables": ["wren_state", "wren_log"]
    }
  ],
  "table_comparison": [
    {
      "name": "wren_state",
      "local": true,
      "remote": true,
      "status": "synced",
      "source_files": ["0001_wren_state.sql"],
      "rls_enabled": true,
      "policy_count": 2,
      "local_policies": ["owner reads"],
      "remote_policies": ["owner reads", "owner writes"]
    },
    {
      "name": "ai_gateway",
      "local": true,
      "remote": false,
      "status": "local_only",
      "source_files": ["0002_ai_gateway.sql"]
    }
  ],
  "table_summary": { "local": 2, "remote": 1, "synced": 1, "pending": 1 },
  "tables": [{ "name": "wren_state", "rls_enabled": true, "policy_count": 2 }],
  "pending_count": 1,
  "migrations_dir": "/Users/me/Projects/cloud-chief/supabase/migrations"
}
```

### `POST /admin/supabase/migrations/apply`

按表应用迁移（从相关 SQL 文件提取该表的 create/alter/policy 等语句）。

```json
{ "ref": "abcd1234", "table": "wren_state", "dir": "/path/to/migrations" }
```

或

```json
{ "ref": "abcd1234", "apply_all": true }
```

响应：`{ "ok": true, "applied": ["001_profiles"] }`；部分失败时含 `partial` 数组。

### Edge Functions

本地目录结构：`{functions_dir}/{slug}/index.ts`（可选 `deno.json`）。默认 `SUPABASE_FUNCTIONS_DIR=wren-supabase/functions`。通过 Supabase Management API `POST /v1/projects/{ref}/functions/deploy` 部署。

| 方法   | 路径                                     | 说明                          |
| ------ | ---------------------------------------- | ----------------------------- |
| `GET`  | `/admin/supabase/functions/browse?path=` | 本机目录浏览                  |
| `GET`  | `/admin/supabase/functions/dirs`         | 当前/候选目录                 |
| `POST` | `/admin/supabase/functions/dir`          | 保存 `SUPABASE_FUNCTIONS_DIR` |
| `GET`  | `/admin/supabase/functions/status?ref=`  | 本地 vs 线上 functions 对比   |
| `POST` | `/admin/supabase/functions/deploy`       | 部署单个或全部待发布          |

`GET .../status` 响应示例：

```json
{
  "function_comparison": [
    {
      "slug": "hello-world",
      "local": true,
      "remote": false,
      "status": "local_only",
      "file_count": 1,
      "local_files": ["index.ts"],
      "entrypoint": "index.ts"
    }
  ],
  "function_summary": { "local": 1, "remote": 0, "synced": 0, "pending": 1 },
  "pending_count": 1,
  "functions_dir": "/path/to/wren-supabase/functions"
}
```

`POST .../deploy` 请求：

```json
{ "ref": "abcd1234", "slug": "hello-world" }
```

或 `{ "ref": "abcd1234", "deploy_all": true }`。缺少 Functions 权限时 `403` + `needs_functions_scope: true`。

---

## 错误码

| 状态    | 含义                                   |
| ------- | -------------------------------------- |
| 401     | ADMIN_TOKEN 缺失或不匹配               |
| 503     | 未配置 `ADMIN_TOKEN`（管理接口未启用） |
| 400     | zod 校验失败或缺少 query/body 字段     |
| 4xx/5xx | CF API 或 wrangler 原样透传            |

前端统一经 `lib/api.ts` 的 `adminFetch()` 解析 `error` / `errors` 字段。
