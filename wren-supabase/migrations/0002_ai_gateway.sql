-- Server-authoritative AI entitlements + quota for the ai-gateway-worker.
-- The client can lie about its tier and reset its local counter; Workers
-- validate the JWT, then use service-role DML for quota/throttle.
--
-- Quota/throttle increments run in spend_free_ai_credit() — see 0003_ai_gateway_rpc.sql.
--
-- See docs/server-authoritative-ai.md for the why; wren-supabase/README.md to deploy.

-- ---------------------------------------------------------------------------
-- 1) Entitlement (Plus) — written ONLY by worker-revenuecat (service role).
--    A `select` policy lets a user read their own row (for display); there is
--    deliberately NO insert/update/delete policy, so an authenticated client can
--    never grant itself Plus. The gateway treats is_plus AND not-expired as Plus.
-- ---------------------------------------------------------------------------
create table if not exists public.user_entitlements (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  is_plus     boolean not null default false,  -- mirrored from RevenueCat; gateway also checks expires_at
  product_id  text,                            -- RevenueCat product_identifier (display / audit)
  expires_at  timestamptz,                     -- null = lifetime / non-expiring subscription
  last_event_at_ms bigint not null default 0,  -- webhook event_timestamp_ms; dedupe / stale guard
  last_event_id text,                          -- RevenueCat event id or client_sync:<ms>
  updated_at  timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

create policy "owner reads entitlement"
  on public.user_entitlements for select using (auth.uid() = user_id);
-- no insert/update/delete policy on purpose → only the service role writes it.

-- ---------------------------------------------------------------------------
-- 2) Per-user metered AI usage — one row per (user, UTC day). The gateway
--    increments `used` atomically (optimistic locking in ai-gateway-worker) and
--    refuses past FREE_DAILY_CEILING. Counts API calls, not tokens or cost.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  period_key text not null,                -- UTC calendar day: 'YYYY-MM-DD'
  used       int  not null default 0,    -- today's spent AI call count for this user (not tokens)
  device_id  text,                       -- last X-Device-Id that consumed a credit (audit only)
  updated_at timestamptz not null default now(),
  primary key (user_id, period_key)
);

alter table public.ai_usage enable row level security;
create policy "owner reads usage"
  on public.ai_usage for select using (auth.uid() = user_id);
-- writes go through the service-role gateway only, never direct client DML.

-- ---------------------------------------------------------------------------
-- 3) Sybil defense-in-depth: per-device and per-IP daily soft caps. Buckets span
--    users (a device/IP is the bucket), so the table is NOT client-readable —
--    RLS is enabled with no policies, and only the service-role gateway touches
--    it. `used` counts gateway calls attributed to the bucket that day (not tokens).
-- ---------------------------------------------------------------------------
create table if not exists public.ai_throttle (
  scope      text not null,                -- 'device' | 'ip'
  bucket     text not null,                -- device id (X-Device-Id) or client IP
  period_key text not null,                -- UTC calendar day: 'YYYY-MM-DD'
  used       int  not null default 0,    -- call count for this bucket today (cross-user soft cap)
  updated_at timestamptz not null default now(),
  primary key (scope, bucket, period_key)
);

alter table public.ai_throttle enable row level security;
-- no policies → only the service-role gateway Worker touches it.

-- Drop legacy RPCs if an earlier revision of this migration was applied.
drop function if exists public.consume_ai_credit(uuid, text, int, text);
drop function if exists public.consume_ai_credit(text, int, text);
drop function if exists public.bump_throttle(text, text, text, int);
