# Cloud Chief — 面向 OPC 项目的基础设施部署与运维

[English](README.md) | 简体中文

Cloud Chief 帮助 OPC 项目通过统一的本地控制面部署和运维常用基础设施服务，让有限的研发精力集中在产品与业务开发，而不是反复处理云控制台、凭据、部署命令和诊断脚本。

当前仓库已经覆盖 Cloudflare Workers、AI Gateway 与 D1、Supabase、RevenueCat、认证、权益、配额和模型提供商访问。这些是当前已实现的服务集合，不是产品边界。

## 项目目标

- 为 OPC 项目提供一个统一的本地入口，完成基础设施初始化、部署、状态检查、同步和故障排查。
- 将可重复的运维步骤沉淀为引导式流程，明确配置来源并安全隔离 Secret。
- 提供可部署的认证、数据、AI 访问、权益、配额和计费组件，使业务代码只依赖稳定的服务 API。
- 通过 integration adapter 和配置保持外部服务可替换，避免业务策略与具体厂商耦合。

Cloud Chief 不承载应用自身的业务领域，也不替代所连接的云平台；它负责这些基础设施集成及其运维生命周期。

当前仓库内置了兼容 Qwen/DashScope 的适配和模型目录；它们是已有实现，不是系统身份或架构边界。其他 OpenAI 兼容提供商可以复用相同的 gateway/provider 边界，但 Worker 配置完全去供应商化仍属于实现缺口。

## 组件

| 路径 | 职责 |
| --- | --- |
| [`admin/`](admin/README.zh-CN.md) | 管理网关、提供商、密钥、Worker、Supabase 和调试请求的本地/内网控制台 |
| [`ai-gateway-worker/`](ai-gateway-worker/README.zh-CN.md) | 验证用户 JWT、执行权益和配额策略，并向已配置提供商转发请求的生产 AI 代理 |
| [`worker-revenuecat/`](worker-revenuecat/README.zh-CN.md) | RevenueCat API、Webhook 与权益同步边界 |
| [`auth-worker/`](auth-worker/README.zh-CN.md) | 基于 Better Auth 和 Cloudflare D1 的认证服务 |
| [`wren-supabase/`](wren-supabase/README.zh-CN.md) | Supabase Schema、RLS 和配额 RPC |
| [`packages/gateway-core/`](packages/gateway-core/) | 共享权益与配额策略代码 |
| [`doc/`](doc/README.zh-CN.md) | Worker API 与集成文档 |

## 运行模式

- 运维：操作者 → 本地 Admin → 外部平台 API、本地项目文件、部署工具和诊断能力。
- 交付：可复用 Schema 与 Worker 组件 → 已配置云环境 → OPC 业务应用消费的稳定 API。
- AI 请求：应用 → `ai-gateway-worker` → 已配置的 AI Gateway → 所选模型提供商。
- 计费：RevenueCat → `worker-revenuecat` → Supabase `user_entitlements` → 受保护业务服务。

应用只携带用户 access token；上游 API Key 和 service-role 凭据仅保存在服务端或 Worker Secret 中。

## 架构边界

- 本地控制面负责基础设施配置、快照、同步、部署流程和诊断，不拥有应用业务数据。
- 每个外部平台 integration 负责自己的 API client、凭据、资源映射和部署机制。
- 可部署服务向业务应用提供稳定契约，将 provider 凭据和 service-role 权限隔离在服务边界之后。
- 鉴权、权益、配额、计费和模型策略应使用中立业务概念，不按基础设施厂商名称分支。
- 运行时通过配置选择 integration/provider adapter；替换某个外部服务不应要求修改无关客户端或流程。

## 功能矩阵

状态含义：

- **已实现 + 自动化**：存在实现，并有聚焦的自动化测试覆盖该能力。
- **已实现**：存在实现；矩阵不据此声称已通过真实外部环境验收。
- **部分实现**：已有可用的内置实现，但声明的通用边界尚未完整实现。
- **缺口**：架构需要，但尚未形成通用实现。

### 本地控制面

