# Cloud Chief — Local Infrastructure for One-Person Companies

English | [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Cloud Chief is a local infrastructure console for one-person company (OPC) projects. It keeps service configuration, deployment, operations, status checks, and troubleshooting in one place. Business applications use the deployed APIs without carrying cloud credentials or maintaining separate operations scripts.

The repository currently integrates Cloudflare, Supabase, and RevenueCat, with deployable authentication, AI proxy, entitlement, and quota components. This is the feature set needed by current OPC projects, not a fixed roadmap. Future integrations should follow actual product needs.

## Current features

**Available** means the code path exists. **Partial** means the implementation works but is still tied to a particular platform or adapter. **Not implemented** marks a design direction only. None of these statuses implies acceptance in a live cloud environment.

### Local Admin

| Feature | What it does | Status |
| --- | --- | --- |
| Admin login | Protects the local UI and management API | Available, automated tests |
| Local configuration | Seeds from `.env`, stores changes in SQLite, and can encrypt sensitive values | Available, automated tests |
| Gateway management | Lists, creates, updates, and deletes Cloudflare AI Gateways | Available |
| Provider management | Manages custom model providers attached to a Gateway | Available |
| BYOK | Manages provider credentials scoped to a Gateway | Available |
| API paths | Configures Chat, Responses, and custom path suffixes | Available, automated tests |
| State sync | Refreshes remote resources and records local snapshots and sync runs | Available, automated tests |
| D1 management | Creates or lists D1 databases and updates Worker bindings | Available, automated tests |

### Worker deployment and diagnostics

| Feature | What it does | Status |
| --- | --- | --- |
| Project discovery | Finds local Workers and detects their endpoints and configuration | Available, automated tests |
| Configuration editing | Reads and writes `wrangler.toml` and local `.dev.vars` | Available, automated tests |
| Local runtime | Starts `wrangler dev` and reports process and health state | Available |
| Secrets and deploy | Sets production secrets and streams deployment logs | Available |
| Workers Builds | Reads, syncs, and triggers Cloudflare CI builds | Available |
| Endpoint selection | Supports local URLs, `workers.dev`, and custom domains | Available, automated tests |

### Supabase

| Feature | What it does | Status |
| --- | --- | --- |
| Organization OAuth | Connects Supabase, lists projects, and applies the selected project | Available, automated tests |
| Test identity | Obtains a user JWT for Worker diagnostics | Available |
| Migrations | Browses local migrations, compares remote state, and applies changes | Available, automated tests |
| Edge Functions | Browses, compares, and deploys Supabase Functions | Available, automated tests |

### AI requests

| Feature | What it does | Status |
| --- | --- | --- |
| Playground | Tests direct-Gateway and production-like Worker paths separately | Available, automated tests |
| OpenAI-compatible API | Proxies Chat Completions, Responses, and SSE streams | Available, automated tests |
| User authentication | Validates the user JWT before `/v1/*` handling | Available, automated tests |
| Entitlement and quota | Applies free/Plus policy, bounds requests, and spends free quota | Available, automated tests |
| Provider forwarding | Builds upstream URLs, injects credentials, and forwards responses | Partial: currently uses DashScope names and compatible paths |
| Provider adapter registry | Selects credentials, paths, and model catalogs by provider | Not implemented |

### Authentication, billing, and data

| Feature | What it does | Status |
| --- | --- | --- |
| Auth Worker | Email/password login, sessions, JWT, JWKS, and OAuth Provider support | Available |
| RevenueCat user API | Reads the current user's subscriptions and active entitlements | Available, automated tests |
| Entitlement sync | Updates `user_entitlements` from webhooks or an explicit sync | Available |
| Admin metrics | Restricts RevenueCat metric endpoints with `ALLOWED_SUBS` | Available, automated tests |
| Supabase data plane | RLS-protected entitlement, usage, throttle, and quota-spend structures | Available |

## Repository layout

| Path | Contents |
| --- | --- |
| [`admin/`](admin/README.md) | Local console and the Cloudflare, Supabase, and Worker operations API |
| [`ai-gateway-worker/`](ai-gateway-worker/README.md) | AI proxy called by business applications |
| [`worker-revenuecat/`](worker-revenuecat/README.md) | RevenueCat reads, webhooks, and entitlement sync |
| [`auth-worker/`](auth-worker/README.md) | Better Auth and D1 authentication service |
| [`wren-supabase/`](wren-supabase/README.md) | Supabase migrations, RLS, and quota RPCs |
| [`packages/gateway-core/`](packages/gateway-core/) | Shared AI quota and RevenueCat entitlement logic |
| [`admin/docs/`](admin/docs/README.md) | Admin architecture, data sources, and API |
| [`doc/`](doc/README.md) | Worker APIs and client integration guides |

## Main flows

- Operators use the local Admin to manage remote resources, local configuration, and deployments.
- OPC applications call deployed Workers and never receive provider or service-role credentials.
- RevenueCat state is synchronized into Supabase for protected services to consume.
- AI requests pass through authentication and quota checks before reaching the configured Gateway and model provider.

The current AI implementation includes Qwen/DashScope configuration, but Alibaba models are not required by the project. A fully provider-neutral adapter is still pending.

## Start the Admin

The current implementation requires Node.js 18+, pnpm, a Cloudflare account, and credentials for the services you use.

```bash
pnpm install
cp admin/.env.example admin/.env
./admin.sh
```

Open `http://localhost:5173` and enter the `ADMIN_TOKEN` from `admin/.env`. See each Worker README for local development and deployment commands.

## Constraints

- The local console manages infrastructure; it does not store application domain data.
- Platform APIs, credentials, and resource mappings stay inside their integration modules.
- Clients receive user tokens only. Provider, Gateway, and service-role credentials stay on the server.
- Replacing one infrastructure service should not require changes to unrelated business flows.

## Security

- Do not commit `.env`, `.dev.vars`, tokens, or API keys.
- Admin binds to `127.0.0.1` by default. Private-network deployments still need TLS and access control.
- Live cloud acceptance is a separate check; passing automated tests does not prove remote configuration.

## License

Cloud Chief is available under the [MIT License](LICENSE).
