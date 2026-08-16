# ai-gateway-proxy 调用指南

[English](ai-gateway-worker.md) | 简体中文

> **API 参考（端点 / 错误码 / SSE）** → [ai-gateway-worker/API.zh-CN.md](../ai-gateway-worker/API.zh-CN.md)
> Worker 部署名：`ai-gateway-proxy` · 源码：`ai-gateway-worker/src/` · 权益：[worker-revenuecat.zh-CN.md](./worker-revenuecat.zh-CN.md)

面向**客户端 / 应用开发者**：如何用 Supabase 登录态调用 AI 推理，而不暴露模型提供商 Key 或 Gateway Token。

本文的调用契约是 OpenAI 兼容的 Chat Completions / Responses。文中的 Qwen、DashScope 和 `/compatible-mode/v1` 是当前内置适配示例，不构成系统的供应商边界；通用架构允许其他 provider adapter 提供自己的凭据、路径和模型目录。

---

## 1. 调用链路

```
┌──────────────┐   Authorization: Bearer <access_token>    ┌─────────────────────┐
│  你的 App    │ ────────────────────────────────────────> │  ai-gateway-proxy   │
│ (iOS/Web/…)  │   POST /v1/chat/completions 或 /responses │  (Cloudflare Worker)│
└──────────────┘   可选 X-Device-Id                        └──────────┬──────────┘
                                                                      │
                    验 JWT → 读权益 → 扣免费配额 → 选模型 → 注入密钥    │
                                                                      ▼
                                                          Cloudflare AI Gateway
                                                                      │
                                                                      ▼
                                                          所选模型提供商
```

**客户端只需知道 Worker 地址 + Supabase `access_token`。**
模型提供商 Key、`CF_AIG_TOKEN`、`SUPABASE_SERVICE_ROLE_KEY` 仅存在于 Worker Secrets，不下发应用。当前内置适配的 provider key 变量名是 `DASHSCOPE_API_KEY`。

| 环境 | Base URL |
|------|----------|
| 生产 | `https://ai-gateway-proxy.<你的子域>.workers.dev` |
| 本地 dev | `http://127.0.0.1:8788` |

---

## 2. 快速开始

### 2.1 获取 access_token

用户通过 Supabase Auth 登录后，从 session 取 `access_token`：

```bash
# 密码登录示例（测试用）
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"your-password"}' \
  | jq -r .access_token
```

应用内通常：

```ts
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
if (!token) throw new Error("未登录");
```

JWT 要求：

| 项 | 值 |
|----|-----|
| Issuer | `{SUPABASE_URL}/auth/v1` |
| Audience | `authenticated`（与 Supabase 默认用户 token 一致） |
| 用户 ID | `sub` 字段（UUID） |

### 2.2 健康检查

```bash
curl -s https://ai-gateway-proxy.<sub>.workers.dev/health
# ok
```

### 2.3 发第一条消息（Responses，流式）

```bash
curl -N -X POST "$WORKER_URL/v1/responses" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: device-abc123" \
  -d '{
    "model": "qwen-plus",
    "input": [{"role": "user", "content": "用一句话自我介绍"}],
    "stream": true
  }'
```

### 2.4 端到端脚本

```bash
cd ai-gateway-worker
./scripts/e2e.sh
# WORKER_URL=https://ai-gateway-proxy.<sub>.workers.dev ./scripts/e2e.sh
# ENDPOINT=chat PROMPT="你好" ./scripts/e2e.sh
```

测试凭据只从环境变量 `EMAIL` / `PASSWORD` / `ANON_KEY` 读取，不写入仓库文档。

---

