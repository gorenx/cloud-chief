# revenuecat-proxy

English | [简体中文](README.zh-CN.md)

Cloudflare Worker that keeps RevenueCat credentials on the server. It exposes user-scoped subscription reads, administrator metrics, a client-triggered entitlement reconciliation endpoint, and a RevenueCat webhook that updates Supabase `user_entitlements`.

API reference: [`../doc/worker-revenuecat.md`](../doc/worker-revenuecat.md).

## Development and deployment

```bash
cp .dev.vars.example .dev.vars
pnpm install
pnpm dev
pnpm test
pnpm deploy
```

Set the RevenueCat API keys, webhook secret, and Supabase service-role key as Worker secrets. `ALLOWED_SUBS` controls access to administrator metrics; it does not restrict normal user routes.

RevenueCat `app_user_id` must equal the Supabase JWT `sub`, so subscription ownership can be checked consistently.
