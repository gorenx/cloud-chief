# wren-supabase — Wren 的 Postgres Schema

[English](README.md) | 简体中文

Supabase **数据平面**：Auth、RLS 表、Realtime。AI 网关与 billing 在 Cloudflare Workers：

| 组件 | 目录 |
|------|------|
| AI 网关（JWT、配额、上游代理） | `../ai-gateway-worker/` |
| RevenueCat webhook / sync / 只读 API | `../worker-revenuecat/` |
| 共享配额与权益逻辑 | `../packages/gateway-core/` |

## Layout

```
migrations/0001_wren_state.sql    # RemoteStore + RLS + realtime
migrations/0002_ai_gateway.sql    # user_entitlements, ai_usage, ai_throttle
migrations/0003_ai_gateway_rpc.sql # spend_free_ai_credit() — Worker quota RPC
tests/ai_gateway_test.sql         # pgTAP RLS tests
tests/spend_free_ai_credit_test.sql # pgTAP transactional spend
config.toml                       # Supabase CLI (db push / local stack)
Makefile                          # link, db-push, dev, test
```

## Deploy schema

```bash
supabase login
make -C wren-supabase release PROJECT_REF=<your-ref>
```

Then deploy Workers (see each directory's README). RevenueCat webhook URL：

```
https://revenuecat-proxy.<subdomain>.workers.dev/webhooks/revenuecat
```

`user_entitlements` 由 `worker-revenuecat` 写入；`ai-gateway-worker` 读取并执行配额。

## Local tests

```bash
make -C wren-supabase dev
make -C wren-supabase test
```

pgTAP 断言：客户端可读自己的 `user_entitlements` / `ai_usage`，不能写；`ai_throttle` 对客户端不可见；`spend_free_ai_credit()` 原子扣减。

## Rollout order

1. `db push` — 表 + RLS
2. 部署 `worker-revenuecat` — webhook + sync，RevenueCat `app_user_id` = Supabase uid
3. 部署 `ai-gateway-worker` — 客户端切到 Worker URL
4. 在 RevenueCat 未写入权益前，网关按 free tier 处理

## Server-side enforcement

| Concern | Mechanism |
|---|---|
| Key leakage | 模型提供商密钥只保存在 Worker secrets |
| Unlimited calls | `spend_free_ai_credit()` RPC（0003 migration） |
| Forged Plus | `user_entitlements` written only by billing Worker (service role) |
| Sybil | device/IP soft caps in `ai_throttle` |

## Flutter client

```bash
flutter run -d macos \
  --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

AI 请求打 `ai-gateway-worker` URL，不要 `--dart-define=ANTHROPIC_API_KEY` 进发行包。

## Auth (Supabase dashboard)

Enable **Apple** / **Google** (not Anonymous). Redirect: `com.angoren.wren://login-callback`.

Email sign-in uses OTP codes — templates must include `{{ .Token }}`.

See prior project docs for OAuth deep links, E2E (`dart_defines.e2e.json`), and email auth details.
