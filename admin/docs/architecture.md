# Admin architecture

English | [简体中文](architecture.zh-CN.md)

## Layers

```text
React SPA -> Hono API -> application services -> Cloudflare/Supabase clients
                              |              -> local Wrangler processes/files
                              +-------------> SQLite snapshots and audit data
```

- The browser renders operational state and sends the Admin token on management requests.
- Hono owns authentication, validation, routing, static production assets, and SSE responses.
- Integration modules call Cloudflare, Supabase, or Wrangler; route handlers do not duplicate provider logic.
- SQLite stores local configuration, remote snapshots, synchronization runs, and operation events.

## Runtime modes

- Development: Vite on `:5173` proxies the Hono API on `:8787`.
- Production-style: Hono on `:8787` serves `web/dist` and the API.

## Trust boundaries

`/admin/*` requires `Authorization: Bearer <ADMIN_TOKEN>`. Public playground endpoints are intended for a loopback or otherwise protected deployment. Gateway, model-provider, Supabase, and Worker deployment credentials never belong in browser storage.

The architecture owns provider discovery, route resolution, and secret boundaries. The current model catalog and direct-playground credential name are Qwen/DashScope-specific implementation details, not constraints on the control-plane design.

## External boundaries

- Cloudflare is authoritative for gateways, providers, BYOK keys, D1 databases, and deployed Workers.
- Supabase is authoritative for organizations, projects, and database state.
- Worker project files are authoritative for local Wrangler configuration.
- SQLite is authoritative only for Admin-owned preferences, indexes, snapshots, and audit records.

Tests live under `admin/test/`; frontend and backend builds are checked through the package scripts.
