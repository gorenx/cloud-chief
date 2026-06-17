# 数据来源

本文说明 Admin 界面与 API 中**每一类数据**的权威来源。记住一条原则：

> **Cloudflare 管资源真身，`.env` 管默认展示，本地文件管模型目录与 Worker 配置。**

## 来源总览

| 来源类型 | 读取方式 | 典型数据 |
|----------|----------|----------|
| **环境变量** | `src/env.ts` 启动时加载 | 账号 ID、默认网关、模型、提供商 slug、密钥 |
| **Cloudflare API** | `src/cf.ts` 实时请求 | 网关列表、提供商、BYOK 配置 |
| **AI Gateway 上游** | `POST /api/chat` 转发 | 模型推理结果（SSE） |
| **本地 TypeScript** | `model-catalog.ts` 硬编码 | Qwen 模型族、思考模式说明 |
| **本地 TOML/vars** | `routing.ts`、`deploy.ts` 读文件 | Worker `DEFAULT_MODEL`、`[vars]` |
| **本地文件系统** | `deploy.ts` 扫描 | worker 项目列表、`.dev.vars` |
| **wrangler 子进程** | `wrangler.ts` spawn | 部署日志、secret 名、whoami |
| **浏览器 localStorage** | 前端 only | `admin_token` |

### 环境变量加载顺序

```
process.env（已存在则不覆盖）
    ↓
admin/.env   ← Admin 仅此一处
```

Worker 使用 `worker/wrangler.toml` `[vars]` 与 `worker/.dev.vars`（或 `wrangler secret`）。

仓库根 `setup.sh` / `test.sh` 与 Admin 共用 `admin/.env`。

---

## 按数据字段说明

### 账号与默认值

| 字段 | 来源 | 说明 |
|------|------|------|
| `account_id` | `env.CF_ACCOUNT_ID` | 概览、invoke_url |
| `has_api_token` | `Boolean(env.CF_API_TOKEN)` | 是否可调 CF API |
| `defaults.gateway` | CF API `pickDefaultGateway()` | `is_default` 或首个非内置网关 |
| `defaults.provider_slug` | CF API `pickDefaultProvider()` | 首个已启用的自定义提供商 |
| `defaults.base_url` | CF 提供商对象 | |
| `defaults.path` | 代码常量 `RESPONSES_API_PATH` | CF 不存储 path |
| `defaults.model` | `env.MODEL` | Playground 与 routing 默认模型 |

出现位置：`GET /admin/state`、`GET /config`（部分字段）。

---

### 网关 (Gateway)

| 字段 | 来源 | API |
|------|------|-----|
| `id` | Cloudflare | `GET /ai-gateway/gateways` |
| `authentication` | Cloudflare | 单网关 `GET .../gateways/{id}` |
| `collect_logs` | Cloudflare | 同上 |
| `is_default` | Cloudflare | 仅 UI 标签；**不参与**默认选中逻辑 |

列表：`GET /admin/state` → `gateways`。

`/config` 的 `gateways` 数组：有 `CF_API_TOKEN` 时从 CF 拉取；若 `CF_GATEWAY_ID` 不在列表中，会**插入到数组头部**（保证 Playground 总能选到配置的默认网关）。

无 `CF_API_TOKEN` 时：列表可能为空，但 `gateway` 字段仍为 env 值。

---

### 自定义提供商 (Custom Provider)

| 字段 | 来源 | API |
|------|------|-----|
| `id`, `slug`, `base_url` | Cloudflare | `GET /ai-gateway/custom-providers` |
| `enable` | Cloudflare | 影响是否可作为上游 |

`routing.provider`：在 `buildRouting()` 中用 `env.PROVIDER_SLUG` 匹配 CF 列表中的项；匹配不到则为 `null`（`RoutingWarnings` 会提示）。

---

### 路由链 (Routing)

`buildRouting(gatewayId, providers)` 合成，**不单独存储**：

| 字段 | 来源 |
|------|------|
| `model` | `env.MODEL`（或 override） |
| `worker_model` | 读 `{WORKER_DIR}/wrangler.toml` → `[vars].DEFAULT_MODEL` |
| `provider_slug` | CF 默认提供商 `.slug` |
| `provider` | 同上提供商对象 |
| `path` | 常量 `/compatible-mode/v1/responses` |
| `base_url` | CF 默认提供商 `.base_url` |
| `invoke_url` | 计算：`gatewayUrl(gatewayId, providerSlug, path)` |
| `api_type` | 固定 `"responses"` |

公式：

