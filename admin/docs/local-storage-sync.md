# 本地存储与数据同步方案

本文设计 Admin 从“实时拉 Cloudflare + 读本地文件”为主，演进到“本地 SQLite 可恢复、可离线展示、可追踪同步状态”的数据层。

核心判断：

- **本地配置**由 SQLite 做权威源，`.env` 作为首次启动种子和兼容导出。
- **Cloudflare 资源**仍由 Cloudflare 做权威源，SQLite 只保存远端快照、同步状态和操作审计。
- **Worker 项目文件**仍由本地 `wrangler.toml`、`.dev.vars` 做权威源，SQLite 保存索引、快照、哈希和 UI 状态。
- **密钥明文不做资源缓存**。可保存“是否存在、名称、更新时间、来源、失败原因”，不能保存 Cloudflare secret 明文。

## 目标

1. 页面首屏不依赖每次 Cloudflare API 成功返回。
2. 用户能看见上一次成功同步的数据，以及它是否过期、是否同步失败。
3. 所有写操作都能留下本地审计记录，失败时能知道是本地写失败、Cloudflare 写失败，还是后续刷新失败。
4. 配置、远端资源、Worker 文件三个数据域边界清楚，不互相抢权威源。
5. 支持手动刷新、启动时扫描、按 TTL 刷新和失败记录，并为后续后台定时刷新/重试保留统一同步表。

## 实现状态

当前代码已完成本文的主体目标：

| 目标 | 状态 | 代码入口 |
| --- | --- | --- |
| SQLite schema 和迁移表 | 已实现 | `src/db/connection.ts` |
| app config 从 env seed、DB 覆盖运行时配置 | 已实现 | `src/app-config-overlay.ts`、`src/app.ts` |
| Cloudflare Gateway / Provider 快照 | 已实现 | `src/cf-resolve.ts`、`src/db/cf-ai-gateway-store.ts` |
| BYOK provider config 快照和事件 | 已实现 | `src/ai-gateway-sync.ts`、`src/routes/admin.ts` |
| D1 database 快照、创建、binding、migration 事件 | 已实现 | `src/d1-sync.ts`、`src/routes/cloudflare-db.ts` |
| Worker 本地项目索引和线上 Worker 快照 | 已实现 | `src/worker-project-sync.ts`、`src/cf-worker-resolve.ts` |
| Supabase OAuth token 迁移到 SQLite | 已实现 | `src/supabase-oauth-store.ts` |
| Supabase 项目快照 | 已实现 | `src/supabase-project-sync.ts` |
| 手动刷新和同步详情 API | 已实现 | `src/routes/sync.ts` |
| 前端 `_sync` 展示和刷新按钮 | 已实现 | `web/src/components/SyncStatus.tsx`、各资源页 |

已实现的同步 API：

| 端点 | 状态 |
| --- | --- |
| `GET /admin/sync/status` | 已实现 |
| `GET /admin/sync/runs/:id` | 已实现 |
| `POST /admin/sync/refresh` | 已实现 |
| `GET /admin/state?refresh=1` | 已实现 |
| `GET /config?refresh=1` | 已实现 |
| `GET /admin/worker/status?refresh=1` | 已实现 |
| `GET /admin/cloudflare-db/d1/databases?refresh=1` | 已实现 |

## 当前实现

SQLite 已覆盖三类数据：

| 数据 | 权威源 | SQLite 职责 |
| --- | --- | --- |
| Admin 用户和会话 | 本地 | `users`、`sessions` |
| App config | 本地 DB | `app_config`，`.env` 只 seed 缺失值 |
| Gateway API path | 本地 DB | `gateway_api_paths` |
| 同步状态和审计 | 本地 DB | `sync_runs`、`sync_events` |
| AI Gateway / Provider / BYOK | Cloudflare | `cf_gateways`、`cf_providers`、`cf_provider_configs` 快照 |
| D1 database | Cloudflare | `cf_d1_databases` 快照 |
| 线上 Worker / 域名 | Cloudflare | `cf_workers`、`cf_worker_domains` 快照 |
| Worker 项目 / vars / binding / secret 名称 | 本地文件 | `worker_projects` 及关联表索引和 hash |
| Supabase OAuth / 项目 | Supabase | `oauth_tokens`、`supabase_projects` |

## 数据归属

### 本地权威数据

这些数据以 SQLite 为准，API 读写 DB，必要时再导出到 `.env` 或文件：

| 数据域 | 说明 |
| --- | --- |
| Admin 用户和会话 | 已实现 |
| App config | `app_config` 是目标权威源，`.env` 是 seed 和兼容 |
| Gateway API path 配置 | 已实现 |
| 同步任务和审计 | `sync_runs`、`sync_events` |

