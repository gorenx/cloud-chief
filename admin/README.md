# aigateway-admin

English | [简体中文](README.zh-CN.md)

Local or private-network operations console built with Hono, React, and Vite. It manages Cloudflare AI Gateway resources, deploys Worker projects through the local Wrangler installation, connects Supabase projects, and provides direct-Gateway and Worker-backed playground modes.

Detailed design and API documentation: [`docs/`](docs/README.md).

## Development

```bash
cp .env.example .env
./run.sh
```

The React UI runs at `http://localhost:5173`; the Hono API runs at `http://127.0.0.1:8787`. Enter the configured `ADMIN_TOKEN` on the Settings page.

For a production-style local process:

```bash
./run.sh start
```

## Configuration boundaries

- `admin/.env`: Admin process, Cloudflare management API, playground, and Supabase connection settings.
- Worker `wrangler.toml`: non-secret Worker runtime variables.
- Worker `.dev.vars` and Cloudflare Worker secrets: local and deployed secrets.
- `ADMIN_TOKEN`: required by all `/admin/*` endpoints.

The service binds to loopback by default. For private-network deployment, use a strong token, TLS, and an IP or identity-aware access policy.

## Checks

```bash
pnpm test
pnpm build
```
