# Cloud Chief Auth Worker

[English](README.md) | 简体中文

基于 Better Auth、Cloudflare Worker 和 D1 的认证服务，提供邮箱密码登录、会话 Cookie、JWT/JWKS、OAuth Provider，以及可选的 Google/GitHub 社交登录。

## 本地启动

```bash
pnpm install
pnpm --filter cloud-chief-auth-worker run db:create
pnpm --filter cloud-chief-auth-worker run db:migrate:local
pnpm --filter cloud-chief-auth-worker dev
```

将 D1 `database_id` 写入 `auth-worker/wrangler.toml`，并把 `BETTER_AUTH_SECRET` 放入本地 `.dev.vars` 或生产 Worker Secret。默认本地地址为 `http://localhost:8790`。

Web 应用通过 `/api/auth/*` 完成注册、登录、登出和 token 获取；跨域 Cookie 请求必须使用 `credentials: "include"`。其他服务可通过 `/api/auth/jwks` 验证签发的 JWT。

生产部署前应配置可信来源、OAuth redirect URI、强随机密钥，并执行远端 D1 migration。完整端点和示例见英文文档。
