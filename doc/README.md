# Cloud Chief Worker APIs

English | [简体中文](README.zh-CN.md)

Cloud Chief keeps provider and billing credentials in Cloudflare Workers. Applications send a user access token; Workers verify identity, enforce server-owned policy, and call upstream services.

## Documentation

| Document | Deployed Worker | Scope |
| --- | --- | --- |
| [`../ai-gateway-worker/API.md`](../ai-gateway-worker/API.md) | `ai-gateway-proxy` | Endpoint and error reference |
| [`ai-gateway-worker.md`](ai-gateway-worker.md) | `ai-gateway-proxy` | Client integration and streaming guide |
| [`worker-revenuecat.md`](worker-revenuecat.md) | `revenuecat-proxy` | Subscription, metrics, synchronization, and webhook API |

## Shared identity and entitlement flow

1. The client authenticates and sends a bearer JWT whose `sub` is its stable user ID.
2. RevenueCat uses the same ID as `app_user_id`.
3. The RevenueCat Worker reconciles subscription state into Supabase `user_entitlements`.
4. The AI Worker reads that state to select a tier and enforce quota.

Both Workers validate JWT issuer and audience. Legacy HS256 projects require a configured shared secret; asymmetric projects use JWKS.

Detailed endpoint semantics live in the endpoint references, not in component READMEs.
