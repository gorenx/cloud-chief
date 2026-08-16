# wren-supabase — Postgres schema for Wren

English | [简体中文](README.zh-CN.md)

Supabase data plane for authentication, row-level-security tables, realtime data, AI entitlements, usage, throttling, and the transactional free-credit RPC.

## Deploy and test

```bash
supabase login
make -C wren-supabase release PROJECT_REF=<your-ref>

make -C wren-supabase dev
make -C wren-supabase test
```

Deploy in this order: schema and RLS, `worker-revenuecat`, then `ai-gateway-worker`. RevenueCat writes `user_entitlements`; the AI Worker reads it and spends free quota through the database RPC.

Clients may read their own entitlement and usage state but cannot write authoritative billing or throttle state. Provider keys remain in Worker secrets.
