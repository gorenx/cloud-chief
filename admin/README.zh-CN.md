# aigateway-admin

[English](README.md) | 简体中文

基于 Hono、React 和 Vite 的本地/内网运维控制台。它管理 Cloudflare AI Gateway 资源，通过本机 Wrangler 部署 Worker，连接 Supabase 项目，并提供直连 Gateway 与经 Worker 两种 Playground 调试路径。

详细设计和 API 文档见 [`docs/`](docs/README.zh-CN.md)。

## 开发

```bash
cp .env.example .env
./run.sh
```

React UI 位于 `http://localhost:5173`，Hono API 位于 `http://127.0.0.1:8787`。在设置页填写已配置的 `ADMIN_TOKEN`。

以生产方式构建并启动：

```bash
./run.sh start
```

## 配置边界

- `admin/.env`：Admin 进程、Cloudflare 管理 API、Playground 和 Supabase 连接配置。
- Worker `wrangler.toml`：非敏感运行时变量。
- Worker `.dev.vars` 与 Cloudflare Worker Secret：本地和线上密钥。
- `ADMIN_TOKEN`：所有 `/admin/*` 端点的访问令牌。

服务默认只监听回环地址。内网部署应增加强令牌、TLS 和 IP 白名单或身份感知访问策略。

## 检查

```bash
pnpm test
pnpm build
```
