# 创建响应（Create Response）

通过兼容 OpenAI 格式的 Responses API 调用千问模型，查看输入输出参数说明及调用示例。

**相较于OpenAI Chat Completions API 的优势：**

- **内置工具**：内置联网搜索、网页抓取、代码解释器、文搜图、图搜图、知识库搜索等工具，可在处理复杂任务时获得更优效果，详情参考[工具调用](https://help.aliyun.com/zh/model-studio/tool-calls/)。
- **更灵活的输入**：支持直接传入字符串作为模型输入，也兼容 Chat 格式的消息数组。
- **简化上下文管理**：通过传递上一轮响应的 `previous_response_id`，无需手动构建完整的消息历史数组。
- **便捷的上下文缓存**：只需在请求头中添加 `x-dashscope-session-cache: enable`，服务端即可自动缓存对话上下文，无需改动业务代码即可降低多轮对话的推理延迟与成本，详情参考[Session 缓存](https://help.aliyun.com/zh/model-studio/compatibility-with-openai-responses-api#example-session-cache-title)。

## 兼容性说明与限制

本 API 在接口设计上兼容 OpenAI，以降低开发者迁移成本，但在参数、功能和具体行为上存在差异。

**核心原则：**请求将仅处理本文档明确列出的参数，任何未提及的 OpenAI 参数都会被忽略。

以下是几个关键的差异点，以帮助您快速适配：

- **部分参数不支持**：不支持部分 OpenAI Responses API 参数，例如异步执行参数`background`（当前仅支持同步调用）等。
- **思考强度控制**：通过 `reasoning.effort` 参数控制模型的思考强度，具体用法请参考相应参数的说明。

官方文档：[千问 OpenAI Responses 兼容 API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-responses)

## 快速示例

### curl

```bash
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/responses \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.7-plus",
    "input": "你能做些什么？"
  }'
```

### 响应

```json
{
  "created_at": 1771165743,
  "id": "c9f9c06b-032d-4525-a422-ac8ab5eccxxx",
  "model": "qwen3.7-plus",
  "object": "response",
  "output": [
    {
      "content": [
        {
          "annotations": [],
          "text": "你好！我是 Qwen3.5，阿里巴巴最新推出的通义千问大语言模型，具备强大的语言理解、逻辑推理、代码生成及多模态处理能力，旨在为用户提供精准高效的智能服务。",
          "type": "output_text"
        }
      ],
      "id": "msg_544b2907-e88e-40d2-9a83-c30d6d1f9xxx",
      "role": "assistant",
      "status": "completed",
      "type": "message"
    }
  ],
  "parallel_tool_calls": false,
  "status": "completed",
  "tool_choice": "auto",
  "tools": [],
  "usage": {
    "input_tokens": 55,
    "input_tokens_details": {
      "cached_tokens": 0
    },
    "output_tokens": 43,
    "output_tokens_details": {
      "reasoning_tokens": 0
    },
    "total_tokens": 98,
    "x_details": [
      {
        "input_tokens": 55,
        "output_tokens": 43,
        "total_tokens": 98,
        "x_billing_type": "response_api"
      }
    ]
  }
}
```

## 接入地址

### 华北2（北京）

- SDK `base_url`：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- HTTP：`POST https://dashscope.aliyuncs.com/compatible-mode/v1/responses`

### 新加坡

- SDK `base_url`：`https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
- HTTP：`POST https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/responses`

将 `{WorkspaceId}` 替换为[业务空间 ID](https://help.aliyun.com/zh/model-studio/obtain-the-app-id-and-workspace-id#d3eb3cd37b7fu)。

### 美国（弗吉尼亚）

- SDK `base_url`：`https://dashscope-us.aliyuncs.com/compatible-mode/v1`
- HTTP：`POST https://dashscope-us.aliyuncs.com/compatible-mode/v1/responses`

### 德国（法兰克福）

- SDK `base_url`：`https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/compatible-mode/v1`
- HTTP：`POST https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/compatible-mode/v1/responses`

将 `{WorkspaceId}` 替换为[Workspace ID](https://help.aliyun.com/zh/model-studio/obtain-the-app-id-and-workspace-id#d3eb3cd37b7fu)。

### 日本（东京）

- SDK `base_url`：`https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1`
- HTTP：`POST https://{WorkspaceId}.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1/responses`

将 `{WorkspaceId}` 替换为[Workspace ID](https://help.aliyun.com/zh/model-studio/obtain-the-app-id-and-workspace-id#d3eb3cd37b7fu)。

> **重要**
>
> 百炼为新加坡地域推出了业务空间专属域名，**能够为推理请求提供卓越的性能和更高的稳定性**，建议迁移至新域名：
>
> - 新加坡地域：从 `https://dashscope-intl.aliyuncs.com` 迁移至 `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com`
>
> 其中 `{WorkspaceId}` 为您的业务空间 ID，可在百炼控制台的**业务空间详情**页面查看。现有域名仍可正常使用。

> OpenAI 兼容 Responses API 的旧版路径 `/api/v2/apps/protocols/compatible-mode/v1/responses` 即将停止维护，请迁移至 `/compatible-mode/v1/responses`。

## HTTP

```http
POST /compatible-mode/v1/responses
Authorization: Bearer $DASHSCOPE_API_KEY
Content-Type: application/json
```

## 请求体参数

### `model`

`string` · **必选** · 模型名称。各地域可用模型列表见[官方文档](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-responses)。

### `input`

**（必选）** 模型输入，支持以下格式：

- `string`：纯文本，如 `"你好"`。

- `array`：消息数组，按对话顺序排列。 **array 输入项类型** **EasyInputMessage** `*object*` 通过 role 区分消息类型，通过content传递消息内容。

**属性**

**role** `*string*` **（必选）** 消息角色，可选值：`user`、`assistant`、`system`、`developer`。 **content** `*string 或 array*` **（必选）** 消息内容。若输入为纯文本，则为 string 类型；若输入为结构化内容数组，则为 array 类型。role 为 `system`/`developer` 时，array 元素类型为 `input_text`；role 为 `user` 时，array 元素类型为 `input_text`、`input_image` 或 `input_file`；role 为 `assistant` 时，array 元素类型为 `output_text`。 > 当前 Responses API 暂不支持传入视频或语音，您可以通过[Chat Completions API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)或[DashScope API](https://help.aliyun.com/zh/model-studio/qwen-api-via-dashscope)传入。 **content 数组元素** **type** `*string*` **（必选）** 可选值：`input_text`（文本输入）、`input_image`（图片输入，仅 user 角色）、`input_file`（文件输入，仅 user 角色，支持 PDF 和图片）、`output_text`（助手回复，仅 assistant 角色）。 **text** `*string*` 文本内容。当 type 为 `input_text` 或 `output_text` 时必填。 **image_url** `*string*` 图片的公网 URL。当 type 为 `input_image` 时必填。 **file_url** `*string*` 文件的公网 URL。当 type 为 `input_file` 时必填。支持 PDF 文件（最大 50 页、100 MB）和图片文件（最大 20 MB）。目前仅 `qwen3.5-ocr` 支持此类型。 **type** `*string*` （可选） 固定为 `message`。 **ResponseOutputMessage** `*object*` （可选） 模型的输出消息对象。可直接将上一轮响应的 output 中的 message 项传回 input，用于多轮对话场景。与 EasyInputMessage 的区别在于它携带了完整的输出结构（含 id、status 和结构化 content）。

**属性**

**type** `*string*` **（必选）** 固定为 `message`。 **id** `*string*` **（必选）** 输出消息的唯一标识，来自上一轮响应。 **role** `*string*` **（必选）** 固定为 `assistant`。 **status** `*string*` **（必选）** 消息状态，可选值：`in_progress`、`completed`、`incomplete`。 **content** `*array*` **（必选）** 内容数组，元素为 output_text 类型对象。

**属性**

**type** `*string*` **（必选）** 固定为 `output_text`。 **text** `*string*` **（必选）** 回复文本。 **annotations** `*array*` （可选） 标注信息。 **Function Call** `*object*` （可选） 模型决定调用外部工具时生成的结构化指令。

**属性**

**type** `*string*` **（必选）** 固定为 `function_call`。 **id** `*string*` （可选） Function Call 的唯一标识，来自上一轮响应。 **name** `*string*` **（必选）** 工具函数名称。 **arguments** `*string*` **（必选）** 工具调用参数，JSON 字符串格式。 **call_id** `*string*` **（必选）** 工具调用的标识符，需与模型返回的 `call_id` 一致。 **status** `*string*` （可选） 状态，可选值：`in_progress`、`completed`、`incomplete`。 **Function Call Output** `*object*` （可选） 工具调用的输出结果。在消息列表中**必须**紧跟对应的 `function_call` 消息，否则会报错。

**属性**

**type** `*string*` **（必选）** 固定为 `function_call_output`。 **id** `*string*` （可选） Function Call Output 的唯一标识。 **call_id** `*string*` **（必选）** 工具调用的标识符，需与模型返回的 `call_id` 一致。 **output** `*string*` **（必选）** 工具函数的执行结果。 **status** `*string*` （可选） 状态，可选值：`in_progress`、`completed`、`incomplete`。 **Reasoning** `*object*` （可选） 模型的思考内容。可直接将上一轮响应的 output 中的 reasoning 项传回 input，用于在多轮对话中传递思考内容。

**属性**

**type** `*string*` **（必选）** 固定为 `reasoning`。 **id** `*string*` **（必选）** 思考内容的唯一标识，来自上一轮响应。 **summary** `*array*` **（必选）** 思考摘要内容。

**属性**

**type** `*string*` **（必选）** 固定为 `summary_text`。 **text** `*string*` **（必选）** 摘要文本。 **status** `*string*` （可选） 状态，可选值：`in_progress`、`completed`、`incomplete`。

### `instructions`

（可选） 作为系统指令插入到上下文的起始位置。使用 `previous_response_id` 时，上一轮指定的 `instructions` 不会传入本轮上下文。

### `conversation`

（可选） 当前响应所属的会话（参考[Conversations API](https://help.aliyun.com/zh/model-studio/openai-compatible-conversations)）。会话中的历史项会自动作为上下文传入本次请求，本次请求的输入和输出也会在响应完成后自动添加到会话中。不能与 `previous_response_id` 同时使用。

### `stream`

（可选）默认值为 `false` 是否开启流式输出。设置为 `true` 时，模型响应数据将实时流式返回给客户端。

### `store`

（可选）默认值为 `true` 是否储存本次会话生成的模型响应。

- `false`：不储存，对话内容不能被 `previous_response_id` 和后续 API 使用。

- `true`：储存，当前模型响应可被 `previous_response_id` 和后续 API 使用。

### `tools`

（可选） 模型在生成响应时可调用的工具数组。支持内置工具和自定义 function 工具，可混合使用。 > 为了获得最佳回复效果，建议同时开启 `code_interpreter`、`web_search` 和 `web_extractor` 工具。

**属性**

**web_search** 联网搜索工具，允许模型搜索互联网上的最新信息。相关文档：[联网搜索](https://help.aliyun.com/zh/model-studio/web-search)

**属性**

**type** `*string*` **（必选）** 固定为`web_search`。 使用示例：`[{"type": "web_search"}]` **web_extractor** 网页抽取工具，允许模型访问并提取网页内容。当前必须配合`web_search`工具一起使用。`qwen3-max`、`qwen3-max-2026-01-23`需要同时开启思考模式。相关文档：[网页抓取](https://help.aliyun.com/zh/model-studio/web-extractor)

**属性**

**type** `*string*` **（必选）** 固定为`web_extractor`。 使用示例：`[{"type": "web_search"}, {"type": "web_extractor"}]` **code_interpreter** 代码解释器工具，允许模型执行代码并返回结果，支持数据分析。`qwen3-max`、`qwen3-max-2026-01-23`、`qwen3.7-max`、`qwen3.7-max-2026-05-20`、`qwen3.7-max-2026-06-08`需要同时开启思考模式。相关文档：[代码解释器](https://help.aliyun.com/zh/model-studio/qwen-code-interpreter)

**属性**

**type** `*string*` **（必选）** 固定为`code_interpreter`。 使用示例：`[{"type": "code_interpreter"}]` **web_search_image** 根据文本描述搜索图片。相关文档：[文搜图](https://help.aliyun.com/zh/model-studio/web-search-image)

**属性**

**type** `*string*` **（必选）** 固定为`web_search_image`。 使用示例：`[{"type": "web_search_image"}]` **image_search** 根据图片搜索相似或相关图片，输入中需要包含图片的URL。相关文档：[图搜图](https://help.aliyun.com/zh/model-studio/image-search)

**属性**

**type** `*string*` **（必选）** 固定为`image_search`。 使用示例：`[{"type": "image_search"}]` **file_search** 在已上传或关联的知识库中搜索。相关文档：[知识检索](https://help.aliyun.com/zh/model-studio/file-search)

**属性**

**type** `*string*` **（必选）** 固定为`file_search`。 **vector_store_ids** `*array*` **（必选）** 要检索的知识库 ID。**当前仅支持传入一个知识库 ID**。 使用示例：`[{"type": "file_search", "vector_store_ids": ["your_knowledge_base_id"]}]` **MCP调用** 通过 MCP（Model Context Protocol）调用外部服务，相关文档：[MCP](https://help.aliyun.com/zh/model-studio/mcp)

**属性**

**type** `*string*` **（必选）** 固定为`mcp`。 **server_protocol** `*string*` **（必选）** 与 MCP 服务的通信协议，如 `"sse"` **server_label** `*string*` **（必选）** 服务标签，用于标识该 MCP 服务。 **server_description** `*string*` （可选） 服务描述，帮助模型理解其功能与适用场景。 **server_url** `*string*` **（必选）** MCP 服务端点的 URL。 **headers** `*object*` （可选） 请求头，用于携带身份验证等信息，如 `Authorization`。 使用示例： `mcp_tool = { "type": "mcp", "server_protocol": "sse", "server_label": "amap-maps", "server_description": "高德地图MCP Server现已覆盖15大核心接口，提供全场景覆盖的地理信息服务，包括生成专属地图、导航到目的地、打车、地理编码、逆地理编码、IP定位、天气查询、骑行路径规划、步行路径规划、驾车路径规划、公交路径规划、距离测量、关键词搜索、周边搜索、详情搜索等。", "server_url": "https://dashscope.aliyuncs.com/api/v1/mcps/amap-maps/sse", "headers": { "Authorization": "Bearer <your-mcp-server-token>" } }` **自定义工具** **function** 自定义函数工具，允许模型调用您定义的函数。当模型判断需要调用工具时，响应会返回 `function_call` 类型的输出。相关文档：[Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling)

**属性**

**type** `*string*` **（必选）** 必须设置为`function`。 **name** `*string*` **（必选）** 工具名称。仅允许字母、数字、下划线（`_`）和短划线（`-`），最长 64 个 Token。 **description** `*string*` **（必选）** 工具描述信息，帮助模型判断何时以及如何调用该工具。 **parameters** `*object*` （可选） 工具的参数描述，需要是一个合法的 [JSON Schema](https://json-schema.org/understanding-json-schema)。若`parameters`参数为空，表示该工具没有入参（如时间查询工具）。 > 为提高工具调用的准确性，建议传入 `parameters`。 使用示例： `[{ "type": "function", "name": "get_weather", "description": "获取指定城市的天气信息", "parameters": { "type": "object", "properties": { "city": { "type": "string", "description": "城市名称" } }, "required": ["city"] } }]`

### `temperature`

（可选） 采样温度，控制模型生成文本的多样性。 temperature越高，生成的文本更多样，反之，生成的文本更确定。 取值范围： [0, 2) temperature与top_p均可以控制生成文本的多样性，建议只设置其中一个值。更多说明，请参见[概述](https://help.aliyun.com/zh/model-studio/text-generation#ad7b336bec5fw)。

### `reasoning`

（可选） 控制模型的思考强度。模型会在回复前进行思考，思考内容将通过 `reasoning` 类型的输出项返回。

**属性**

**effort** `*string*` （可选）：思考强度档位，默认值为 `medium`。

- `none`：关闭思考，直接回答

- `minimal`：最小化思考，最快速响应

- `low`：轻度思考，侧重快速响应

- `medium`（默认值）：中度思考，平衡速度与思考深度

- `high`：深度思考，侧重处理复杂专业问题 > `reasoning.effort` 的优先级高于 `enable_thinking`，建议优先使用 `reasoning.effort`，`enable_thinking` 后续将不再支持。

## 调用示例

### 基础调用（Python）

```python
import os
from openai
import OpenAI
client = OpenAI(
# 若没有配置环境变量，请用百炼API Key将下行替换为：api_key="sk-xxx" api_key=os.getenv("DASHSCOPE_API_KEY"), base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", )
response = client.responses.create( model="qwen3.7-plus", input="你能做些什么？" )
# 获取模型回复
print( response.output_text)
```

### Node.js `import OpenAI from "openai"; const openai = new OpenAI({ // 若没有配置环境变量，请用百炼API Key将下行替换为：apiKey: "sk-xxx" apiKey: process.env.DASHSCOPE_API_KEY, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" }); async function main() { const response = await openai.responses.create({ model: "qwen3.7-plus", input: "你能做些什么？" }); // 获取模型回复 console.log(response.output_text); } main();`（curl）

```bash
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/responses

  -H "Authorization: Bearer $DASHSCOPE_API_KEY"

  -H "Content-Type: application/json"

  -d '{ "model": "qwen3.7-plus", "input": "你能做些什么？" }'
```

### 流式输出（Python）

```python
import os
from openai
import OpenAI
client = OpenAI( api_key=os.getenv("DASHSCOPE_API_KEY"), base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", )
stream = client.responses.create( model="qwen3.7-plus", input="请简单介绍一下人工智能。", stream=True )
print( "开始接收流式输出:")
for event in stream:
if event.type == 'response.output_text.delta':
print( event.delta, end='', flush=True)
elif event.type == 'response.completed':
print( "n流式输出完成")
print( f"总Token数: {event.response.usage.total_tokens}")
```

### Node.js ``import OpenAI from "openai"; const openai = new OpenAI({ apiKey: process.env.DASHSCOPE_API_KEY, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" }); async function main() { const stream = await openai.responses.create({ model: "qwen3.7-plus", input: "请简单介绍一下人工智能。", stream: true }); console.log("开始接收流式输出:"); for await (const event of stream) { if (event.type === 'response.output_text.delta') { process.stdout.write(event.delta); } else if (event.type === 'response.completed') { console.log("n流式输出完成"); console.log(`总Token数: ${event.response.usage.total_tokens}`); } } } main();``（curl）

```bash
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/responses

  -H "Authorization: Bearer $DASHSCOPE_API_KEY"

  -H "Content-Type: application/json"

  --no-buffer

  -d '{ "model": "qwen3.7-plus", "input": "请简单介绍一下人工智能。", "stream": true }'
```

### 多轮对话（Python）

```python
import os
from openai
import OpenAI
client = OpenAI( api_key=os.getenv("DASHSCOPE_API_KEY"), base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", )
# 第一轮对话
response1 = client.responses.create( model="qwen3.7-plus", input="我的名字是张三，请记住。" )
print( f"第一轮回复: {response1.output_text}")
# 第二轮对话 - 使用 previous_response_id 关联上下文，响应id有效期为7天
response2 = client.responses.create( model="qwen3.7-plus", input="你还记得我的名字吗？", previous_response_id=response1.id )
print( f"第二轮回复: {response2.output_text}")` ## Node.js ``import OpenAI
from "openai"; const openai = new OpenAI({ apiKey: process.env.DASHSCOPE_API_KEY, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" }); async function main() { // 第一轮对话 const
response1 = await openai.responses.create({ model: "qwen3.7-plus", input: "我的名字是张三，请记住。" }); console.log(`第一轮回复: ${response1.output_text}`); // 第二轮对话 - 使用 previous_response_id 关联上下文，响应id有效期为7天 const
response2 = await openai.responses.create({ model: "qwen3.7-plus", input: "你还记得我的名字吗？", previous_response_id: response1.id }); console.log(`第二轮回复: ${response2.output_text}`); } main();
```

### 调用内置工具（Python）

```python
import os
from openai
import OpenAI
client = OpenAI( api_key=os.getenv("DASHSCOPE_API_KEY"), base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", )
response = client.responses.create( model="qwen3.7-plus", input="帮我找一下阿里云官网，并提取首页的关键信息",
# 建议同时开启内置工具以取得最佳效果 tools=[ {"type": "web_search"}, {"type": "code_interpreter"}, {"type": "web_extractor"} ], )
# 取消以下注释查看中间过程输出 #
print( response.output)
print( response.output_text)
```

### Node.js ``import OpenAI from "openai"; const openai = new OpenAI({ apiKey: process.env.DASHSCOPE_API_KEY, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" }); async function main() { const response = await openai.responses.create({ model: "qwen3.7-plus", input: "帮我找一下阿里云官网，并提取首页的关键信息", tools: [ { type: "web_search" }, { type: "code_interpreter" }, { type: "web_extractor" } ] }); for (const item of response.output) { if (item.type === "reasoning") { console.log("模型正在思考..."); } else if (item.type === "web_search_call") { console.log(`搜索查询: ${item.action.query}`); } else if (item.type === "web_extractor_call") { console.log("正在抽取网页内容..."); } else if (item.type === "message") { console.log(`回复内容: ${item.content[0].text}`); } } } main();``（curl）

```bash
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/responses

  -H "Authorization: Bearer $DASHSCOPE_API_KEY"

  -H "Content-Type: application/json"

  -d '{ "model": "qwen3.7-plus", "input": "帮我找一下阿里云官网，并提取首页的关键信息", "tools": [ { "type": "web_search" }, { "type": "code_interpreter" }, { "type": "web_extractor" } ], }'
```

### 自定义 Function Call（Python）

```python
from openai
import OpenAI
import json
import os
import random
# 初始化客户端
client = OpenAI(
# 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：api_key="sk-xxx", api_key=os.getenv("DASHSCOPE_API_KEY"), base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", )
# 模拟用户问题 USER_QUESTION = "北京天气咋样"
# 定义工具列表
tools = [ { "type": "function", "name": "get_current_weather", "description": "当你想查询指定城市的天气时非常有用。", "parameters": { "type": "object", "properties": { "location": { "type": "string", "description": "城市或县区，比如北京市、杭州市、余杭区等。", } }, "required": ["location"], }, } ]
# 模拟天气查询工具
def get_current_weather(arguments): weather_conditions = ["晴天", "多云", "雨天"] random_weather = random.choice(weather_conditions) location = arguments["location"] return f"{location}今天是{random_weather}。"
# 封装模型响应函数
def get_response(input_data):
response = client.responses.create( model="qwen3.7-plus", input=input_data, tools=tools, ) return response
# 维护对话上下文 conversation = [{"role": "user", "content": USER_QUESTION}]
response = get_response(conversation) function_calls = [item
for item in response.output
if item.type == "function_call"]
# 如果不需要调用工具，直接输出内容
if not function_calls:
print( f"助手最终回复：{response.output_text}")
else:
# 进入工具调用循环 while function_calls:
for fc in function_calls: func_name = fc.name arguments = json.loads(fc.arguments)
print( f"正在调用工具 [{func_name}]，参数：{arguments}")
# 执行工具 tool_result = get_current_weather(arguments)
print( f"工具返回：{tool_result}")
# 将工具调用和结果成对追加到上下文中 conversation.append( { "type": "function_call", "name": fc.name, "arguments": fc.arguments, "call_id": fc.call_id, } ) conversation.append( { "type": "function_call_output", "call_id": fc.call_id, "output": tool_result, } )
# 携带完整上下文再次调用模型
response = get_response(conversation) function_calls = [ item
for item in response.output
if item.type == "function_call" ]
print( f"助手最终回复：{response.output_text}")` ## Node.js ``import OpenAI
from "openai"; // 初始化客户端 const openai = new OpenAI({ // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx", apiKey: process.env.DASHSCOPE_API_KEY, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", }); // 定义工具列表 const
tools = [ { type: "function", name: "get_current_weather", description: "当你想查询指定城市的天气时非常有用。", parameters: { type: "object", properties: { location: { type: "string", description: "城市或县区，比如北京市、杭州市、余杭区等。", }, }, required: ["location"], }, }, ]; // 模拟天气查询工具 const getCurrentWeather = (args) => { const weatherConditions = ["晴天", "多云", "雨天"]; const randomWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)]; const location = args.location; return `${location}今天是${randomWeather}。`; }; // 封装模型响应函数 const getResponse = async (inputData) => { const
response = await openai.responses.create({ model: "qwen3.7-plus", input: inputData, tools: tools, }); return response; }; const main = async () => { const userQuestion = "北京天气"; // 维护对话上下文 const conversation = [{ role: "user", content: userQuestion }]; let
response = await getResponse(conversation); let functionCalls = response.output.filter( (item) => item.type === "function_call" ); // 如果不需要调用工具，直接输出内容
if (functionCalls.length === 0) { console.log(`助手最终回复：${response.output_text}`); } else { // 进入工具调用循环 while (functionCalls.length > 0) {
for (const fc of functionCalls) { const funcName = fc.name; const args = JSON.parse(fc.arguments); console.log(`正在调用工具 [${funcName}]，参数：`, args); // 执行工具 const toolResult = getCurrentWeather(args); console.log(`工具返回：${toolResult}`); // 将工具调用和结果成对追加到上下文中 conversation.push({ type: "function_call", name: fc.name, arguments: fc.arguments, call_id: fc.call_id, }); conversation.push({ type: "function_call_output", call_id: fc.call_id, output: toolResult, }); } // 携带完整上下文再次调用模型
response = await getResponse(conversation); functionCalls = response.output.filter( (item) => item.type === "function_call" ); } console.log(`助手最终回复：${response.output_text}`); } }; // 启动程序 main().catch(console.error);
```

### 文档理解（Python）

```python
import os
from openai
import OpenAI
client = OpenAI(
# 若没有配置环境变量，请用百炼API Key将下行替换为：api_key="sk-xxx" api_key=os.getenv("DASHSCOPE_API_KEY"), base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", )
response = client.responses.create( model="qwen3.5-ocr", input=[ { "role": "user", "content": [ { "type": "input_file", "file_url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260616/qmycjl/1506.02640v5.pdf", }, { "type": "input_text", "text": "Read all the text in the file.", }, ], } ], extra_body={ "ocr_options": {} }, )
print( response.output_text)
```

### **Node.js** `import OpenAI from 'openai'; const client = new OpenAI({ // 若没有配置环境变量，请用百炼API Key将下行替换为：apiKey: "sk-xxx" apiKey: process.env.DASHSCOPE_API_KEY, baseURL: "https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", }); async function main() { const response = await client.responses.create({ model: "qwen3.5-ocr", input: [{ role: "user", content: [{ type: "input_file", file_url: "https://example.com/your-document.pdf" }] }], ocr_options: { task: "document_parsing" } }); // 获取定制任务结果 console.log(response.output[0].content[0].ocr_result); } main();`（curl）

```bash
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/responses

  -H "Authorization: Bearer $DASHSCOPE_API_KEY"

  -H "Content-Type: application/json"

  -d '{ "model": "qwen3.5-ocr", "input": [ { "role": "user", "content": [ { "type": "input_file", "file_url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260616/qmycjl/1506.02640v5.pdf" }, { "type": "input_text", "text": "Read all the text in the file." } ] } ], "ocr_options": {} }'
```

### Session 缓存（Python）

```python
import os
from openai
import OpenAI
client = OpenAI( api_key=os.getenv("DASHSCOPE_API_KEY"), base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
# 通过 default_headers 开启 Session 缓存 default_headers={"x-dashscope-session-cache": "enable"} )
# 构造超过 1024 Token 的长文本，确保能触发缓存创建（若未达到1024 Token，后续累积对话上下文超过1024 Token时将触发缓存创建）
long_context = "人工智能是计算机科学的一个重要分支，致力于研究和开发能够模拟、延伸和扩展人类智能的理论、方法、技术及应用系统。" * 50
# 第一轮对话
response1 = client.responses.create( model="qwen3.7-plus", input=long_context + "nn基于以上背景知识，请简短介绍机器学习中的随机森林算法。", )
print( f"第一轮回复: {response1.output_text}")
# 第二轮对话：通过 previous_response_id 关联上下文，缓存由服务端自动处理
response2 = client.responses.create( model="qwen3.7-plus", input="它和 GBDT 有什么主要区别？", previous_response_id=response1.id, )
print( f"第二轮回复: {response2.output_text}")
# 查看缓存命中情况 usage = response2.usage
print( f"输入 Token: {usage.input_tokens}")
print( f"缓存命中 Token: {usage.input_tokens_details.cached_tokens}")
```

### Node.js ``import OpenAI from "openai"; const openai = new OpenAI({ apiKey: process.env.DASHSCOPE_API_KEY, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", // 通过 defaultHeaders 开启 Session 缓存 defaultHeaders: {"x-dashscope-session-cache": "enable"} }); // 构造超过 1024 Token 的长文本，确保能触发缓存创建（若未达到1024 Token，后续累积对话上下文超过1024 Token时将触发缓存创建） const longContext = "人工智能是计算机科学的一个重要分支，致力于研究和开发能够模拟、延伸和扩展人类智能的理论、方法、技术及应用系统。".repeat(50); async function main() { // 第一轮对话 const response1 = await openai.responses.create({ model: "qwen3.7-plus", input: longContext + "nn基于以上背景知识，请简短介绍机器学习中的随机森林算法，包括基本原理和应用场景。" }); console.log(`第一轮回复: ${response1.output_text}`); // 第二轮对话：通过 previous_response_id 关联上下文，缓存由服务端自动处理 const response2 = await openai.responses.create({ model: "qwen3.7-plus", input: "它和 GBDT 有什么主要区别？", previous_response_id: response1.id }); console.log(`第二轮回复: ${response2.output_text}`); // 查看缓存命中情况 console.log(`输入 Token: ${response2.usage.input_tokens}`); console.log(`缓存命中 Token: ${response2.usage.input_tokens_details.cached_tokens}`); } main();``（curl）

```bash
# 第一轮对话 # 长文本重复 50 次以确保超过 1024 Token，触发缓存创建 curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/responses

  -H "Authorization: Bearer $DASHSCOPE_API_KEY"

  -H "Content-Type: application/json"

  -H "x-dashscope-session-cache: enable"

  -d '{ "model": "qwen3.7-plus", "input": "人工智能是计算机科学的一个重要分支..." }' # 第二轮对话 - 使用上一轮返回的 id 作为 previous_response_id curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/responses

  -H "Authorization: Bearer $DASHSCOPE_API_KEY"

  -H "Content-Type: application/json"

  -H "x-dashscope-session-cache: enable"

  -d '{ "model": "qwen3.7-plus", "input": "它和 GBDT 有什么主要区别？", "previous_response_id": "第一轮返回的响应id" }'
```

## 响应对象（Response）

### `item`

输出项对象。出现在 `response.output_item.added` 和 `response.output_item.done` 事件中。在 `added` 事件中为初始骨架（content 为空数组），在 `done` 事件中为完整对象。

**属性**

**id** `*string*` 输出项的唯一标识符（如 `msg_xxx`）。 **type** `*string*` 输出项类型。枚举值：`message`（消息）、`reasoning`（推理）、`web_search_call`（搜索）、`web_search_image_call`（文搜图）、`image_search_call`（图搜图）、`mcp_call`（MCP 调用）、`file_search_call`（知识库搜索）。 **role** `*string*` 消息角色，固定为 `assistant`。仅当 type 为 `message` 时存在。 **status** `*string*` 生成状态。在 `added` 事件中为 `in_progress`，在 `done` 事件中为 `completed`。 **content** `*array*` 消息内容数组。在 `added` 事件中为空数组 `[]`，在 `done` 事件中包含完整的内容块对象（结构与 `part` 对象相同）。

### `part`

内容块对象。出现在 `response.content_part.added` 和 `response.content_part.done` 事件中。

**属性**

**type** `*string*` 内容块类型，固定为 `output_text`。 **text** `*string*` 文本内容。在 `added` 事件中为空字符串，在 `done` 事件中为完整文本。 **annotations** `*array*` 文本注释数组。通常为空数组。 **logprobs** `\*object

### `delta`

增量文本内容。出现在 `response.output_text.delta` 事件中，包含本次新增的文本片段。客户端应将所有 `delta` 拼接以获得完整文本。

### `text`

完整文本内容。出现在 `response.output_text.done` 事件中，包含该内容块的完整文本，可用于校验 `delta` 拼接结果。

## 流式事件（SSE chunk）

流式输出返回一系列 JSON 对象。每个对象包含 `type` 字段标识事件类型，`sequence_number` 字段标识事件顺序。`response.completed` 事件标志着流式传输的结束。

流式客户端主要消费 `response.output_text.delta` 的 `delta` 字段。

### `id`

本次响应的唯一标识符，为 UUID 格式的字符串，有效期为7天。可用于 `previous_response_id` 参数以创建多轮对话。

### `object`

对象类型，固定为 `response`。

### `status`

响应生成的状态。枚举值：

- `completed`：生成完成

- `failed`：生成失败

- `in_progress`：生成中

- `cancelled`：已取消

- `queued`：请求排队中

- `incomplete`：生成不完整

### `model`

用于生成响应的模型 ID。

### `output`

模型生成的输出项数组。数组中的元素类型和顺序取决于模型的响应。

**数组元素属性**

**type** `*string*` 输出项类型。枚举值：

- `message`：消息类型，包含模型最终生成的回复内容。

- `reasoning`：推理类型，设置 `reasoning.effort`（非 `none`）或开启思考模式时返回。推理 Token 会被计入 `output_tokens_details.reasoning_tokens` 中，按推理 Token 计费。

- `function_call`：函数调用类型，使用自定义 `function` 工具时返回。需要处理函数调用并返回结果。

- `web_search_call`：搜索调用类型，使用 `web_search` 工具时返回。

- `code_interpreter_call`：代码执行类型，使用 `code_interpreter` 工具时返回。

- `web_extractor_call`：网页抽取类型，使用 `web_extractor` 工具时返回。需要配合 `web_search` 工具一起使用。

- `web_search_image_call`：文搜图调用类型，使用 `web_search_image` 工具时返回。包含搜索到的图片列表。

- `image_search_call`：图搜图调用类型，使用 `image_search` 工具时返回。包含搜索到的相似图片列表。

- `mcp_call`：MCP 调用类型，使用 `mcp` 工具时返回。包含 MCP 服务的调用结果。

- `file_search_call`：知识库搜索调用类型，使用 `file_search` 工具时返回。包含知识库的检索查询和结果。 **id** `*string*` 输出项的唯一标识符。所有类型的输出项都包含此字段。 **role** `*string*` 消息角色，固定为 `assistant`。仅当 `type` 为 `message` 时存在。 **status** `*string*` 输出项状态。可选值：`completed`（完成）、`in_progress`（生成中）。当 `type` 不为`reasoning`时存在。 **name** `*string*` 工具或函数名称。当 `type` 为 `function_call`、`web_search_image_call`、`image_search_call`、`mcp_call` 时存在。 对于 `web_search_image_call` 和 `image_search_call`，值分别固定为 `"web_search_image"` 和 `"image_search"`。 对于 `mcp_call`，值为 MCP 服务中被调用的具体函数名（如 `amap-maps-maps_geo`）。 **arguments** `*string*` 工具调用的参数，JSON 字符串格式。当 `type` 为 `function_call`、`web_search_image_call`、`image_search_call`、`mcp_call` 时存在。使用前需要通过 `JSON.parse()` 解析。不同工具类型的 arguments 内容：

- `web_search_image_call`：`{"queries": ["搜索关键词1", "搜索关键词2"]}`，其中 `queries` 为模型根据用户输入自动生成的搜索关键词列表。

- `image_search_call`：`{"img_idx": 0, "bbox": [0, 0, 1000, 1000]}`，其中 `img_idx` 为输入图片的索引（从 0 开始），`bbox` 为搜索区域的边界框坐标 [x1, y1, x2, y2]，坐标范围 0-1000。

- `function_call`：按用户定义的函数参数 schema 生成的参数对象。

- `mcp_call`：MCP 服务中被调用函数的参数对象。 **call_id** `*string*` 函数调用的唯一标识符。仅当 `type` 为 `function_call` 时存在。在返回函数调用结果时，需要通过此 ID 关联请求与响应。 **content** `*array*` 消息内容数组。仅当 `type` 为 `message` 时存在。

**数组元素属性**

**type** `*string*` 内容类型，固定为 `output_text`。 **text** `*string*` 模型生成的文本内容。 **annotations** `*array*` 文本注释数组。通常为空数组。 **summary** `*array*` 推理摘要数组。仅当 `type` 为 `reasoning` 时存在。每个元素包含 `type`（值为 `summary_text`）和 `text`（摘要文本）字段。 **action** `*object*` 搜索动作信息。仅当 `type` 为 `web_search_call` 时存在。

**属性**

**query** `*string*` 搜索查询关键词。 **type** `*string*` 搜索类型，固定为 `search`。 **sources** `*array*` 搜索来源列表。每个元素包含 `type`和 `url`字段。 **code** `*string*` 模型生成并执行的代码。仅当 `type` 为 `code_interpreter_call` 时存在。 **outputs** `*array*` 代码执行输出数组。仅当 `type` 为 `code_interpreter_call` 时存在。每个元素包含 `type`（值为 `logs`）和 `logs`（代码执行日志）字段。 **container_id** `*string*` 代码解释器容器标识符。仅当 `type` 为 `code_interpreter_call` 时存在。用于关联同一会话中的多次代码执行。 **goal** `*string*` 抽取目标描述，说明需要从网页中提取哪些信息。仅当 `type` 为 `web_extractor_call` 时存在。 **output** `*string*` 工具调用的输出结果，字符串格式。

- 当 `type` 为 `web_extractor_call` 时为网页抽取的内容摘要

- 当 `type` 为 `web_search_image_call` 或 `image_search_call` 时为 JSON 字符串，包含图片搜索结果数组，每个元素包含 `title`（图片标题）、`url`（图片 URL）和 `index`（序号）字段

- 当 `type` 为 `mcp_call` 时为 MCP 服务返回的 JSON 字符串结果。 **urls** `*array*` 被抽取的网页 URL 列表。仅当 `type` 为 `web_extractor_call` 时存在。 **server_label** `*string*` MCP 服务标签。仅当 `type` 为 `mcp_call` 时存在。标识本次调用所使用的 MCP 服务。 **queries** `*array*` 知识库检索使用的查询列表。仅当 `type` 为 `file_search_call` 时存在。数组元素为字符串，表示模型生成的搜索查询词。 **results** `*array*` 知识库检索结果数组。仅当 `type` 为 `file_search_call` 时存在。

**数组元素属性**

**file_id** `*string*` 匹配文档的文件 ID。 **filename** `*string*` 匹配文档的文件名。 **score** `*float*` 匹配相关度评分，取值范围 0-1，值越大表示相关度越高。 **text** `*string*` 匹配到的文档内容片段。

### `usage`

本次请求的 Token 消耗信息。

**属性**

**input_tokens** `*integer*` 输入的 Token 数。[补充说明](https://help.aliyun.com/zh/model-studio/text-generation#9003ed2e410ni) **output_tokens** `*integer*` 模型输出的 Token 数。 **total_tokens** `*integer*` 消耗的总 Token 数，为 input_tokens 与 output_tokens 的总和。 **input_tokens_details** `*object*` 输入 Token 的细粒度分类。

**属性**

**cached_tokens** `*integer*` 命中缓存的 Token 数。详情请参见[上下文缓存](https://help.aliyun.com/zh/model-studio/context-cache)。 **output_tokens_details** `*object*` 输出 Token 的细粒度分类。

**属性**

**reasoning_tokens** `*integer*` 思考过程 Token 数。 **x_details** `*array*` 本次请求的计费明细数组。比顶级 `usage` 字段提供更细粒度的多模态 Token 拆分。

**属性**

**input_tokens** `*integer*` 输入的 Token 数。[补充说明](https://help.aliyun.com/zh/model-studio/text-generation#9003ed2e410ni) **output_tokens** `*integer*` 模型输出的 Token 数。 **total_tokens** `*integer*` 消耗的总 Token 数，为 input_tokens 与 output_tokens 的总和。 **x_billing_type** `*string*` 固定为`response_api`。 **image_tokens** `*integer*` 图像输入的 Token 数。包含图像输入时返回，等同于 `input_tokens_details.image_tokens`。 **input_tokens_details** `*object*` 输入 Token 的细粒度分类。多模态输入时返回，目前仅区分 `text_tokens` 与 `image_tokens`，不返回视频/音频 Token 拆分。

**属性**

**text_tokens** `*integer*` 文本输入的 Token 数。 **image_tokens** `*integer*` 图像输入的 Token 数。 **output_tokens_details** `*object*` 输出 Token 的细粒度分类。比顶级 `output_tokens_details` 多 `text_tokens` 字段（多模态输入时返回）。

**属性**

**reasoning_tokens** `*integer*` 思考过程 Token 数。 **text_tokens** `*integer*` 文本输出的 Token 数。多模态输入时返回。 **plugins** `*object*` 内置工具调用统计。使用内置工具（如 `web_search`）时返回，与顶级 `x_tools` 字段内容相同。

**属性**

**web_search** `*object*` 联网搜索调用统计。

**属性**

**count** `*integer*` 本次响应中联网搜索的调用次数。 **prompt_tokens_details** `*object*` 输入 Token 的缓存详情。启用 Session 缓存后返回；含图像输入但未命中缓存时可能返回空对象。

**属性**

**cached_tokens** `*integer*` 命中缓存的 Token 数。 **cache_creation_input_tokens** `*integer*` 本次请求新创建缓存的 Token 数。 **cache_creation** `*object*` 缓存创建详情。

**属性**

**ephemeral_5m_input_tokens** `*integer*` 5 分钟临时缓存新创建的 Token 数。 **cache_type** `*string*` 缓存类型，固定为`ephemeral`。 **x_tools** `*object*` 工具使用统计信息。当使用内置工具时，包含各工具的调用次数。 示例：`{"web_search": {"count": 1}}`

### `error`

当模型生成响应失败时返回的错误对象。成功时为 `null`。

### `type`

事件类型标识符。枚举值：

- `response.created`：响应创建时触发，状态为 `queued`。

- `response.in_progress`：响应开始处理时触发，状态变为 `in_progress`。

- `response.output_item.added`：新的输出项（如 message、`web_extractor_call`）被添加到 output 数组时触发。当 `item.type` 为 `web_extractor_call` 时，表示网页抽取工具调用开始。

- `response.content_part.added`：输出项的 content 数组中新增内容块时触发。

- `response.output_text.delta`：增量文本生成时触发，多次触发，`delta` 字段包含新增文本片段。

- `response.output_text.done`：文本生成完成时触发，`text` 字段包含完整文本。

- `response.content_part.done`：内容块完成时触发，`part` 对象包含完整内容块。

- `response.output_item.done`：输出项生成完成时触发，`item` 对象包含完整输出项。当 `item.type` 为 `web_extractor_call` 时，表示网页抽取工具调用完成。

- `response.reasoning_summary_text.delta`：（开启思考模式时）推理摘要增量文本，`delta` 字段包含新增摘要片段。

- `response.reasoning_summary_text.done`：（开启思考模式时）推理摘要完成，`text` 字段包含完整摘要。

- `response.web_search_call.in_progress` / `searching` / `completed`：（使用 web_search 工具时）搜索状态变化事件。

- `response.code_interpreter_call.in_progress` / `interpreting` / `completed`：（使用 code_interpreter 工具时）代码执行状态变化事件。

- **注意：**使用 `web_extractor` 工具时，没有专门的事件类型标识符。网页抽取工具调用通过通用的 `response.output_item.added` 和 `response.output_item.done` 事件传递，通过 `item.type` 字段（值为 `web_extractor_call`）来识别。

- `response.mcp_call_arguments.delta` / `response.mcp_call_arguments.done`：（使用 mcp 工具时）MCP 调用参数的增量和完成事件。

- `response.mcp_call.completed`：（使用 mcp 工具时）MCP 服务调用完成。

- `response.file_search_call.in_progress` / `searching` / `completed`：（使用 file_search 工具时）知识库搜索状态变化事件。

- **注意：**使用 `web_search_image` 和 `image_search` 工具时，没有专门的中间状态事件。工具调用通过 `response.output_item.added`（调用开始）和 `response.output_item.done`（调用完成）事件传递。

- `response.completed`：响应生成完成时触发，`response` 对象包含完整响应（含 usage）。此事件标志流式传输结束。
