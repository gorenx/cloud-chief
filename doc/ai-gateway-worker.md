# ai-gateway-proxy API

> 源码：`ai-gateway-worker/src/index.ts`  
> 本地 dev：`http://127.0.0.1:8788`（`wrangler.toml` `[dev].port`）

生产 AI 网关：校验 Supabase JWT → 读取 `user_entitlements` → 免费用户扣日配额 → 服务端选择模型并注入密钥 → 转发至 Cloudflare AI Gateway → 阿里云 MaaS。

RevenueCat 权益写入见 [worker-revenuecat.md](./worker-revenuecat.md)。

---

## 中间件（`/v1/*`）

执行顺序（`index.ts`）：

1. 解析 `Authorization: Bearer <token>`，缺失 → `401` `missing bearer token`
2. `verifySupabaseJWT`（`auth.ts`），失败 → `401` `invalid token: <jose 错误信息>`
3. 若 `ALLOWED_SUBS` 非空且解析出至少一个 UUID：当前 `sub` 须在白名单内，否则 → `403` `user not allowed`
4. 若配置 `RATE_LIMITER` 且存在 `sub`：按 key `{sub}` 限流，失败 → `429` `rate limit exceeded`
5. 将 claims 写入 context，进入路由 handler

> 与 revenuecat-proxy 不同：此处**无 IP 限流**；无效 token 的 401 **会包含** jose 错误详情。

---

## `GET /health`

| 项 | 值 |
|----|-----|
| 认证 | 无 |
| 成功 | `200`，body 纯文本 `ok` |

---

## `POST /v1/chat/completions`

OpenAI Chat Completions 兼容代理；上游路径（`gateway.ts`）：

```
https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/{CF_GATEWAY_ID}/custom-{PROVIDER_SLUG}/compatible-mode/v1/chat/completions
```

### 请求头

| Header | 必填 | 说明 |
|--------|------|------|
| `Authorization` | 是 | `Bearer <supabase_access_token>` |
| `Content-Type` | 是 | `application/json` |
| `X-Device-Id` | 否 | 设备 ID，截取前 80 字符；免费 tier Sybil 软防（`enforce.ts`） |

### 请求体

OpenAI Chat Completions JSON。服务端会修改 body（`patchUpstreamBody`）：

- **`model`**：强制覆盖为 tier 对应模型（`FREE_MODEL` / `PLUS_MODEL` / `DEFAULT_MODEL`，默认均为 `qwen-plus`）
- **`max_tokens`**：若存在，取 `min(客户端值, MAX_TOKENS)`（默认 4096）

Prompt 大小（`estimatePromptChars`）：解析 `messages` 数组 JSON 字符串长度；超限 → `400` `{ "error": "bad_prompt" }`（默认上限 `MAX_PROMPT_CHARS` = 100000）。

### 策略执行（`enforceGatewayPolicy`）

| Tier | 条件 | 行为 |
|------|------|------|
| Plus | `user_entitlements.is_plus` | 不限日配额；`used=0`, `quota=0` |
| Free | 非 Plus | 扣 UTC 日配额 + device/IP 软防 |

Free tier 默认限额（`gateway-core/policy.ts`，可通过 wrangler `[vars]` 覆盖）：

| 变量 | 默认 |
|------|------|
| `FREE_DAILY_CEILING` | 8 |
| `MAX_TOKENS` | 4096 |
| `MAX_PROMPT_CHARS` | 100000 |
| `DEVICE_DAILY_CAP` | 16 |
| `IP_DAILY_CAP` | 64 |

### 成功响应

- 状态码与 body：**上游原样透传**（含 SSE 流）
- 附加响应头（`policyResponseHeaders`）：

| Header | 说明 |
|--------|------|
| `X-Wren-Tier` | `plus` 或 `free` |
| `X-Wren-Used` | 免费用户当日已用次数（Plus 为 `0`） |
| `X-Wren-Quota` | 免费用户当日配额（Plus 为 `0`） |

