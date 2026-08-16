# revenuecat-proxy API

English | [简体中文](worker-revenuecat.zh-CN.md)

## Authentication

User routes require a valid user bearer JWT. Administrator metrics additionally require the JWT `sub` to appear in `ALLOWED_SUBS`. The webhook uses `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` instead of a user JWT.

## Routes

- `GET /health` — public health check.
- `GET /v1/me` — current RevenueCat customer.
- `GET /v1/me/subscriptions` — current user's subscriptions.
- `GET /v1/me/active-entitlements` — current active entitlements.
- `GET /v1/me/subscriptions/:subscriptionId` — one owned subscription.
- `GET /v1/metrics/overview` — administrator overview metrics.
- `GET /v1/charts/:chartName` — administrator chart data.
- `POST /v1/sync-entitlement` — reconcile the current customer and write Supabase entitlement state.
- `POST /webhooks/revenuecat` — verify the webhook secret and update entitlement state.

List and chart routes pass through their supported pagination, environment, currency, resolution, and time-range query parameters.

## Ownership and errors

RevenueCat is authoritative for subscription data. Supabase `user_entitlements` is the server-maintained projection consumed by the AI Worker. Clients cannot write the projection directly.

JSON routes return `{ "error": "description" }` on failure. The webhook uses short plain-text responses. Common statuses are `400`, `401`, `403`, `404`, `429`, `502`, and `500`.
