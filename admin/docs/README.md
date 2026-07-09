# Admin 文档

本目录说明 **aigateway-admin** 的设计、数据来源与各功能如何协作。快速上手与运维清单见上级 [README.md](../README.md)。

## 文档索引

| 文档 | 内容 |
|------|------|
| [技术架构](./architecture.md) | 前后端分层、运行模式、鉴权与外部依赖 |
| [信息架构](./information-architecture.md) | 页面结构、导航、功能域与用户操作流 |
| [数据来源](./data-sources.md) | 每种数据从哪来：SQLite、env、CF API、本地文件、wrangler |
| [本地存储与数据同步方案](./local-storage-sync.md) | SQLite 权威边界、远端快照、同步流程、冲突规则与迁移阶段 |
| [API 参考](./api.md) | 端点、鉴权、请求/响应与调用方 |

## 一句话定位

Admin 是**本地/内网运维控制台**：用 Hono 代理 Cloudflare AI Gateway 管理 API，用 SQLite 保存本地配置、远端快照和同步审计，用 React SPA 做可视化；Playground 支持直连网关或经 Worker 调试；Worker 页通过本机 `wrangler` 部署边缘代理。

## 核心概念

```
admin/.env ──► seed ──┐
                      ▼
Cloudflare API ──► SQLite 快照/同步记录 ──► Admin API / React UI
Supabase API  ──►        ▲
                         │
wrangler.toml/.dev.vars ─┘
                         │
                         ▼
              Playground / Worker / 外部客户端
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
   /api/chat（直连）              /api/worker-chat（经 Worker）
         │                               │
         └────────────┬──────────────────┘
                      ▼
                AI Gateway → 阿里云 MaaS
```

- **路由默认**：网关与 `provider_slug` / `base_url` 从 **Cloudflare 快照或强制刷新结果**解析；`path` 为代码常量；`MODEL` 来自 SQLite `app_config`，`.env` 只做缺省种子。
- **资源真身**：网关、提供商、BYOK 密钥、D1 和线上 Worker 的权威数据在 **Cloudflare**；Admin 保存快照、同步状态和操作事件。
- **Worker 项目**：本地 `wrangler.toml` 和 `.dev.vars` 是权威源；SQLite 保存索引、binding、vars 和 secret 名称/hash。
- **模型目录**：`model-catalog.ts` 是本地维护的 Qwen 元数据，与 CF 无关。
- **生产聊天**：应走已部署的 **Worker**；Playground 的 `/api/chat` 是直连网关的本地捷径，`/api/worker-chat` 模拟生产验签路径。

## 相关代码入口

| 层级 | 入口 |
|------|------|
| 服务启动 | `src/index.ts` → `src/app.ts` |
| 环境变量 | `src/env.ts` |
| CF 客户端 | `src/cf.ts` |
| 路由聚合 | `src/routing.ts` |
| 模型目录 | `src/model-catalog.ts` |
| 前端路由 | `web/src/App.tsx` |
| 前端 API | `web/src/lib/api.ts` |
