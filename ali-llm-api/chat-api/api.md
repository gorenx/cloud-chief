# Chat Completions API（阿里云百炼 · OpenAI 兼容）

OpenAI 兼容 Chat Completions 协议：`POST /compatible-mode/v1/chat/completions`。

官方文档：[千问 OpenAI Chat Completions 兼容 API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)

## 接入地址

### 华北2（北京）

- SDK `base_url`：`https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- 兼容旧域名：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- HTTP：`POST …/chat/completions`

### 新加坡

- SDK `base_url`：`https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
- 兼容旧域名：`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`

### 美国（弗吉尼亚）

- SDK `base_url`：`https://dashscope-us.aliyuncs.com/compatible-mode/v1`

### 德国（法兰克福）· 日本（东京）

- SDK `base_url`：`https://{WorkspaceId}.<region>.maas.aliyuncs.com/compatible-mode/v1`

将 `{WorkspaceId}` 替换为[业务空间 ID](https://help.aliyun.com/zh/model-studio/obtain-the-app-id-and-workspace-id#d3eb3cd37b7fu)。

> **重要**：华北2、新加坡建议迁移至业务空间专属域名（上表 `{WorkspaceId}.…`），性能与稳定性更好；旧 `dashscope*.aliyuncs.com` 域名仍可用。

## HTTP

```http
POST /compatible-mode/v1/chat/completions
Authorization: Bearer $DASHSCOPE_API_KEY
Content-Type: application/json
```

## 快速示例

### curl（非流式）

```bash
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-plus",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### curl（流式）

```bash
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  --no-buffer \
  -d '{
    "model": "qwen-plus",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

### 非流式响应（节选）

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "你好！"},
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

### 流式 chunk（节选）

```json
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"你"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}

data: [DONE]
```

## 请求体参数（常用）

典型流式请求示例：

```json
{
  "model": "qwen-plus",
  "messages": [{"role": "user", "content": "<prompt>"}],
  "stream": true,
  "max_tokens": 4096
}
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string · 必选 | 模型 ID。完整列表见[官方文档](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)。网关可忽略 hint、按 tier 强制选型。 |
| `messages` | array · 必选 | 对话上下文；支持多轮 / system / tool / 多模态，见官方文档。 |
| `stream` | boolean | 默认 `false`。`true` 时返回 SSE。 |
| `max_tokens` | integer | 回答部分最大 token。网关/worker 可向下 clamp。 |
| `temperature` | float | 可选，采样温度。 |

## 其它常用参数

tools、thinking、多模态（image/audio/video）、`response_format`、`seed`、`stop` 等见[官方完整参数表](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)。

## 调用示例

### Python（OpenAI SDK）

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

completion = client.chat.completions.create(
    model="qwen-plus",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "你是谁？"},
    ],
)
print(completion.choices[0].message.content)
```

### Node.js（OpenAI SDK）

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const completion = await openai.chat.completions.create({
  model: "qwen-plus",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "你是谁？" },
  ],
});
console.log(completion.choices[0].message.content);
```

## 非流式响应对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 本次调用 ID |
| `object` | string | 固定 `chat.completion` |
| `created` | integer | Unix 时间戳 |
| `model` | string | 实际使用的模型 |
| `choices` | array | 生成结果；取 `choices[0].message.content` 为回复正文 |
| `choices[].finish_reason` | string | `stop` · `length` · `tool_calls` 等 |
| `usage` | object | `prompt_tokens` · `completion_tokens` · `total_tokens` |

## 流式 chunk 对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `object` | string | 固定 `chat.completion.chunk` |
| `choices[].delta.content` | string | **增量文本**（流式消费此字段） |
| `choices[].delta.reasoning_content` | string | 思维链增量（思考类模型） |
| `choices[].finish_reason` | string | 末 chunk 可出现 `stop` / `length` |
| `[DONE]` | sentinel | 部分网关发送，表示流结束 |

调用失败时参见阿里云[错误码说明](https://help.aliyun.com/zh/model-studio/error-code)。

仓库内相关：`doc/ai-gateway-worker.md`。
