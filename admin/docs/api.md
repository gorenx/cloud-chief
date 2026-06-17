# API 参考

Base URL：开发 `http://127.0.0.1:5173`（经 Vite 代理）或 `http://127.0.0.1:8787`；生产为 Hono 监听地址。

数据来源细节见 [data-sources.md](./data-sources.md)。

## 鉴权约定

| 标记 | 要求 |
|------|------|
| 公开 | 无头 |
| 管理 | `Authorization: Bearer <ADMIN_TOKEN>` |
| 管理 + CF | 服务端另需 `CF_API_TOKEN` 调 Cloudflare |
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

| 字段 | 类型 | 来源 |
|------|------|------|
| `model` | string | env `MODEL` |
| `gateway` | string | env `CF_GATEWAY_ID` |
| `gateways` | string[] | CF API；env 网关可能 prepend |
| `provider_slug` | string | env |
| `base_url` | string | env |
| `path` | string | env |
| `models` | ModelMeta[] | `model-catalog.ts` |
| `routing` | RoutingInfo | `buildRouting()` |
| `routing_preview` | string | `routing.invoke_url`（兼容字段） |
| `_meta` | ResponseMeta | 各字段数据来源，见下 |

**`_meta.fields` 常用键**

| 键 | `source` | 说明 |
|----|----------|------|
| `gateway` | `cf` | Cloudflare 网关 id |
| `gateways` | `cf` | 下拉列表，`GET /ai-gateway/gateways` |
| `model` | `catalog` | model-catalog.ts 中的模型 id |
| `models` | `catalog` | 模型目录列表 |
| `provider_slug` / `base_url` | `cf` | CF 自定义提供商列表 |
| `path` | `derived` | 代码常量 `RESPONSES_API_PATH` |
| `routing.invoke_url` | `derived` | 由 account + gateway + slug + path 拼接 |
| `routing.worker_model` | `wrangler` | `wrangler.toml [vars].DEFAULT_MODEL` |
| `chat.authorization` | `env` | `DASHSCOPE_API_KEY`；Playground 聊天专用，不经 BYOK |

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

**前置**：env 中 `PROVIDER_SLUG`、`DASHSCOPE_API_KEY` 必填。

**上游**：`https://gateway.ai.cloudflare.com/v1/...`；可选头 `cf-aig-authorization`。

**调用方**：`PlaygroundPage` 直连 Gateway 模式 `fetch("/api/chat")`

---

### `GET /api/worker-chat/health`

探测 Worker `/health`（目标 `env.WORKER_URL`）。

```json
{ "ok": true, "status": 200, "body": "ok" }
```

---

### `GET /api/worker-chat/info`

Worker 调试元数据（与 `GET /config` 的 `worker` 字段同源）。

---

### `POST /api/worker-chat`

Playground **经 Worker** 模式：Admin 代持 Supabase JWT，代理到 Worker `POST /v1/responses`（或 chat）。

**请求体**

```json
{
  "model": "可选，默认 wrangler DEFAULT_MODEL 或 env.MODEL",
  "messages": [],
  "access_token": "可选；留空则用 env SUPABASE_* 换 token",
  "endpoint": "responses | chat，默认 responses"
}
```

**前置**：`worker/wrangler.toml [vars].SUPABASE_URL`；`access_token` 或 `SUPABASE_ANON_KEY` + `SUPABASE_TEST_EMAIL` + `SUPABASE_TEST_PASSWORD`。

**上游**：`{WORKER_URL}/v1/responses`；鉴权 `Authorization: Bearer <supabase access_token>`。

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
  "model_meta": { "id": "...", "display_name": "...", "family": "max", "supports_thinking": true },
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
  "worker_name": "qwen-gateway-proxy",
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

## 错误码

| 状态 | 含义 |
|------|------|
| 401 | ADMIN_TOKEN 缺失或不匹配 |
| 503 | 未配置 `ADMIN_TOKEN`（管理接口未启用） |
| 400 | zod 校验失败或缺少 query/body 字段 |
| 4xx/5xx | CF API 或 wrangler 原样透传 |

前端统一经 `lib/api.ts` 的 `adminFetch()` 解析 `error` / `errors` 字段。
