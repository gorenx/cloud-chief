# ai-gateway-proxy

English | [简体中文](README.zh-CN.md)

Production Cloudflare Worker for authenticated model traffic. It verifies the user JWT, applies entitlement and quota policy from `@cloud-chief/gateway-core`, selects the server-authoritative model, and forwards Chat Completions or Responses requests through Cloudflare AI Gateway.

The forwarding boundary is provider-oriented, but the current built-in adapter still uses a DashScope-named secret and compatible paths. Treat those names as implementation-specific until a provider-neutral adapter contract replaces them.

API reference: [`API.md`](API.md). Integration guide: [`../doc/ai-gateway-worker.md`](../doc/ai-gateway-worker.md).

## Routes

- `GET /health` — public health check.
- `POST /v1/chat/completions` — authenticated Chat Completions proxy.
- `POST /v1/responses` — authenticated Responses proxy.

## Development and deployment

```bash
cp .dev.vars.example .dev.vars
pnpm install
pnpm dev
pnpm test
pnpm deploy
```

Runtime variables belong in `wrangler.toml`. Store gateway credentials, the current adapter's `DASHSCOPE_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as secrets. Configure `SUPABASE_JWT_SECRET` only for legacy HS256 projects.

RevenueCat synchronization is owned by [`../worker-revenuecat/`](../worker-revenuecat/); this Worker only reads the resulting entitlement state.
