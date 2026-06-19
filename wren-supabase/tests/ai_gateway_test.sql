-- pgTAP integration tests for the AI gateway's server-side enforcement.
-- Run with:  make -C supabase dev && make -C supabase test   (needs Docker)
--
-- Covers what the client CANNOT be trusted to do:
--   1. RLS on user_entitlements — read own, never write
--   2. RLS on ai_usage — read own, never write directly
--   3. RLS on ai_throttle — fully invisible to authenticated clients
--
-- Quota/throttle increment logic lives in packages/gateway-core (Vitest).

begin;
select plan(10);
create extension if not exists pgtap with schema extensions;

-- ---- fixtures: two real auth users -------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- ---- RLS on user_entitlements: read own, never write ------------------------
-- seed as superuser (bypasses RLS); then act as authenticated user A.
insert into public.user_entitlements (user_id, is_plus) values
  ('11111111-1111-1111-1111-111111111111', true),
  ('22222222-2222-2222-2222-222222222222', true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.user_entitlements),
  1,
  'A sees only its own entitlement row (RLS filters the rest)'
);

-- no UPDATE/DELETE policy → RLS makes them silent no-ops (0 rows), not errors
update public.user_entitlements set is_plus = false
  where user_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select is_plus from public.user_entitlements
     where user_id = '11111111-1111-1111-1111-111111111111'),
  true,
  'A cannot grant/revoke its own Plus (update is a no-op under RLS)'
);

-- no INSERT policy → WITH CHECK denies it outright
select throws_ok(
  $$ insert into public.user_entitlements (user_id, is_plus)
     values ('11111111-1111-1111-1111-111111111111', true) $$,
  '42501',
  'A cannot insert into user_entitlements (only the webhook can)'
);

delete from public.user_entitlements
  where user_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.user_entitlements),
  1,
  'A cannot delete its entitlement (delete is a no-op under RLS)'
);

-- ai_usage: clients read own but cannot write directly (only the gateway does)
select is(
  (select count(*)::int from public.ai_usage),
  0,
  'A starts with no visible ai_usage rows'
);

select throws_ok(
  $$ insert into public.ai_usage (user_id, period_key, used)
     values ('11111111-1111-1111-1111-111111111111', '2026-06-12', 0) $$,
  '42501',
  'A cannot write ai_usage directly (the gateway is the only path)'
);

-- ai_throttle has no client policy at all → fully invisible to clients
select is(
  (select count(*)::int from public.ai_throttle),
  0,
  'the device/IP throttle table is invisible to authenticated clients'
);

select throws_ok(
  $$ insert into public.ai_throttle (scope, bucket, period_key, used)
     values ('device', 'd1', '2026-06-12', 1) $$,
  '42501',
  'A cannot write ai_throttle directly'
);

select throws_ok(
  $$ select * from public.ai_throttle $$,
  '42501',
  'A cannot read ai_throttle at all'
);

reset role;
select finish();
rollback;
