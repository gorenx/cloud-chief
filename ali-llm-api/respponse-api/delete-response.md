# 删除响应（Delete Response）

根据 Response ID 删除一个已存储的模型响应。

## 接入地址

### 华北2（北京）

- SDK `base_url`：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- HTTP：`DELETE https://dashscope.aliyuncs.com/compatible-mode/v1/responses/{response_id}`

## HTTP

```http
DELETE /compatible-mode/v1/responses/{response_id}
Authorization: Bearer $DASHSCOPE_API_KEY
```

## 路径参数

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `response_id` | string · 必选 | 要删除的 Response ID，格式为 `resp_xxx`。仅当原创建请求中 `store=true` 时返回的 ID 可被删除。 |

## 调用示例

### curl

```bash
curl -X DELETE "https://dashscope.aliyuncs.com/compatible-mode/v1/responses/resp_xxx" \
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

response = client.responses.delete("resp_xxx")
print(response)
```

### Node.js

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const response = await openai.responses.del("resp_xxx");
console.log(response);
```

## 返回结果

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 被删除的 Response ID |
| `deleted` | boolean | 是否删除成功；成功为 `true` |

示例：

```json
{
  "deleted": true,
  "id": "resp_4ca7fa5e-6ff5-9787-bc18-af6ca5eff36c"
}
```

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