### 远端权威数据

这些数据以 Cloudflare 或 Supabase 为准，本地只存快照：

| 数据域 | 远端权威源 | 本地行为 |
| --- | --- | --- |
| AI Gateway | Cloudflare | 保存 gateway 快照，写成功后更新快照 |
| Custom Provider | Cloudflare | 保存 provider 快照，按 slug 建索引 |
| BYOK Provider Config | Cloudflare | 保存 id、alias、provider_slug、default_config、secret_present |
| D1 Database | Cloudflare | 保存数据库目录和 last_seen 状态 |
| Worker 脚本和 settings | Cloudflare | 保存线上 vars、secret 名称、workers.dev URL、自定义域 |
| Supabase 项目 | Supabase Management API | 保存项目列表快照和已应用项目 |

### 文件权威数据

这些数据以本地文件为准，本地 DB 只保存索引和哈希：

| 数据域 | 文件权威源 | 本地行为 |
| --- | --- | --- |
| Worker 项目列表 | `WORKER_ROOT` 下的 `wrangler.toml` | 保存项目 id、相对路径、script name、toml hash |
| Worker vars | `wrangler.toml [vars]` | 保存最近扫描快照，修改仍写文件 |
| Dev secrets | `.dev.vars` | DB 只存 secret 名称和 value hash，不存明文 |
| D1 binding | `wrangler.toml [[d1_databases]]` | 保存 binding 与远端 D1 database 的关联快照 |
| Supabase migrations/functions 目录 | 本地文件系统 | 保存选择结果和扫描快照 |

## 已实现表结构

先采用“类型化表 + 原始 payload”的混合模式。类型化字段满足 UI 查询和唯一约束，`payload_json` 保留 Cloudflare 原始响应，避免 API 字段变动时丢信息。

### Schema 管理

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
```

`connection.ts` 已通过 `schema_migrations` 和内置 `MIGRATIONS` 按版本执行 SQL，避免 schema 继续散落在路由里。

### 同步运行记录

```sql
CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,              -- cloudflare | supabase | worker_fs
  scope TEXT NOT NULL,               -- gateways | providers | d1 | workers | all
  status TEXT NOT NULL,              -- running | success | partial | failed
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  error TEXT,
  stats_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,              -- refresh | create | update | delete | bind | deploy
  status TEXT NOT NULL,              -- success | failed | skipped
  message TEXT,
  created_at INTEGER NOT NULL
);
```

### Cloudflare AI Gateway 快照

```sql
CREATE TABLE IF NOT EXISTS cf_gateways (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  authentication INTEGER,
  collect_logs INTEGER,
  is_default INTEGER,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE IF NOT EXISTS cf_providers (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT,
  base_url TEXT,
  enabled INTEGER,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id),
  UNIQUE (account_id, slug)
);

CREATE TABLE IF NOT EXISTS cf_provider_configs (
  account_id TEXT NOT NULL,
  gateway_id TEXT NOT NULL,
  id TEXT NOT NULL,
  provider_slug TEXT,
  alias TEXT,
  default_config INTEGER,
  secret_present INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, gateway_id, id)
);
```

### Cloudflare D1 和 Worker 快照

```sql
CREATE TABLE IF NOT EXISTS cf_d1_databases (
  account_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT,
  created_at_text TEXT,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, id)
);

CREATE TABLE IF NOT EXISTS cf_workers (
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  workers_dev_url TEXT,
  subdomain_enabled INTEGER,
  compatibility_date TEXT,
  usage_model TEXT,
  vars_json TEXT NOT NULL DEFAULT '{}',
  secret_names_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, name)
);

CREATE TABLE IF NOT EXISTS cf_worker_domains (
  account_id TEXT NOT NULL,
  script_name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (account_id, script_name, hostname)
);
```

### 本地 Worker 项目索引

```sql
CREATE TABLE IF NOT EXISTS worker_projects (
  id TEXT PRIMARY KEY,
  root_rel TEXT NOT NULL,
  abs_dir TEXT NOT NULL,
  script_name TEXT,
  compatibility_date TEXT,
  toml_hash TEXT,
  dev_vars_hash TEXT,
  last_scanned_at INTEGER NOT NULL,
  missing INTEGER NOT NULL DEFAULT 0,
  UNIQUE (abs_dir)
);

CREATE TABLE IF NOT EXISTS worker_project_vars (
  project_id TEXT NOT NULL REFERENCES worker_projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'wrangler',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, key)
);

