# Cloud Chief — Infrastructure Operations for OPC Projects

English | [简体中文](README.zh-CN.md)

Cloud Chief helps OPC projects deploy and operate common infrastructure services from one local control plane, so limited engineering capacity can stay focused on product and business development instead of repeatedly assembling cloud consoles, credentials, deployment commands, and diagnostic scripts.

The current repository coordinates Cloudflare Workers, AI Gateway and D1, Supabase, RevenueCat, authentication, entitlement, quota, and model-provider access. These integrations are the currently implemented service set, not the boundary of the product.

## Product goal

- Give an OPC project one local entry point for infrastructure setup, deployment, status inspection, synchronization, and troubleshooting.
- Turn repeatable operational procedures into guided workflows with explicit configuration sources and safe secret boundaries.
- Provide deployable backend building blocks—authentication, data, AI access, entitlement, quota, and billing—so business code consumes stable service APIs.
- Keep external services replaceable through integration adapters and configuration rather than coupling business policy to a vendor.

Cloud Chief does not host the application's business domain or replace the connected cloud platforms. It manages the infrastructure integration and operational lifecycle around them.

The repository currently includes a Qwen/DashScope-compatible adapter and model catalog. They are built-in implementations, not the identity or boundary of the system; additional OpenAI-compatible providers can follow the same gateway/provider boundary, while provider-neutral Worker configuration is still an implementation gap.

## Components

| Path | Responsibility |
| --- | --- |
| [`admin/`](admin/README.md) | Local or private-network operations console for gateways, providers, keys, Workers, Supabase, and playground requests |
| [`ai-gateway-worker/`](ai-gateway-worker/README.md) | Production AI proxy: verifies user JWTs, enforces tier and quota, and forwards requests to the configured provider |
| [`worker-revenuecat/`](worker-revenuecat/README.md) | RevenueCat API, webhook, and entitlement synchronization boundary |
| [`auth-worker/`](auth-worker/README.md) | Better Auth service backed by Cloudflare D1 |
| [`wren-supabase/`](wren-supabase/README.md) | Supabase schema, RLS policies, and quota RPCs |
| [`packages/gateway-core/`](packages/gateway-core/) | Shared entitlement and quota policy code |
| [`doc/`](doc/README.md) | Worker API and integration documentation |

## Operating model

- Operations: operator -> local Admin -> connected platform APIs, local project files, deployment tools, and diagnostics.
- Delivery: reusable schema and Worker components -> configured cloud environment -> stable APIs consumed by the OPC application.
- AI requests: application -> `ai-gateway-worker` -> configured AI gateway -> selected model provider.
- Billing: RevenueCat -> `worker-revenuecat` -> Supabase `user_entitlements` -> protected business services.

The application sends only its user access token. Upstream API keys and service-role credentials remain in server or Worker secrets.

## Architecture boundary

- The local control plane owns infrastructure configuration, snapshots, synchronization, deployment workflows, and diagnostics; it does not own application business data.
- Each platform integration owns its API client, credentials, resource mapping, and deployment mechanics.
- Deployable services expose stable application-facing contracts while keeping provider credentials and service-role access behind the service boundary.
- Authentication, entitlement, quota, billing, and model policy must not branch on an infrastructure vendor when a neutral business concept is sufficient.
- Runtime configuration selects an integration or provider adapter; replacing one should not require changing unrelated application clients or workflows.

## Feature matrix

Status meanings:

- **Implemented + automated**: implementation exists and focused automated tests cover the capability.
- **Implemented**: implementation exists; the matrix does not claim end-to-end acceptance in a real external environment.
- **Partial**: a usable built-in implementation exists, but the stated general boundary is not complete.
- **Gap**: required by the architecture but not implemented as a general capability.

### Local control plane