上游 metadata（`cf-aig-metadata` JSON）含：`sub`, `email`, `role`, `tier`, `used`, `quota`。

### 错误响应

**鉴权层（中间件）**

| 状态 | `error` |
|------|---------|
| 401 | `missing bearer token` |
| 401 | `invalid token: ...` |
| 403 | `user not allowed` |
| 429 | `rate limit exceeded` |

**策略层（handler，`enforceGatewayPolicy`）**

| 状态 | Body |
|------|------|
| 403 | `{ "error": "token missing sub claim" }` |
| 400 | `{ "error": "bad_prompt" }` |
| 429 | `{ "error": "throttled" }` |
| 429 | `{ "error": "over_quota", "used": <n>, "quota": <n> }` |
| 500 | `{ "error": "gateway_misconfigured" }` |
| 500 | `{ "error": "quota_failed" }` |

**上游转发层（`gateway.ts`）**

| 状态 | Body |
|------|------|
| 502 | `{ "error": "upstream fetch failed", "detail": "..." }` |
| 504 | `{ "error": "upstream timeout", "detail": "no response headers within {ms}ms" }` |

默认首字节超时：`UPSTREAM_TIMEOUT_MS` = 60000；超时仅针对等待响应头，流式 body 不受限。

**未捕获异常**

| 状态 | Body |
|------|------|
| 500 | `{ "error": "internal error", "detail": "..." }` |

### 示例

```bash
curl -X POST "https://ai-gateway-proxy.<account>.workers.dev/v1/chat/completions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: device-abc123" \
  -d '{
    "model": "qwen-plus",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

---

## `POST /v1/responses`

OpenAI Responses API 兼容代理；上游路径：

```
.../compatible-mode/v1/responses
```

行为与 `/v1/chat/completions` 相同，差异：

- Prompt 大小：解析 `input` 数组（或 `prompt` 字符串）
- Body 补丁：覆盖 `model`；若存在 **`max_output_tokens`**（非 `max_tokens`），取 `min(客户端值, MAX_TOKENS)`

### 示例

```bash
curl -X POST "https://ai-gateway-proxy.<account>.workers.dev/v1/responses" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-plus",
    "input": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

---

## `404` 未知路径

```json
{
  "error": "not found",
  "hint": "use POST /v1/chat/completions or /v1/responses"
}
```

---

## 配置参考

### wrangler `[vars]`（非密钥）

| 变量 | 说明 |
|------|------|
| `CF_ACCOUNT_ID`, `CF_GATEWAY_ID`, `PROVIDER_SLUG` | AI Gateway 路由 |
| `SUPABASE_URL`, `JWT_AUDIENCE` | JWT 校验 |
| `DEFAULT_MODEL`, `FREE_MODEL`, `PLUS_MODEL` | 模型 ID |
| `FREE_DAILY_CEILING`, `MAX_TOKENS`, `MAX_PROMPT_CHARS`, `DEVICE_DAILY_CAP`, `IP_DAILY_CAP` | 免费策略 |
| `ALLOWED_SUBS` | 可选用户白名单（逗号分隔 UUID） |
| `UPSTREAM_TIMEOUT_MS` | 上游首字节超时 |

### Secrets

| Secret | 用途 |
|--------|------|
| `DASHSCOPE_API_KEY` | 上游 `Authorization` |
| `CF_AIG_TOKEN` | 可选，`cf-aig-authorization` |
| `SUPABASE_SERVICE_ROLE_KEY` | 读权益、扣配额 |
| `SUPABASE_JWT_SECRET` | 仅 HS256 Supabase 项目 |

### 限流 binding

```toml
[[ratelimits]]
name = "RATE_LIMITER"
  [ratelimits.simple]
  limit = 60
  period = 60
```

Key 格式：`{sub}`（JWT `sub` 原值，无 `sub:` 前缀）。

---

## 相关文档

- [文档索引](./README.md)
- [worker-revenuecat.md](./worker-revenuecat.md) — 权益 sync / webhook
- [ai-gateway-worker/README.md](../ai-gateway-worker/README.md) — 部署与开发
