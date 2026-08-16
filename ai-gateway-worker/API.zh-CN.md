# ai-gateway-proxy API

[English](API.md) | 简体中文

Worker 名称：`ai-gateway-proxy`
源码：`src/index.ts`

客户端用 **Supabase `access_token`** 调用；上游模型提供商 / Gateway 密钥由 Worker 注入，不下发应用。当前内置 provider adapter 的密钥变量名仍为 `DASHSCOPE_API_KEY`。

---

## Base URL

| 环境 | URL |
|------|-----|
| 生产 | `https://ai-gateway-proxy.<subdomain>.workers.dev` |
| 本地 | `http://127.0.0.1:8788` |

---

## 认证

除 `GET /health` 外，所有 `/v1/*` 请求须携带：

```http
Authorization: Bearer <supabase_access_token>
```

| JWT 字段 | 要求 |
|----------|------|
| `iss` | `{SUPABASE_URL}/auth/v1` |
| `aud` | `authenticated`（可通过 `JWT_AUDIENCE` 覆盖） |
| `sub` | 用户 UUID，用于权益与配额 |

验签：默认 ES256/RS256（Supabase JWKS）；HS256 旧项目需配置 `SUPABASE_JWT_SECRET`。

---

## CORS

| 项 | 值 |
|----|-----|
| 允许方法 | `GET`, `POST`, `OPTIONS` |
| 允许请求头 | `authorization`, `content-type`, `x-device-id` |
| 暴露响应头 | `x-gateway-tier`, `x-gateway-used`, `x-gateway-quota` |

---

## 端点

### `GET /health`

| | |
|--|--|
| 认证 | 无 |
| 成功 | `200`，body 纯文本 `ok` |

```bash
curl -s "$BASE/health"
```

---

### `POST /v1/chat/completions`

OpenAI Chat Completions 兼容代理。

| | |
|--|--|
| 认证 | Supabase JWT |
| Content-Type | `application/json` |
| 上游路径 | `.../custom-{PROVIDER_SLUG}/compatible-mode/v1/chat/completions` |

#### 请求头

| Header | 必填 | 说明 |
|--------|------|------|
| `Authorization` | 是 | `Bearer <access_token>` |
| `Content-Type` | 是 | `application/json` |
| `X-Device-Id` | 否 | 设备 ID（≤80 字符），免费 tier 软防 |

#### 请求体

OpenAI Chat Completions JSON。常用字段：

```json
{
  "model": "qwen-plus",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "stream": true,
  "max_tokens": 1024
}
```

Worker 改写（服务端）：

| 字段 | 行为 |
|------|------|
| `model` | 强制覆盖为 tier 对应模型（`FREE_MODEL` / `PLUS_MODEL`） |
| `max_tokens` | 若存在，`min(客户端值, MAX_TOKENS)`，默认上限 4096 |
| `messages` | 用于 prompt 长度预检，超限 → `400 bad_prompt` |

#### 成功响应

- HTTP 状态码与 body：**上游原样透传**
- 附加响应头：

| Header | 说明 |
|--------|------|
| `X-Gateway-Tier` | `plus` \| `free` |
| `X-Gateway-Used` | 免费用户当日已用次数（Plus 为 `0`） |
| `X-Gateway-Quota` | 免费用户当日配额（Plus 为 `0`） |

非流式 body 示例：

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [{
    "message": { "role": "assistant", "content": "你好！" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15 }
}
```

流式（`stream: true`）— SSE：

```
data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"你"}}]}

