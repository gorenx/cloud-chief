# Qwen × Cloudflare AI Gateway

把阿里云 MaaS 的千问模型（**Responses API**）接入 Cloudflare AI Gateway，借助网关获得日志、缓存、限流、可观测性等能力。同时提供一个支持**真流式逐字输出**的本地聊天 Web 页面。

上游端点（你的业务空间专属域名）：

```
https://ws-3mll18ey04t6yc61.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/responses
```

由于该路径是 `/compatible-mode/v1/...`（非标准的 `/v1/...`），所以采用 AI Gateway 的 **自定义提供商（Custom Provider）+ 提供商专用端点**接入。

> 用的是阿里云 **Responses API**（`/responses`，请求用 `input`、响应在 `output[].content[].text`、支持 SSE 流式），不是 `/chat/completions`。

## 项目结构

| 目录 / 文件 | 作用 |
| --- | --- |
| `admin/` | **配置 / 管理服务**（TypeScript + Hono）：管理网关 / 提供商 / BYOK，部署 Worker，本地聊天调试页。详见 [admin/README.md](admin/README.md) |
| `worker/` | **生产边缘代理**（Cloudflare Worker，TS + Hono + jose）：验 Supabase JWT 后转发到 AI Gateway。详见 [worker/README.md](worker/README.md) |
| `setup.sh` | （可选，CLI）创建/更新自定义提供商并确保网关存在（读 `admin/.env`） |
| `test.sh` | （可选，CLI）用 curl 验证链路（读 `admin/.env`） |
| `admin.sh` / `admin/run.sh` | 一键安装依赖、开发或生产启动配置后台 |

两条调用路径：

- **生产**：应用带 Supabase `access_token` → `worker/`（边缘验签 + 持密钥）→ AI Gateway → 阿里云。
- **运维 / 本地**：浏览器 → `admin/` 配置后台（管理资源、部署 Worker、本地聊天调试）。

## 可视化配置后台（推荐）

```bash
./admin.sh           # 或 cd admin && ./run.sh
# 浏览器打开 http://localhost:5173 ，在「设置」页填入 ADMIN_TOKEN
```

生产 / 内网：`./admin.sh start` → http://127.0.0.1:8787

后台可以做：

- **网关 Gateways**：查看列表、一键开关 `authentication`、创建命名网关。
- **自定义提供商 Custom Providers**：查看 / 新建 / 删除（base_url 只填根域名）。
- **BYOK 存储密钥**：选网关后查看 / 新建 / 删除 provider 密钥（直接填 DashScope Key）。
- **聊天调试 Playground**：直连 Gateway 或经 Worker（本地 `:8788` / 线上 workers.dev）；Supabase OAuth 向导配置项目与测试账号。
- **Worker 部署**：查看 wrangler 状态、对比 CF 已部署 vars、编辑 `wrangler.toml`、设置 secret、一键 `wrangler deploy`（实时日志）。

> ⚠️ **服务已加鉴权**：所有 `/admin/*` 接口需要 `.env` 里的 `ADMIN_TOKEN`，服务默认只绑 `127.0.0.1`。
>
> ⚠️ **Token 权限**：配置后台用 `.env` 里的 `CF_API_TOKEN` 调 Cloudflare API。
> - 管理网关 / 提供商：需要 `AI Gateway - Edit`。
> - 管理 **BYOK 存储密钥**：还需要 `Secrets Store - Edit`（否则保存密钥会报 Authentication error）。
> - **部署 Worker**：依赖本机 `wrangler login` 或 `CLOUDFLARE_API_TOKEN`（Workers Scripts - Edit），与上面是不同 token。
>
> **BYOK 关键规则**：存储密钥的 `provider_slug` 必须等于你自定义提供商的 slug（即请求 URL 里 `custom-` 后面那个）。配好后请求可去掉 `Authorization` 头，只留 `cf-aig-authorization`。

## 前置条件

- Node.js 18+；推荐安装 pnpm（`admin/` 未装 pnpm 时脚本会回退 npm）
- `curl`、`python3`（运行可选 CLI 脚本）
- 一个 Cloudflare 账号，以及权限为 **AI Gateway - Edit** 的 API Token
- 阿里云 DashScope / 百炼 的 API Key

## 使用步骤