## 3. 路由一览

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/health` | 无 | 健康检查，返回 `ok` |
| `POST` | `/v1/chat/completions` | Supabase JWT | Chat Completions 代理 |
| `POST` | `/v1/responses` | Responses API 代理 |
| `OPTIONS` | `*` | 无 | CORS 预检 |

未知路径 → `404`：

```json
{ "error": "not found", "hint": "use POST /v1/chat/completions or /v1/responses" }
```

---

## 4. 请求规范

### 4.1 请求头

| Header | 必填 | 说明 |
|--------|------|------|
| `Authorization` | `/v1/*` 必填 | `Bearer <supabase_access_token>` |
| `Content-Type` | 建议 | `application/json` |
| `X-Device-Id` | 否 | 设备标识（最长 80 字符）；免费用户 Sybil 软防 |

CORS 允许：`authorization`、`content-type`、`x-device-id`。

### 4.2 Worker 会改写的字段

无论客户端传什么 `model`，Worker **按用户 tier 强制覆盖**：

| Tier | 条件 | 使用模型（wrangler `[vars]`） |
|------|------|-------------------------------|
| Plus | `user_entitlements.is_plus = true` | `PLUS_MODEL`（默认 `qwen-plus`） |
| Free | 非 Plus | `FREE_MODEL`（默认 `qwen-plus`） |

其他限制：

- `max_tokens` / `max_output_tokens`：取 `min(客户端值, MAX_TOKENS)`，默认上限 4096
- Prompt 字符数：默认上限 100000，超限 → `400 bad_prompt`
- 免费用户：UTC 日配额（默认 8 次）+ 设备/IP 软防

### 4.3 成功响应头

| Header | 说明 |
|--------|------|
| `X-Gateway-Tier` | `plus` 或 `free` |
| `X-Gateway-Used` | 免费用户当日已用次数（Plus 为 `0`） |
| `X-Gateway-Quota` | 免费用户当日配额（Plus 为 `0`） |

可在客户端读取以展示剩余次数。

---

## 5. POST /v1/chat/completions

OpenAI Chat Completions 兼容。上游实际 URL（Worker 内部拼接）：

```
https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/{CF_GATEWAY_ID}/custom-{PROVIDER_SLUG}/compatible-mode/v1/chat/completions
```

### 请求体

```json
{
  "model": "qwen-plus",
  "messages": [
    { "role": "system", "content": "你是助手" },
    { "role": "user", "content": "你好" }
  ],
  "stream": true,
  "max_tokens": 1024
}
```

### 非流式响应（上游原样）

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "你好！" },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15 }
}
```

### 流式 SSE（`stream: true`）

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"你"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":"好"}}]}

data: [DONE]
```

客户端拼接 `choices[0].delta.content`。

### fetch 示例

```ts
const resp = await fetch(`${WORKER_URL}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-Device-Id": deviceId,
  },
  body: JSON.stringify({
    model: "qwen-plus",
    messages: [{ role: "user", content: "你好" }],
    stream: true,
  }),
});

console.log(resp.headers.get("X-Gateway-Tier"));
console.log(resp.headers.get("X-Gateway-Used"), "/", resp.headers.get("X-Gateway-Quota"));
```

---

## 6. POST /v1/responses

OpenAI Responses API 兼容。当前内置适配使用百炼 `/compatible-mode/v1/responses` 路径。

### 请求体

**首轮** — `input` 可为字符串或消息数组：

```json
{
  "model": "qwen-plus",
  "input": [{"role": "user", "content": "你好"}],
  "stream": true,
  "max_output_tokens": 1024
}
```

**多轮** — 使用 `previous_response_id` 链式调用（不要把完整 assistant 历史塞进 `input`）：

```json
{
  "model": "qwen-plus",
  "input": "第二轮问题",
  "previous_response_id": "resp_xxx",
  "stream": true
}
```

Responses API 的通用请求与事件格式以所选 provider adapter 的兼容契约为准；当前百炼适配的扩展行为以其官方文档为准。

### 流式 SSE 事件

每行 `data: {JSON}`，按 `type` 处理：

| type | 用途 |
|------|------|
| `response.output_text.delta` | 增量文本，字段 `delta` |
| `response.completed` | 结束；`response.id` 供下一轮 `previous_response_id` |
| `response.failed` | 失败 |

### fetch 流式解析示例

```ts
const resp = await fetch(`${WORKER_URL}/v1/responses`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    model: "qwen-plus",
    input: [{ role: "user", content: "你好" }],
    stream: true,
  }),
});

const reader = resp.body!.getReader();
const dec = new TextDecoder();
let buf = "";
let lastResponseId: string | null = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") continue;
    const ev = JSON.parse(data);
    if (ev.type === "response.output_text.delta") process.stdout.write(ev.delta);
    if (ev.type === "response.completed") lastResponseId = ev.response?.id ?? null;
  }
}
```

---

## 7. OpenAI SDK 集成

Worker 暴露的是标准 OpenAI 路径，可用 SDK 把 `baseURL` 指向 Worker：

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "unused", // Worker 不校验此字段，鉴权靠 Authorization
  baseURL: `${WORKER_URL}/v1`,
  defaultHeaders: {
    Authorization: `Bearer ${accessToken}`,
    "X-Device-Id": deviceId,
  },
});

// Chat
const chat = await client.chat.completions.create({
  model: "qwen-plus",
  messages: [{ role: "user", content: "你好" }],
  stream: true,
});

// Responses
const stream = await client.responses.create({
  model: "qwen-plus",
  input: "你好",
  stream: true,
});
```

> SDK 默认会把 `apiKey` 放进 `Authorization`；此处需用 `defaultHeaders.Authorization` 覆盖为 Supabase JWT，或将 `apiKey` 设为 access_token（二选一，确保 Bearer 是 JWT 而非 sk- 假 key）。

---

## 8. 错误处理

Worker 自身错误均为 JSON `{ "error": "..." }`（部分带额外字段）。上游 4xx/5xx **原样透传** upstream body。

### 鉴权（中间件）

| HTTP | error | 处理建议 |
|------|-------|----------|
| 401 | `missing bearer token` | 引导用户登录 |
| 401 | `invalid token: ...` | token 过期，刷新 session |
| 403 | `user not allowed` | 不在 `ALLOWED_SUBS` 白名单 |
| 429 | `rate limit exceeded` | 60s 内请求过多，稍后重试 |

### 策略层

| HTTP | error | 处理建议 |
|------|-------|----------|
| 400 | `bad_prompt` | 缩短输入 |
| 403 | `token missing sub claim` | JWT 异常 |
| 429 | `throttled` | 设备/IP 软防触发 |
| 429 | `over_quota` + `used`/`quota` | 展示升级或次日再用 |
| 500 | `gateway_misconfigured` | 服务端配置问题 |
| 500 | `quota_failed` | Supabase RPC 失败 |

### 上游

| HTTP | error | 说明 |
|------|-------|------|
| 502 | `upstream fetch failed` | Gateway / 网络异常 |
| 504 | `upstream timeout` | 等待上游响应头超时（默认 60s）；**不影响已开始的流式 body** |

客户端示例：

```ts
if (resp.status === 429) {
  const j = await resp.json();
  if (j.error === "over_quota") {
    showUpgrade(j.used, j.quota);
  }
}
if (resp.status === 401) {
  await supabase.auth.refreshSession();
}
```

---

## 9. Worker 代理 vs 直连 Gateway

| 维度 | **经 Worker（客户端应使用）** | **直连 Cloudflare AI Gateway（仅运维调试）** |
|------|------------------------------|---------------------------------------------|
| Base URL | `https://ai-gateway-proxy.<sub>.workers.dev` | `https://gateway.ai.cloudflare.com/v1/...` |
| 路径 | `/v1/chat/completions`、`/v1/responses` | `/compatible-mode/v1/...` |
| 客户端鉴权 | Supabase JWT | provider key + 通常所需的 Gateway 鉴权头 |
| 密钥 | 不暴露 | 直连方需持有 provider + Gateway Token |
| 权益/配额 | 有（Plus / Free） | 无 |
| 模型 | 服务端按 tier 覆盖 | 客户端自选 |
| 观测 | Worker 注入 `cf-aig-metadata`（sub/email/tier） | 需自行注入 |

直连 Gateway 调试示例（**勿放入客户端**）：

```bash
curl -N -X POST \
  "https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/{CF_GATEWAY_ID}/custom-{PROVIDER_SLUG}/compatible-mode/v1/responses" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "cf-aig-authorization: Bearer $CF_AIG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-plus","input":"你好","stream":true}'
```

---

## 10. 中间件执行顺序（`/v1/*`）

1. 解析 `Authorization: Bearer`，缺失 → 401
2. `verifySupabaseJWT`（JWKS 或 HS256 secret）
3. `ALLOWED_SUBS` 白名单（非空时）
4. `RATE_LIMITER`：每 `sub` 60 次 / 60 秒
5. `enforceGatewayPolicy`：权益 + 配额 + body 补丁
6. `forward`：注入密钥 → AI Gateway → SSE 透传

---

## 11. 配置参考（运维）

### wrangler `[vars]`

| 变量 | 说明 |
|------|------|
| `CF_ACCOUNT_ID`, `CF_GATEWAY_ID`, `PROVIDER_SLUG` | Gateway 路由 |
| `SUPABASE_URL`, `JWT_AUDIENCE` | JWT 校验 |
| `DEFAULT_MODEL`, `FREE_MODEL`, `PLUS_MODEL` | 模型 ID |
| `FREE_DAILY_CEILING`, `MAX_TOKENS`, `MAX_PROMPT_CHARS`, `DEVICE_DAILY_CAP`, `IP_DAILY_CAP` | 免费策略 |
| `ALLOWED_SUBS` | 可选用户 UUID 白名单（逗号分隔） |
| `UPSTREAM_TIMEOUT_MS` | 等待上游响应头超时（默认 60000） |

### Secrets

```bash
npx wrangler secret put DASHSCOPE_API_KEY
npx wrangler secret put CF_AIG_TOKEN          # Gateway 开启鉴权时
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# 仅 HS256 Supabase 项目：
# npx wrangler secret put SUPABASE_JWT_SECRET
```

本地：`cp .dev.vars.example .dev.vars`

---

## 12. 相关文档

| 文档 | 内容 |
|------|------|
| [doc/README.zh-CN.md](./README.zh-CN.md) | Workers 总览与架构 |
| [worker-revenuecat.zh-CN.md](./worker-revenuecat.zh-CN.md) | 订阅权益 sync |
| [ai-gateway-worker/README.zh-CN.md](../ai-gateway-worker/README.zh-CN.md) | 部署、Workers Builds |
