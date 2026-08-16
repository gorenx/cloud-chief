# Cloud Chief — 一人公司的本地基础设施控制台

[English](README.md) | 简体中文

[![许可证：MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Cloud Chief 是面向一人公司（One-Person Company，OPC）项目的本地基础设施控制台。它把常用服务的配置、部署、运维、状态检查和排障集中到一个地方，业务项目只需使用部署后的 API，不必自行保管云平台密钥或维护分散的运维脚本。

仓库目前接入了 Cloudflare、Supabase 和 RevenueCat，并提供认证、AI 代理、权益和配额等现成组件。这些只是现阶段为 OPC 项目实现的功能，不是固定路线图；后续接什么服务，以实际业务需要为准。

## 当前功能

状态说明：**可用**表示已有完整代码路径；**部分**表示当前实现能用，但仍绑定特定平台或适配；**未实现**表示只有设计方向。这里不等同于真实云环境验收。

### 本地管理台

| 功能 | 实际作用 | 状态 |
| --- | --- | --- |
| Admin 登录 | 保护本地管理接口和页面 | 可用，有自动化测试 |
| 本地配置 | 从 `.env` 初始化，在 SQLite 保存修改，可加密敏感值 | 可用，有自动化测试 |
| Gateway 管理 | 查看、新建、修改和删除 Cloudflare AI Gateway | 可用 |
| Provider 管理 | 管理 Gateway 的自定义模型提供商 | 可用 |
| BYOK | 管理 Gateway 下的 provider 密钥 | 可用 |
| API 路径 | 分别配置 Chat、Responses 和其他自定义路径 | 可用，有自动化测试 |
| 状态同步 | 刷新远端资源并保存本地快照和同步记录 | 可用，有自动化测试 |
| D1 管理 | 创建或查看 D1，并更新 Worker binding | 可用，有自动化测试 |

### Worker 部署与调试

| 功能 | 实际作用 | 状态 |
| --- | --- | --- |
| 项目发现 | 扫描本地 Worker，识别它支持的接口和配置项 | 可用，有自动化测试 |
| 配置编辑 | 读写 `wrangler.toml` 和本地 `.dev.vars` | 可用，有自动化测试 |
| 本地运行 | 启动 `wrangler dev`，查看进程和健康状态 | 可用 |
| Secret 与部署 | 设置线上 Secret，流式显示部署日志 | 可用 |
| Workers Builds | 查看、同步和触发 Cloudflare CI 构建 | 可用 |
| Endpoint 选择 | 支持本地地址、`workers.dev` 和自定义域名 | 可用，有自动化测试 |

### Supabase

| 功能 | 实际作用 | 状态 |
| --- | --- | --- |
| Organization OAuth | 连接 Supabase、列出项目并应用所选配置 | 可用，有自动化测试 |
| 测试账号 | 为 Worker 调试获取用户 JWT | 可用 |
| Migration | 浏览本地 migration、比较远端状态并执行 | 可用，有自动化测试 |
| Edge Function | 浏览、比较和部署 Supabase Functions | 可用，有自动化测试 |

### AI 调用

| 功能 | 实际作用 | 状态 |
| --- | --- | --- |
| Playground | 分别测试 Gateway 直连和 Worker 生产链路 | 可用，有自动化测试 |
| OpenAI 兼容接口 | 代理 Chat Completions、Responses 和 SSE 流 | 可用，有自动化测试 |
| 用户鉴权 | 在 `/v1/*` 前校验用户 JWT | 可用，有自动化测试 |
| 权益与配额 | 区分 free/Plus、限制输入输出并扣减免费额度 | 可用，有自动化测试 |
| Provider 转发 | 组装上游地址、注入密钥并透传响应 | 部分：当前仍使用 DashScope 命名和兼容路径 |
| 通用 Adapter Registry | 按 provider 选择凭据、路径和模型目录 | 未实现 |

### 认证、计费与数据

| 功能 | 实际作用 | 状态 |
| --- | --- | --- |
| Auth Worker | 邮箱密码登录、Session、JWT、JWKS 和 OAuth Provider | 可用 |
| RevenueCat 用户接口 | 查询当前用户的订阅和有效权益 | 可用，有自动化测试 |
| 权益同步 | 通过 Webhook 或主动 sync 更新 `user_entitlements` | 可用 |
| 管理指标 | 通过 `ALLOWED_SUBS` 限制 RevenueCat 指标接口 | 可用，有自动化测试 |
| Supabase 数据面 | 提供带 RLS 的权益、用量、限流和额度扣减结构 | 可用 |

## 目录

| 路径 | 内容 |
| --- | --- |
| [`admin/`](admin/README.zh-CN.md) | 本地管理台，以及 Cloudflare、Supabase 和 Worker 运维接口 |
| [`ai-gateway-worker/`](ai-gateway-worker/README.zh-CN.md) | 面向业务应用的 AI 代理 |
| [`worker-revenuecat/`](worker-revenuecat/README.zh-CN.md) | RevenueCat 查询、Webhook 和权益同步 |
| [`auth-worker/`](auth-worker/README.zh-CN.md) | 基于 Better Auth 和 D1 的认证服务 |
| [`wren-supabase/`](wren-supabase/README.zh-CN.md) | Supabase migration、RLS 和配额 RPC |
| [`packages/gateway-core/`](packages/gateway-core/) | AI 配额与 RevenueCat 权益的共享逻辑 |
| [`admin/docs/`](admin/docs/README.zh-CN.md) | Admin 架构、数据来源和 API |
| [`doc/`](doc/README.zh-CN.md) | Worker API 和客户端接入说明 |

## 主要链路

- 运维人员通过本地 Admin 管理远端资源、本地配置和部署过程。
- OPC 业务应用调用已经部署的 Worker，不直接接触 provider key 或 service-role key。
- RevenueCat 将订阅状态同步到 Supabase，受保护服务读取权益结果。
- AI 请求经 `ai-gateway-worker` 做鉴权和配额检查，再转发到已配置的 Gateway 和模型提供商。

当前 AI 实现内置 Qwen/DashScope 配置，但项目不要求使用阿里模型。完全通用的 provider adapter 仍待实现。

## 启动管理台

当前实现需要 Node.js 18+、pnpm、Cloudflare 账号，以及实际使用服务的凭据。

```bash
pnpm install
cp admin/.env.example admin/.env
./admin.sh
```

浏览器打开 `http://localhost:5173`，在设置页填写 `admin/.env` 中的 `ADMIN_TOKEN`。各 Worker 的本地运行和部署命令见对应目录 README。

## 约束

- 本地控制台管理基础设施，不保存业务领域数据。
- 外部平台的 API、凭据和资源映射放在各自 integration 内，不散落到业务代码。
- 客户端只拿用户 token；provider key、Gateway token 和 service-role key 留在服务端。
- 替换基础设施服务时，不应连带修改无关业务流程。

## 安全

- 不要提交 `.env`、`.dev.vars`、token 或 API Key。
- Admin 默认只监听 `127.0.0.1`。部署到内网时仍应增加 TLS 和访问控制。
- 真实云环境是否可用需要单独验收；自动化测试通过不代表远端配置正确。

## 许可证

Cloud Chief 基于 [MIT 许可证](LICENSE)发布。
