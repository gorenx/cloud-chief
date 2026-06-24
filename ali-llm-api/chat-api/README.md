# Chat Completions API

阿里云百炼 OpenAI 兼容 **Chat Completions** 接口。

- 端点：`POST /compatible-mode/v1/chat/completions`
- Body：`model` · `messages` · `stream` · `max_tokens`
- 流式：`choices[0].delta.content`

## 文档

| 文档 | 说明 |
| --- | --- |
| [api.md](api.md) | 接入地址 · 参数 · 示例 |

## 与 Responses API 的区别

| | Chat Completions | Responses API |
| --- | --- | --- |
| 路径 | `/chat/completions` | `/responses` |
| 流式字段 | `choices[0].delta.content` | `response.output_text.delta` |
| HTTP/1.1 非流式 | 通常可用 | 部分环境下不稳定 |

详见 `../respponse-api/README.md`。