CREATE TABLE IF NOT EXISTS worker_project_d1_bindings (
  project_id TEXT NOT NULL REFERENCES worker_projects(id) ON DELETE CASCADE,
  binding TEXT NOT NULL,
  database_name TEXT NOT NULL,
  database_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, binding)
);

CREATE TABLE IF NOT EXISTS worker_project_secret_names (
  project_id TEXT NOT NULL REFERENCES worker_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL,              -- manifest | dev_vars | cf
  value_hash TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, name, source)
);
```

### Supabase OAuth 与项目快照

```sql
CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider TEXT PRIMARY KEY,         -- supabase
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT,
  expires_at INTEGER NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS supabase_projects (
  ref TEXT PRIMARY KEY,
  name TEXT,
  organization_id TEXT,
  region TEXT,
  status TEXT,
  payload_json TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  last_synced_at INTEGER NOT NULL,
  deleted_at INTEGER
);
```

`oauth_tokens` 必须走现有 `encryptValue()` / `decryptValue()`。如果未开启 `ADMIN_DB_ENCRYPT`，启动时应给出明确风险提示。

## 同步流程

### 启动

1. 初始化 SQLite 并执行 schema migrations。
2. 从 `.env` 读取缺省配置，只在 DB 缺值时 seed 到 `app_config`。
3. 从 DB overlay `app_config` 到运行时 `env`。
4. 扫描 `WORKER_ROOT`，更新 `worker_projects`、vars、D1 binding、secret name 快照。
5. 如果配置了 `CF_API_TOKEN`，可延迟触发一次后台 Cloudflare refresh，不阻塞服务启动。

### 读取

默认读本地 DB 快照，响应增加同步元信息：

```json
{
  "gateways": [],
  "_sync": {
    "source": "local_snapshot",
    "stale": false,
    "last_synced_at": 1783620000000,
    "error": null
  }
}
```

读取策略：

| 场景 | 策略 |
| --- | --- |
| DB 有快照且未过期 | 直接返回 |
| DB 有快照但已过期 | 返回快照，并后台刷新 |
| DB 没快照且有 token | 同步拉取一次，成功后返回 |
| DB 没快照且无 token | 返回空数据和明确错误 |

建议默认 TTL：

| 资源 | TTL |
| --- | --- |
| Gateway / Provider / BYOK | 60 秒 |
| D1 database | 120 秒 |
| Worker settings / domains | 30 秒 |
| Supabase projects | 300 秒 |
| 本地 Worker 文件扫描 | 文件 hash 变化时立即更新，否则 30 秒 |

### 写入 Cloudflare

远端资源写操作采用“远端成功后更新本地快照”：

1. 记录 `sync_events(action=update, status=running)` 或直接记录请求开始。
2. 调 Cloudflare API。
3. 成功：把返回结果 upsert 到对应快照表，记录 success。
4. 失败：不修改本地资源快照，记录 failed，API 返回 Cloudflare 错误。
5. 删除成功：设置 `deleted_at`，不立刻硬删，方便 UI 展示“最近删除”和审计。

不要在 Cloudflare 写失败时把本地资源改成“看起来成功”。否则 UI 会制造假状态。

### 写入本地文件

Worker 文件写操作采用“文件成功后更新 DB 索引”：

1. 写 `wrangler.toml` 或 `.dev.vars`。
2. 重新扫描该 worker 目录。
3. 更新 `worker_projects` 相关表。
4. 如果后续还有 Cloudflare 同步，例如 `/cf-vars/sync`，再按远端写流程记录。

D1 创建 + binding 是组合操作，状态要拆开：

| 步骤 | 权威源 | 本地记录 |
| --- | --- | --- |
| 创建 D1 数据库 | Cloudflare | upsert `cf_d1_databases` |
| 写入 wrangler binding | 本地文件 | upsert `worker_project_d1_bindings` |
| 执行 migration | Cloudflare D1 | 写 `sync_events`，记录已应用文件 |

如果数据库已创建但 binding 写失败，DB 中应记录 D1 已存在，同时事件里记录 binding 失败，避免用户重新创建重复数据库。

### 手动刷新 API

已实现：

| 端点 | 作用 |
| --- | --- |
| `GET /admin/sync/status` | 返回各 scope 最近一次同步状态 |
| `POST /admin/sync/refresh` | 手动刷新，body: `{ "source": "cloudflare", "scope": "all" }` |
| `GET /admin/sync/runs/:id` | 查看单次同步详情 |

既有读取端点已加 query：

| 端点 | 增量行为 |
| --- | --- |
| `GET /admin/state?refresh=1` | 强制刷新 gateway/provider 后返回 |
| `GET /admin/worker/status?refresh=1` | 强制刷新本地文件和线上 Worker 状态 |
| `GET /admin/cloudflare-db/d1/databases?refresh=1` | 读取 D1 列表，并可强刷 |

## 冲突规则

| 数据 | 冲突规则 |
| --- | --- |
| `app_config` | 本地 DB 赢，`.env` 只 seed 缺省值 |
| Gateway / Provider / BYOK | Cloudflare 赢，本地只缓存 |
| D1 database | Cloudflare 赢 |
| D1 binding | `wrangler.toml` 赢 |
| Worker vars | 本地页读文件为准，线上页读 Cloudflare 为准，对比时展示差异 |
| Worker secrets | 只比较名称，值不可比较 |
| Supabase OAuth token | DB 赢，旧 `.supabase-oauth.json` 只做一次迁移 |

如果 Cloudflare 上远端资源被外部改了，本地刷新时直接更新快照，并在 `sync_events` 记录 `refresh`。如果用户正在编辑旧数据，保存时以后端最新快照做基础，必要时返回 `409` 并提示先刷新。

## 安全策略

1. Cloudflare BYOK secret 明文不进 DB。
2. Worker production secret 明文不进 DB。
3. `.dev.vars` 明文仍只在文件里，DB 只存 key 和 hash。
4. OAuth token 迁入 DB 后必须使用 `encryptValue()`。
5. `app_config` 中敏感字段沿用现有加密策略，建议生产启用 `ADMIN_DB_ENCRYPT=1`。
6. DB 文件目录保持本地权限，建议创建时确保 `0600`。

## 分阶段实施

### Phase 1: 存储基础

- 加 `schema_migrations`。
- 加 `sync_runs`、`sync_events`。
- 加 Cloudflare gateway/provider/provider_config 快照表。
- 把 `loadCfLists()` 改为“读缓存 + 可刷新”的服务层。
- `GET /admin/state` 返回 `_sync`。

验收：

- 断网时仍能看到上次 gateway/provider。
- 手动刷新失败时页面保留旧数据并显示错误。

### Phase 2: Worker 与 D1

- 加 `cf_d1_databases`、`cf_workers`、`cf_worker_domains`。
- 加 `worker_projects` 及本地文件快照表。
- D1 创建、binding 写入、migration 执行都写事件。
- Worker 左侧项目列表改读 DB 索引，后台扫描刷新。

验收：

- D1 创建成功但 binding 失败时，页面能显示数据库已创建且 binding 待处理。
- 切换 worker 时能看到本地 binding 和线上 Worker 状态的最后同步时间。

### Phase 3: Supabase 与 OAuth

- 把 `.supabase-oauth.json` 迁移到 `oauth_tokens`。
- 加 `supabase_projects` 快照。
- Supabase 项目列表支持上次快照展示。

验收：

- Supabase API 临时失败时仍能选择最近项目信息。
- OAuth token 存储受 DB 加密策略控制。

### Phase 4: 前端同步体验

- 每个资源页展示 `last_synced_at`、`stale`、`refresh`。
- 统一错误提示：实时错误不清空旧数据。
- 对比视图标明来源：local DB snapshot、Cloudflare live、wrangler file。

验收：

- 用户能区分“远端没有资源”和“远端拉取失败但本地有旧快照”。
- 所有刷新按钮状态一致。

## 需要避免的设计

- 不要让 SQLite 成为 Cloudflare 资源的另一个权威源。
- 不要缓存 secret 明文来追求“完整离线恢复”。
- 不要每个路由各自发 Cloudflare 请求并各自处理缓存。
- 不要把 `.env`、DB、wrangler 文件三者做成互相覆盖的循环同步。
- 不要在写远端失败后乐观更新本地快照。

## 代码落点

| 模块 | 改造方向 |
| --- | --- |
| `src/db/connection.ts` | 增加 schema migration 机制和新表 |
| `src/cf-resolve.ts` | 拆成 Cloudflare live fetch + repository cache |
| `src/routes/admin.ts` | 读路径支持缓存和 `refresh=1` |
| `src/d1-database.ts` | 创建、列表、migration 结果写本地事件 |
| `src/cf-worker-resolve.ts` | Worker live fetch 结果写 `cf_workers` |
| `src/routes/deploy.ts` | 本地 worker 扫描结果写 `worker_projects` |
| `src/supabase-oauth-store.ts` | 从 JSON 文件迁移到 `oauth_tokens` |
| `web/src/lib/api.ts` | 支持 `_sync` 元信息 |
| `web/src/pages/*` | 展示同步时间、刷新状态和离线快照 |