```
https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/{gatewayId}/custom-{PROVIDER_SLUG}{PROVIDER_PATH}
```

出现位置：`GET /config` → `routing_preview`；`GET /admin/gateways/:id/context` → `routing`。

---

### BYOK 密钥 (Provider Config)

| 字段 | 来源 | API |
|------|------|-----|
| `id`, `provider_slug`, `alias` | Cloudflare | `GET .../gateways/{gw}/provider_configs` |
| `secret` 明文 | 用户提交 | 仅 `POST` 时写入 CF，**不可读回** |

网关详情 `keys` 与 BYOK 页列表同源。

---

### 模型目录 (Model Catalog)

| 字段 | 来源 |
|------|------|
| `id`, `display_name`, `family`, `supports_thinking`, `notes` | `src/model-catalog.ts` 内 `MODEL_CATALOG` 数组 |

- **不**从 Cloudflare 或阿里云拉取。
- `listModels()` → `GET /config` → `models`
- `lookupModel(modelId)` → 网关 context 的 `model_meta`；找不到则 `null`

更新模型说明或新增型号：改 `model-catalog.ts` 并重新部署 Admin。

---

### Playground 聊天

| 数据 | 来源 |
|------|------|
| 网关/模型下拉初始值 | `GET /config` |
| 流式回复 | 上游 AI Gateway → 阿里云 MaaS |
| 请求鉴权 | `Authorization: Bearer {DASHSCOPE_API_KEY}`（env） |
| 网关鉴权（可选） | `cf-aig-authorization: Bearer {CF_AIG_TOKEN}`（env） |
| 覆盖网关/提供商 | 请求体 `gateway`、`provider_slug` |

前置条件：`PROVIDER_SLUG` 与 `DASHSCOPE_API_KEY` 必须在 env 中配置。

---

### Worker 部署相关

| 数据 | 来源 | 端点 |
|------|------|------|
| `workers[]` | 扫描 `WORKER_ROOT` 下含 `wrangler.toml` 的目录（深度 ≤3） | `GET /admin/worker/workers` |
| `vars` | 解析 `{dir}/wrangler.toml` `[vars]` | `GET /admin/worker/status` |
| `dev_vars`, `local_secrets` | 读 `{dir}/.dev.vars` | 同上 |
| `secrets` 清单（名） | `.dev.vars.example` 注释 + CF `wrangler secret list` | status / secrets |
| `wrangler_version`, `logged_in` | `npx wrangler --version` / `whoami` | status |
| 部署日志 | `npx wrangler deploy` stdout/stderr | SSE |
| 写入 `[vars]` | 本地改 `wrangler.toml` | `PUT /admin/worker/config` |
| 写入本地 secret | 本地改 `.dev.vars` | `PUT /admin/worker/devvars` |
| 推生产 secret | stdin → `wrangler secret put` | `POST /admin/worker/secret` |

子进程环境注入 `CLOUDFLARE_API_TOKEN`（若配置）；与 `CF_API_TOKEN` **不是同一个 token**。

目录安全：`dir` 参数必须落在 `WORKER_ROOT` 解析后的路径内，防止目录穿越。

---

### 前端令牌

| 数据 | 来源 |
|------|------|
| `admin_token` | 用户输入 → `localStorage`（`AdminTokenContext`） |

仅用于请求头 `Authorization: Bearer ...`；服务端比对 `env.ADMIN_TOKEN`。

---

## 数据流简图

```
                    ┌──────────────┐
                    │   .env       │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   /admin/state      /config           /api/chat
         │                 │                 │
         ▼                 ▼                 ▼
   CF API 拉取      CF API +          AI Gateway
   gateways/       model-catalog +        │
   providers        routing.ts             ▼
         │                 │           阿里云 MaaS
         └────────┬────────┘
                  ▼
         gateways/:id/context
                  │
                  ├── CF gateway + keys
                  ├── routing (env + CF)
                  ├── worker_model (wrangler.toml)
                  └── model_meta (catalog)
```

---

## 常见误解

| 误解 | 事实 |
|------|------|
| 默认网关来自 CF `is_default` | 来自 `CF_GATEWAY_ID` env |
| 模型列表来自 CF | 来自本地 `model-catalog.ts` |
| Playground 走 Worker | 直连 AI Gateway，仅本地调试 |
| `CF_API_TOKEN` 能部署 Worker | 需要 `CLOUDFLARE_API_TOKEN` 或 `wrangler login` |
| BYOK 密钥存在 Admin 数据库 | 存在 Cloudflare Secrets Store，Admin 无持久化 |
