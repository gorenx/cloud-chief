# 获取响应（Get Response）

根据 Response ID 获取一个已存储的模型响应。

官方文档：[千问 OpenAI Responses 兼容 API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-responses)

## 接入地址

### 华北2（北京）

- SDK `base_url`：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- HTTP：`GET https://dashscope.aliyuncs.com/compatible-mode/v1/responses/{response_id}`

## HTTP

```http
GET /compatible-mode/v1/responses/{response_id}
Authorization: Bearer $DASHSCOPE_API_KEY
```

## 路径参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `response_id` | string · 必选 | 要获取的 Response ID，格式为 `resp_xxx`。可从[创建响应](create-response.md)的响应中获取。仅当原创建请求中 `store=true` 时返回的 ID 可被检索。 |

## 调用示例

### curl

```bash
curl "https://dashscope.aliyuncs.com/compatible-mode/v1/responses/resp_xxx" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

### Python

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

response = client.responses.retrieve("resp_xxx")
print(response)
```

### Node.js

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const response = await openai.responses.retrieve("resp_xxx");
console.log(response);
```

## 返回结果

返回与[创建响应](create-response.md#响应对象response)相同的 Response 对象。常用字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 响应 ID（`resp_xxx`） |
| `object` | string | 固定为 `response` |
| `status` | string | `completed` · `failed` · `in_progress` · `cancelled` · `queued` · `incomplete` |
| `model` | string | 模型 ID |
| `output` | array | 模型输出项（message / reasoning / function_call 等） |
| `usage` | object | Token 用量 |
| `error` | object | 失败时的错误；成功为 `null` |

完整字段说明见 [create-response.md#响应对象response](create-response.md#响应对象response)。

## 错误响应

当指定的 Response ID 不存在时：

```json
{
  "error": {
    "message": "Response with id 'resp_xxx' not found.",
    "type": "InvalidParameter"
  }
}
```