| Capability | Observable behavior | Status | Evidence |
| --- | --- | --- | --- |
| Admin authentication | Local login creates an Admin session; management routes reject unauthenticated requests | Implemented + automated | [`admin/src/routes/auth.ts`](admin/src/routes/auth.ts), [`admin/test/auth-routes.test.ts`](admin/test/auth-routes.test.ts) |
| Local configuration | Seeds configuration from `.env`, persists overrides in SQLite, and can encrypt sensitive values | Implemented + automated | [`admin/src/app-config.ts`](admin/src/app-config.ts), [`admin/test/app-config.test.ts`](admin/test/app-config.test.ts) |
| Gateway management | Lists context and creates, updates, or deletes Cloudflare AI Gateway instances | Implemented | [`admin/src/routes/admin.ts`](admin/src/routes/admin.ts), [Admin API](admin/docs/api.md) |
| Provider management | Creates and deletes custom providers without making provider identity a policy concern | Implemented | [`admin/src/routes/admin.ts`](admin/src/routes/admin.ts), [data authority](admin/docs/data-sources.md) |
| BYOK management | Lists, stores, and deletes gateway-scoped provider credentials | Implemented | [`admin/src/routes/admin.ts`](admin/src/routes/admin.ts), [Admin API](admin/docs/api.md) |
| API path configuration | Stores Chat, Responses, and custom path suffixes per gateway/provider pair | Implemented + automated | [`admin/src/gateway-api-path-config.ts`](admin/src/gateway-api-path-config.ts), [`admin/test/gateway-api-path-config.test.ts`](admin/test/gateway-api-path-config.test.ts) |
| Snapshot synchronization | Refreshes remote state, records runs, and retains the last usable local snapshot on refresh failure | Implemented + automated | [`admin/src/routes/sync.ts`](admin/src/routes/sync.ts), [`admin/test/sync-routes.test.ts`](admin/test/sync-routes.test.ts) |
| Cloudflare D1 management | Lists or creates D1 databases and updates a Worker's D1 binding | Implemented + automated | [`admin/src/routes/cloudflare-db.ts`](admin/src/routes/cloudflare-db.ts), [`admin/test/cloudflare-db-routes.test.ts`](admin/test/cloudflare-db-routes.test.ts) |

### Worker lifecycle and diagnostics

| Capability | Observable behavior | Status | Evidence |
| --- | --- | --- | --- |
| Project discovery | Finds local Worker projects and infers chat, gateway, model, and API capabilities | Implemented + automated | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts), [`admin/test/worker-capabilities.test.ts`](admin/test/worker-capabilities.test.ts) |
| Runtime configuration | Reads and updates `wrangler.toml` vars and local `.dev.vars` secret values | Implemented + automated | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts), [`admin/test/worker-runtime.test.ts`](admin/test/worker-runtime.test.ts) |
| Local Worker process | Starts Wrangler development mode and reports process and health state | Implemented | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts) |
| Deployment and secrets | Pushes approved secrets and deploys the selected Worker with streamed logs | Implemented | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts), [Admin API](admin/docs/api.md) |
| Workers Builds | Reads CI status, synchronizes build configuration, stores the builder token, and triggers builds | Implemented | [`admin/src/routes/deploy.ts`](admin/src/routes/deploy.ts) |
| Endpoint selection | Resolves local, `workers.dev`, and custom-domain endpoints and rejects unsafe proxy paths | Implemented + automated | [`admin/src/worker-path.ts`](admin/src/worker-path.ts), [`admin/test/worker-endpoints.test.ts`](admin/test/worker-endpoints.test.ts) |

### Supabase operations

| Capability | Observable behavior | Status | Evidence |
| --- | --- | --- | --- |
| Organization OAuth | Connects with PKCE, lists projects, applies a selected project, and disconnects | Implemented + automated | [`admin/src/routes/supabase-connect.ts`](admin/src/routes/supabase-connect.ts), [`admin/test/supabase-oauth.test.ts`](admin/test/supabase-oauth.test.ts) |
| Test identity | Stores local test credentials used to obtain a user JWT for Worker-path diagnostics | Implemented | [`admin/src/routes/supabase-connect.ts`](admin/src/routes/supabase-connect.ts) |
| Migration operations | Browses migration directories, compares local/remote state, and applies migrations | Implemented + automated | [`admin/src/routes/supabase-connect.ts`](admin/src/routes/supabase-connect.ts), [`admin/test/supabase-schema.test.ts`](admin/test/supabase-schema.test.ts) |
| Edge Function operations | Browses function sources, compares deployment state, and deploys selected functions | Implemented + automated | [`admin/src/routes/supabase-connect.ts`](admin/src/routes/supabase-connect.ts), [`admin/test/supabase-functions.test.ts`](admin/test/supabase-functions.test.ts) |

### AI request path

