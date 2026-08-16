# Admin API reference

English | [简体中文](api.zh-CN.md)

Base URL in the production-style local process: `http://127.0.0.1:8787`.

## Authentication

All `/admin/*` routes require `Authorization: Bearer <ADMIN_TOKEN>`. Health, runtime configuration, and playground proxy routes are public at the HTTP layer and therefore must remain behind the Admin deployment boundary.

## Public and playground routes

- `GET /health` — process health.
- `GET /config` — redacted playground models, gateways, routing, and Worker runtime state.
- `POST /api/chat` — direct Cloudflare AI Gateway chat proxy; supports streaming.
- `GET /api/worker-chat/health` — selected Worker health.
- `GET /api/worker-chat/info` — redacted selected-Worker context.
- `POST /api/worker-chat` — Worker-backed chat proxy.

## Management routes

- `/admin/state`, `/admin/gateways`, `/admin/providers`, `/admin/keys` — Cloudflare AI Gateway resources and cached state.
- `/admin/worker/*` — project discovery, status, vars, local secret metadata, development process, deployment, and Workers Builds operations.
- `/admin/supabase/*` — OAuth connection, projects, local test credentials, migration browsing, status, and application.

Successful JSON responses use the shape defined by the route. Errors use an appropriate HTTP status and a JSON `error` message; streaming deployment and chat routes report terminal errors within their SSE protocol when headers have already been sent.

The endpoint-level request and response examples remain in [`api.zh-CN.md`](api.zh-CN.md). Keep route additions synchronized in both files.