### 1. 配置

```bash
cp admin/.env.example admin/.env
# 编辑 admin/.env，至少填写：
#   CF_ACCOUNT_ID、CF_API_TOKEN、DASHSCOPE_API_KEY
```

### 2. 在 Cloudflare 上创建自定义提供商

```bash
chmod +x setup.sh test.sh
./setup.sh
```

成功后会打印出网关调用地址，形如：

```
https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/custom-qwen-maas/compatible-mode/v1/chat/completions
```

### 3. 命令行验证

```bash
./test.sh
./test.sh "用 Python 写一个快速排序"
```

### 4. 启动配置后台 / 聊天页面

```bash
./admin.sh              # 开发：http://localhost:5173
./admin.sh start        # 生产：http://127.0.0.1:8787
```

**Playground 经 Worker 调试**（可选）：

1. `admin/.env` 配置 `SUPABASE_OAUTH_*`（Organization OAuth App）与 `ADMIN_TOKEN`
2. Playground 切到「经 Worker」→ 侧栏完成 Supabase 向导（或手动配置 `SUPABASE_*` + `worker/wrangler.toml`）
3. 顶栏选「本地 Worker」，点击「启动本地 Worker」或于 `worker/` 执行 `pnpm dev`（默认 `:8788`）
4. `GET /health` 通过后发送消息

## 直接用 OpenAI SDK 调用（可选）

配置好自定义提供商后，也可以在任意代码里直接用 OpenAI SDK 的 Responses 接口：

```python
from openai import OpenAI

client = OpenAI(
    api_key="<DASHSCOPE_API_KEY>",              # 阿里云的 Key
    base_url="https://gateway.ai.cloudflare.com/v1/<account_id>/qwen-gw/custom-qwen-beijing-maas/compatible-mode/v1",
    default_headers={
        "cf-aig-authorization": "Bearer <CF_AIG_TOKEN>",  # 网关开启鉴权时必填
    },
)

resp = client.responses.create(
    model="qwen3-max",
    input="你好",
)
print(resp.output_text)
```

> SDK 会自动在 `base_url` 后拼接 `/responses`，所以 `base_url` 结尾写到 `/compatible-mode/v1` 即可。
> 多轮对话可传 `previous_response_id`，或每轮把完整消息数组作为 `input` 传入。

## 实测要点（重要）

经实测，针对这个业务空间专属端点：

1. **模型名**：Responses API **不支持无版本的 `qwen-max`**（会报 `Unsupported model`）。可用：`qwen3-max`、`qwen3.7-max`、`qwen-plus`、`qwen-flash` 等。默认用 `qwen3-max`。
2. **请求/响应格式**（Responses API）：
   - 请求体用 `input`（字符串或消息数组），不是 `messages`。
   - 非流式响应在 `output[]` 里 `type=message` 的 `content[].text`。
   - 流式是标准 SSE：`response.output_text.delta`（增量 `delta`）→ `response.completed`（结束）。Web 页面据此做逐字渲染。
3. **网关不要用 `default`**：账号默认网关 `default` 的 `authentication` 无法稳定关闭，会间歇 `401 AiGatewayError`。本项目改用专属命名网关 `qwen-gw`。

## 鉴权说明

AI Gateway 不替你管理上游鉴权，请求需要两个头：

- `Authorization: Bearer <DASHSCOPE_API_KEY>` —— 上游（阿里云）必需。
- `cf-aig-authorization: Bearer <CF_AIG_TOKEN>` —— 当网关开启 Authenticated Gateway 时必需。

`setup.sh` 会根据 `admin/.env` 的 `CF_AIG_TOKEN` 自动处理网关 `authentication`：

- 填了 `CF_AIG_TOKEN` → 开启网关鉴权（更安全），请求自动带上该令牌。
- 留空 `CF_AIG_TOKEN` → 关闭网关鉴权（上游仍有 DashScope Key 保护）。

## 安全提示

- `.env` 含密钥，切勿提交到 git（见 `.gitignore`）。
- 配置后台（`admin/`）默认只绑 `127.0.0.1`，`/admin/*` 接口需 `ADMIN_TOKEN`。
- 生产聊天走 `worker/`：密钥放 Worker Secret，应用只持有自己的 Supabase token，拿不到上游密钥。