| 能力 | 可观察行为 | 状态 | 证据 |
| --- | --- | --- | --- |
| Admin 鉴权 | 本地登录创建 Admin session；未登录请求无法访问管理接口 | 已实现 + 自动化 | [`admin/src/routes/auth.ts`](admin/src/routes/auth.ts)、[`admin/test/auth-routes.test.ts`](admin/test/auth-routes.test.ts) |
| 本地配置 | 从 `.env` 初始化配置、在 SQLite 保存覆盖值，并可加密敏感值 | 已实现 + 自动化 | [`admin/src/app-config.ts`](admin/src/app-config.ts)、[`admin/test/app-config.test.ts`](admin/test/app-config.test.ts) |
| Gateway 管理 | 查看上下文，创建、更新或删除 Cloudflare AI Gateway | 已实现 | [`admin/src/routes/admin.ts`](admin/src/routes/admin.ts)、[Admin API](admin/docs/api.zh-CN.md) |
| Provider 管理 | 创建和删除自定义 provider，不让供应商身份进入业务策略 | 已实现 | [`admin/src/routes/admin.ts`](admin/src/routes/admin.ts)、[数据权威边界](admin/docs/data-sources.zh-CN.md) |
| BYOK 管理 | 查看、保存和删除 gateway 范围的 provider 凭据 | 已实现 | [`admin/src/routes/admin.ts`](admin/src/routes/admin.ts)、[Admin API](admin/docs/api.zh-CN.md) |
| API path 配置 | 按 gateway/provider 保存 Chat、Responses 和自定义路径后缀 | 已实现 + 自动化 | [`admin/src/gateway-api-path-config.ts`](admin/src/gateway-api-path-config.ts)、[`admin/test/gateway-api-path-config.test.ts`](admin/test/gateway-api-path-config.test.ts) |
| 快照同步 | 刷新远端状态、记录同步运行；刷新失败时保留最后可用本地快照 | 已实现 + 自动化 | [`admin/src/routes/sync.ts`](admin/src/routes/sync.ts)、[`admin/test/sync-routes.test.ts`](admin/test/sync-routes.test.ts) |
| Cloudflare D1 管理 | 查看或创建 D1 数据库，并更新 Worker 的 D1 binding | 已实现 + 自动化 | [`admin/src/routes/cloudflare-db.ts`](admin/src/routes/cloudflare-db.ts)、[`admin/test/cloudflare-db-routes.test.ts`](admin/test/cloudflare-db-routes.test.ts) |

### Worker 生命周期与诊断

| 能力 | 可观察行为 | 状态 | 证据 |
| --- | --- | --- | --- |
| 项目发现 | 发现本地 Worker 项目，推断 chat、gateway、model 和 API 能力 | 已实现 + 自动化 | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts)、[`admin/test/worker-capabilities.test.ts`](admin/test/worker-capabilities.test.ts) |
| 运行时配置 | 读取和更新 `wrangler.toml` vars 与本地 `.dev.vars` Secret | 已实现 + 自动化 | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts)、[`admin/test/worker-runtime.test.ts`](admin/test/worker-runtime.test.ts) |
| 本地 Worker 进程 | 启动 Wrangler dev，并报告进程和健康状态 | 已实现 | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts) |
| 部署与 Secret | 推送允许的 Secret，并以流式日志部署所选 Worker | 已实现 | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts)、[Admin API](admin/docs/api.zh-CN.md) |
| Workers Builds | 读取 CI 状态、同步构建配置、保存 builder token 并触发构建 | 已实现 | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts) |
| Endpoint 选择 | 解析本地、`workers.dev` 和自定义域名端点，并拒绝不安全代理路径 | 已实现 + 自动化 | [`admin/src/worker-path.ts`](admin/src/worker-path.ts)、[`admin/test/worker-endpoints.test.ts`](admin/test/worker-endpoints.test.ts) |

### Supabase 运维

| 能力 | 可观察行为 | 状态 | 证据 |
| --- | --- | --- | --- |
| Organization OAuth | 通过 PKCE 连接、查看项目、应用所选项目并断开连接 | 已实现 + 自动化 | [`admin/src/routes/supabase-connect.ts`](admin/src/routes/supabase-connect.ts)、[`admin/test/supabase-oauth.test.ts`](admin/test/supabase-oauth.test.ts) |
| 测试身份 | 保存本地测试凭据，为 Worker 路径诊断换取用户 JWT | 已实现 | [`admin/src/routes/supabase-connect.ts`](admin/src/routes/supabase-connect.ts) |
| Migration 运维 | 浏览 migration 目录、比较本地/远端状态并执行 migration | 已实现 + 自动化 | [`admin/src/routes/supabase-connect.ts`](admin/src/routes/supabase-connect.ts)、[`admin/test/supabase-schema.test.ts`](admin/test/supabase-schema.test.ts) |
| Edge Function 运维 | 浏览函数源码、比较部署状态并部署选定函数 | 已实现 + 自动化 | [`admin/src/routes/supabase-connect.ts`](admin/src/routes/supabase-connect.ts)、[`admin/test/supabase-functions.test.ts`](admin/test/supabase-functions.test.ts) |

### AI 请求链路

