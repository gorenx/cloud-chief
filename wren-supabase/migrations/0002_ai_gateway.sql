-- Server-authoritative AI entitlements + quota for the wren-voice gateway.
-- The client can lie about its tier and reset its local counter; the gateway
-- validates the JWT, then uses service-role DML (in wren-voice) for quota/throttle.
--
-- Quota/throttle logic intentionally lives in the Edge Function, not stored
-- procedures — keeps the schema portable across Postgres hosts.
--
-- See docs/server-authoritative-ai.md for the why; supabase/README.md to deploy.

-- ---------------------------------------------------------------------------
-- 1) Entitlement (Plus) — written ONLY by the RevenueCat webhook (service role).
--    A `select` policy lets a user read their own row (for display); there is
--    deliberately NO insert/update/delete policy, so an authenticated client can
--    never grant itself Plus. The gateway treats is_plus AND not-expired as Plus.
-- ---------------------------------------------------------------------------
create table if not exists public.user_entitlements (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  is_plus     boolean not null default false,
  product_id  text,
  expires_at  timestamptz,                 -- null = lifetime / non-expiring
  last_event_at_ms bigint not null default 0,
  last_event_id text,
  updated_at  timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

create policy "owner reads entitlement"
  on public.user_entitlements for select using (auth.uid() = user_id);
-- no insert/update/delete policy on purpose → only the service role writes it.

-- ---------------------------------------------------------------------------
-- 2) Per-user metered AI usage — one row per (user, UTC day). The gateway
--    increments it atomically (optimistic locking in wren-voice) and refuses
--    past the quota: the real cost ceiling, independent of whatever the
--    client's local counter claims.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  period_key text not null,                -- 'YYYY-MM-DD' (UTC)
  used       int  not null default 0,
  device_id  text,                         -- last device that spent (audit only)
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
--    it. Caps are generous: both signals are client-influenced, so they only
--    deter casual multi-account abuse, never throttle shared NAT / family devices
--    into failure.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_throttle (
  scope      text not null,                -- 'device' | 'ip'
  bucket     text not null,                -- the device id or ip address
  period_key text not null,                -- 'YYYY-MM-DD' (UTC)
  used       int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, bucket, period_key)
);

alter table public.ai_throttle enable row level security;
-- no policies → only the service-role gateway (wren-voice) touches it.

-- Drop legacy RPCs if an earlier revision of this migration was applied.
drop function if exists public.consume_ai_credit(uuid, text, int, text);
drop function if exists public.consume_ai_credit(text, int, text);
drop function if exists public.bump_throttle(text, text, text, int);
