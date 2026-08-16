# Cloud Chief Worker API

[English](README.md) | 简体中文

Cloud Chief 将提供商和计费凭据保存在 Cloudflare Worker 中。应用只发送用户 access token；Worker 负责验证身份、执行服务端策略并调用上游服务。

## 文档

| 文档 | 部署名 | 内容 |
| --- | --- | --- |
| [`../ai-gateway-worker/API.zh-CN.md`](../ai-gateway-worker/API.zh-CN.md) | `ai-gateway-proxy` | 端点和错误参考 |
| [`ai-gateway-worker.zh-CN.md`](ai-gateway-worker.zh-CN.md) | `ai-gateway-proxy` | 客户端集成与流式处理 |
| [`worker-revenuecat.zh-CN.md`](worker-revenuecat.zh-CN.md) | `revenuecat-proxy` | 订阅、指标、同步和 Webhook API |

## 共享身份与权益流程

1. 客户端登录后发送 bearer JWT，`sub` 是稳定用户 ID。
2. RevenueCat 使用同一个 ID 作为 `app_user_id`。
3. RevenueCat Worker 将订阅状态同步到 Supabase `user_entitlements`。
4. AI Worker 读取该状态，选择 tier 并执行配额。

两个 Worker 都会验证 JWT issuer 和 audience。旧版 HS256 项目需要共享密钥；非对称签名项目使用 JWKS。

详细端点语义只保留在 API 参考中，不在组件 README 重复。