| 能力 | 可观察行为 | 状态 | 证据 |
| --- | --- | --- | --- |
| Playground 诊断 | 发送直连 Gateway 或经 Worker 的请求，并展示解析后的路由与运行时上下文 | 已实现 + 自动化 | [`admin/src/routes/chat.ts`](admin/src/routes/chat.ts)、[`admin/src/routes/worker-chat.ts`](admin/src/routes/worker-chat.ts)、[`admin/test/app.test.ts`](admin/test/app.test.ts) |
| OpenAI 兼容 API | 代理 Chat Completions 和 Responses，包括 SSE 流式响应 | 已实现 + 自动化 | [`ai-gateway-worker/src/index.ts`](ai-gateway-worker/src/index.ts)、[`ai-gateway-worker/test/index.test.ts`](ai-gateway-worker/test/index.test.ts) |
| 用户鉴权 | 在处理 `/v1/*` 前验证 bearer JWT 的 issuer、audience、签名、有效期和 subject | 已实现 + 自动化 | [`ai-gateway-worker/src/auth.ts`](ai-gateway-worker/src/auth.ts)、[`ai-gateway-worker/test/index.test.ts`](ai-gateway-worker/test/index.test.ts) |
| 权益与配额 | 解析 free/Plus 策略、限制输入输出，并原子扣减免费额度 | 已实现 + 自动化 | [`ai-gateway-worker/src/enforce.ts`](ai-gateway-worker/src/enforce.ts)、[`packages/gateway-core/`](packages/gateway-core/) |
| Provider 转发 | 构造上游 URL、注入 provider/Gateway 凭据并透传流式响应 | 部分实现 | [`ai-gateway-worker/src/gateway.ts`](ai-gateway-worker/src/gateway.ts)；当前仍使用 DashScope 命名凭据和兼容路径 |
| 通用 adapter registry | 通过 provider adapter contract 选择凭据、路径、请求归一化和模型元数据 | 缺口 | 见上文架构边界；当前没有运行时 adapter registry |

### 身份、计费与数据面

| 能力 | 可观察行为 | 状态 | 证据 |
| --- | --- | --- | --- |
| 认证服务 | 提供邮箱密码 session、JWT 签发、JWKS、OAuth provider 端点和可选社交登录 | 已实现 | [`auth-worker/src/`](auth-worker/src/)、[`auth-worker/README.zh-CN.md`](auth-worker/README.zh-CN.md) |
| RevenueCat 用户 API | 按 JWT subject 返回客户、订阅和有效权益 | 已实现 + 自动化 | [`worker-revenuecat/src/index.ts`](worker-revenuecat/src/index.ts)、[`worker-revenuecat/test/index.test.ts`](worker-revenuecat/test/index.test.ts) |
| 计费对账 | 接收 RevenueCat Webhook 或用户主动 sync，并更新 `user_entitlements` | 已实现 | [`worker-revenuecat/src/billing.ts`](worker-revenuecat/src/billing.ts)、[`packages/gateway-core/src/revenuecat-entitlement.ts`](packages/gateway-core/src/revenuecat-entitlement.ts) |
| 管理员指标 | 仅允许 `ALLOWED_SUBS` 调用 RevenueCat overview 和 chart API | 已实现 + 自动化 | [`worker-revenuecat/src/index.ts`](worker-revenuecat/src/index.ts)、[`worker-revenuecat/test/index.test.ts`](worker-revenuecat/test/index.test.ts) |
| Supabase 数据面 | 定义受 RLS 保护的权益、用量、限流和原子额度扣减结构 | 已实现 | [`wren-supabase/migrations/`](wren-supabase/migrations/)、[`wren-supabase/tests/`](wren-supabase/tests/) |

矩阵只描述仓库实现和自动化证据，不代表已经在 Cloudflare、Supabase、RevenueCat 或模型提供商真实环境完成验收。

## 快速开始

当前内置部署需要 Node.js 18+、pnpm、Cloudflare 账号，以及所选 adapter 的提供商凭据。

```bash
pnpm install
cp admin/.env.example admin/.env
./admin.sh
```

打开 `http://localhost:5173`，在设置页填写与 `admin/.env` 相同的 `ADMIN_TOKEN`。开发和部署命令见各组件 README。

## 文档约定

英文使用普通 `.md` 文件名，简体中文使用 `.zh-CN.md`。组件 README 只负责定位、开发和部署；详细 API 行为归档在 [`doc/`](doc/README.zh-CN.md) 或 `admin/docs/`，避免多处复制。

## 安全

- 不要提交 `.env`、`.dev.vars`、token 或 API Key。
- Admin 默认只监听 `127.0.0.1`；内网部署仍需 TLS 和访问边界。
- 生产客户端只调用 Worker，不能获得提供商、Gateway、计费系统或 service-role 密钥。