data: [DONE]
```

拼接 `choices[0].delta.content`。

#### 示例

```bash
curl -N -X POST "$BASE/v1/chat/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-plus","messages":[{"role":"user","content":"你好"}],"stream":true}'
```

---

### `POST /v1/responses`

OpenAI Responses API 兼容代理。

| | |
|--|--|
| 认证 | Supabase JWT |
| Content-Type | `application/json` |
| 上游路径 | `.../compatible-mode/v1/responses` |

#### 请求头

同 `/v1/chat/completions`。

#### 请求体

```json
{
  "model": "qwen-plus",
  "input": [{"role": "user", "content": "你好"}],
  "stream": true,
  "max_output_tokens": 1024
}
```

| 字段 | 说明 |
|------|------|
| `input` | 字符串或消息数组 |
| `previous_response_id` | 多轮链式调用；仅传新一轮 user 内容，勿重复 assistant 历史 |
| `max_output_tokens` | 若存在，`min(客户端值, MAX_TOKENS)` |

Worker 改写规则与 Chat 相同（`model` 覆盖、prompt 预检）。

#### 成功响应

响应头同 Chat。非流式 body 含 `output[]`；流式 SSE 按 `type` 分发：

| SSE `type` | 说明 |
|------------|------|
| `response.output_text.delta` | 增量文本，字段 `delta` |
| `response.completed` | 结束；`response.id` 供下轮 `previous_response_id` |
| `response.failed` | 失败 |

多轮示例：

```json
{
  "model": "qwen-plus",
  "input": "第二轮问题",
  "previous_response_id": "resp_xxx",
  "stream": true
}
```

#### 示例

```bash
curl -N -X POST "$BASE/v1/responses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-plus","input":[{"role":"user","content":"你好"}],"stream":true}'
```

---

## 策略（Plus / Free）

| Tier | 条件 | 配额 | 模型 |
|------|------|------|------|
| Plus | `user_entitlements.is_plus = true` | 不限 | `PLUS_MODEL` |
| Free | 其他 | UTC 日配额（默认 8）+ 设备/IP 软防 | `FREE_MODEL` |

免费 tier 默认限额（`wrangler.toml` `[vars]` 可覆盖）：

| 变量 | 默认 |
|------|------|
| `FREE_DAILY_CEILING` | 8 |
| `MAX_TOKENS` | 4096 |
| `MAX_PROMPT_CHARS` | 100000 |
| `DEVICE_DAILY_CAP` | 16 |
| `IP_DAILY_CAP` | 64 |

权益由 RevenueCat sync 写入 Supabase，见 [doc/worker-revenuecat.zh-CN.md](../doc/worker-revenuecat.zh-CN.md)。

---

## 错误响应

Worker 自身错误为 JSON `{ "error": "<message>" }`（部分含额外字段）。上游 4xx/5xx **原样透传** upstream body。

### 鉴权中间件

| HTTP | Body |
|------|------|
| 401 | `{ "error": "missing bearer token" }` |
| 401 | `{ "error": "invalid token: ..." }` |
| 403 | `{ "error": "user not allowed" }` |
| 429 | `{ "error": "rate limit exceeded" }` |

限流：每 `sub` 60 次 / 60 秒（`RATE_LIMITER` binding）。

### 策略层

| HTTP | Body |
|------|------|
| 403 | `{ "error": "token missing sub claim" }` |
| 400 | `{ "error": "bad_prompt" }` |
| 429 | `{ "error": "throttled" }` |
| 429 | `{ "error": "over_quota", "used": N, "quota": M }` |
| 500 | `{ "error": "gateway_misconfigured" }` |
| 500 | `{ "error": "quota_failed" }` |

### 上游转发

| HTTP | Body |
|------|------|
| 502 | `{ "error": "upstream fetch failed", "detail": "..." }` |
| 504 | `{ "error": "upstream timeout", "detail": "no response headers within {ms}ms" }` |

`UPSTREAM_TIMEOUT_MS` 默认 60000，**仅限制等待响应头**；流式 body 开始后不再计时。

### 其他

| HTTP | Body |
|------|------|
| 404 | `{ "error": "not found", "hint": "use POST /v1/chat/completions or /v1/responses" }` |
| 500 | `{ "error": "internal error", "detail": "..." }` |

---

## 上游 Gateway URL（内部）

Worker 转发目标（客户端不直接调用）：

```
https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/{CF_GATEWAY_ID}/custom-{PROVIDER_SLUG}{path}
```

| kind | path |
|------|------|
| chat | `/compatible-mode/v1/chat/completions` |
| responses | `/compatible-mode/v1/responses` |

Worker 注入上游请求头：

| Header | 值 |
|--------|-----|
| `Authorization` | `Bearer {DASHSCOPE_API_KEY}` |
| `cf-aig-authorization` | `Bearer {CF_AIG_TOKEN}`（若已配置） |
| `cf-aig-metadata` | JSON：`sub`, `email`, `role`, `tier`, `used`, `quota` |

---

## OpenAI SDK

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "unused",
  baseURL: `${BASE}/v1`,
  defaultHeaders: {
    Authorization: `Bearer ${accessToken}`,
    "X-Device-Id": deviceId,
  },
});

await client.chat.completions.create({
  model: "qwen-plus",
  messages: [{ role: "user", content: "你好" }],
  stream: true,
});

await client.responses.create({
  model: "qwen-plus",
  input: "你好",
  stream: true,
});
```

---

## 测试

```bash
# 获取 token 后调用
./scripts/e2e.sh
WORKER_URL=https://ai-gateway-proxy.<sub>.workers.dev ./scripts/e2e.sh
ENDPOINT=chat ./scripts/e2e.sh
```

---

## 相关

- [README.zh-CN.md](./README.zh-CN.md) — 部署与开发
- [doc/ai-gateway-worker.zh-CN.md](../doc/ai-gateway-worker.zh-CN.md) — 调用指南（含架构与集成示例）