| Capability | Observable behavior | Status | Evidence |
| --- | --- | --- | --- |
| Playground diagnostics | Sends direct-Gateway or Worker-backed requests and exposes the resolved route and runtime context | Implemented + automated | [`admin/src/routes/chat.ts`](admin/src/routes/chat.ts), [`admin/src/routes/worker-chat.ts`](admin/src/routes/worker-chat.ts), [`admin/test/app.test.ts`](admin/test/app.test.ts) |
| OpenAI-compatible APIs | Proxies Chat Completions and Responses, including SSE streaming | Implemented + automated | [`ai-gateway-worker/src/index.ts`](ai-gateway-worker/src/index.ts), [`ai-gateway-worker/test/index.test.ts`](ai-gateway-worker/test/index.test.ts) |
| User authentication | Validates bearer JWT issuer, audience, signature, expiry, and subject before `/v1/*` handling | Implemented + automated | [`ai-gateway-worker/src/auth.ts`](ai-gateway-worker/src/auth.ts), [`ai-gateway-worker/test/index.test.ts`](ai-gateway-worker/test/index.test.ts) |
| Entitlement and quota | Resolves free/Plus policy, bounds prompts and output, and atomically spends free credits | Implemented + automated | [`ai-gateway-worker/src/enforce.ts`](ai-gateway-worker/src/enforce.ts), [`packages/gateway-core/`](packages/gateway-core/) |
| Provider-specific forwarding | Builds the upstream URL, injects provider and gateway credentials, and forwards streaming bodies | Partial | [`ai-gateway-worker/src/gateway.ts`](ai-gateway-worker/src/gateway.ts); current implementation uses DashScope-named credentials and compatible paths |
| Provider-neutral adapter registry | Selects credentials, paths, request normalization, and model metadata through a provider adapter contract | Gap | Architecture boundary above; no runtime adapter registry currently exists |

### Identity, billing, and data plane

| Capability | Observable behavior | Status | Evidence |
| --- | --- | --- | --- |
| Authentication service | Provides email/password sessions, JWT issuing, JWKS, OAuth provider endpoints, and optional social login | Implemented | [`auth-worker/src/`](auth-worker/src/), [`auth-worker/README.md`](auth-worker/README.md) |
| RevenueCat user API | Exposes customer, subscription, and active-entitlement reads scoped by JWT subject | Implemented + automated | [`worker-revenuecat/src/index.ts`](worker-revenuecat/src/index.ts), [`worker-revenuecat/test/index.test.ts`](worker-revenuecat/test/index.test.ts) |
| Billing reconciliation | Accepts RevenueCat webhooks and user-triggered sync, then updates `user_entitlements` | Implemented | [`worker-revenuecat/src/billing.ts`](worker-revenuecat/src/billing.ts), [`packages/gateway-core/src/revenuecat-entitlement.ts`](packages/gateway-core/src/revenuecat-entitlement.ts) |
| Administrator metrics | Restricts RevenueCat overview and chart APIs to `ALLOWED_SUBS` | Implemented + automated | [`worker-revenuecat/src/index.ts`](worker-revenuecat/src/index.ts), [`worker-revenuecat/test/index.test.ts`](worker-revenuecat/test/index.test.ts) |
| Supabase data plane | Defines RLS-protected entitlement, usage, throttle, and atomic quota-spend structures | Implemented | [`wren-supabase/migrations/`](wren-supabase/migrations/), [`wren-supabase/tests/`](wren-supabase/tests/) |

The matrix describes repository implementation and automated evidence only. It does not claim live acceptance against Cloudflare, Supabase, RevenueCat, or a model provider.

## Quick start

Requirements for the current built-in deployment: Node.js 18+, pnpm, a Cloudflare account, and the provider credentials needed by the selected adapter.

```bash
pnpm install
cp admin/.env.example admin/.env
./admin.sh
```

Open `http://localhost:5173` and enter the same `ADMIN_TOKEN` configured in `admin/.env`. See each component README for its development and deployment commands.

## Documentation convention

English is the default language and uses the normal `.md` name. Simplified Chinese translations use `.zh-CN.md`. Component READMEs cover setup and deployment; detailed API behavior belongs under [`doc/`](doc/README.md) or `admin/docs/`.

## Security

- Never commit `.env`, `.dev.vars`, tokens, or API keys.
- The Admin service binds to `127.0.0.1` by default. Put TLS and an access boundary in front of any private-network deployment.
- Production clients call the Worker proxy; they must not receive provider, gateway, billing, or service-role secrets.
