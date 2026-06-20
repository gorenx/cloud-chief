# Requirements Overview

> Cloud Chief Admin 配置后台 — 需求全景

## Product Goal

**Core proposition**：在本地/内网环境运维 Cloudflare AI Gateway 与边缘 Worker，无需反复部署即可验证路由与对话链路。

**Target users**：平台运维、后端开发、集成调试人员。

**Success metrics**：

- 新环境可在 30 分钟内完成网关 + 模型 +（可选）Worker 的首次成功对话
- 路由/鉴权问题可在调试页内定位到「Gateway 直连 / Worker 代理 / 聊天请求」中的具体环节
- 调试行为与生产路径（Worker → Gateway → MaaS）可对齐验证

## User Journey Map

1. 配置 `.env` 与 `ADMIN_TOKEN` → 概览确认账号与默认路由
2. 网关/提供商/BYOK 页完成基础设施（若尚未存在）
3. **调试页面**：选路径（Gateway / Worker）→ 发聊天请求 → 右侧检视路由与鉴权
4. Worker 部署页管理 wrangler 项目；调试页切换 Worker 项目并本地/线上探测
5. 生产前用 Worker 模式复验 Supabase JWT + Gateway 路由

## Requirement Domains

| Domain ID | Domain | User Goal | Status | Requirement Doc | Feature Doc |
| --- | --- | --- | --- | --- | --- |
| D-DBG | 调试页面 | 三 Tab：聊天 / Gateway / Worker；聊天 Tab 内 Gateway/Worker 小切换 | Accepted（设计冻结中） | [req.md](./debug/req.md) | [features.md](./debug/features.md) |

其他域（网关管理 D-GW、Worker 部署 D-WKR、Supabase 连接 D-SB 等）见既有 `admin/docs/information-architecture.md`，后续可拆独立 `req.md`。

## Cross-Domain Relationships

- **D-DBG 依赖 D-GW**：Gateway 下拉、invoke_url、BYOK 上下文来自 CF 网关与 `/admin/gateways/:id/context`
- **D-DBG 依赖 D-WKR**：Worker 模式依赖 wrangler 项目、`/admin/worker/workers` 与 `/api/worker-chat`
- **D-DBG 依赖 D-SB**（可选）：经 Worker 调试需 Supabase JWT；OAuth/测试账号在 Supabase 向导
- **D-DBG 与 D-GW 边界**：调试页只**验证**路由与发请求，不替代网关/提供商 CRUD 页

## Open Questions

- 是否需要在调试页增加「只读 Gateway 探针」（不发聊天、仅 HEAD/health invoke_url）— 当前通过侧栏路由链 + 概览页覆盖
- 多 Worker 项目同时本地 `wrangler dev` 的端口策略 — 当前假定单实例 `:8788`
