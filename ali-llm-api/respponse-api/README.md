# Responses API（阿里云百炼 · OpenAI 兼容）

阿里云百炼 **Responses API** 参考文档（`/compatible-mode/v1/responses`）。

- 端点：`POST /compatible-mode/v1/responses`
- Body：`model` · `input`（字符串或消息数组）· `stream` · `max_output_tokens`
- 流式：SSE，`response.output_text.delta` → `delta`

> HTTP/1.1 直连时非流式调用可能不稳定；流式或 Chat Completions 通常更可靠。

## 文档索引

| 操作 | 文档 |
| --- | --- |
| 创建响应 | [create-response.md](create-response.md) |
| 获取响应 | [get-response.md](get-response.md) |
| 删除响应 | [delete-response.md](delete-response.md) |

仓库内相关：`doc/ai-gateway-worker.md`。
