-- pgTAP tests for spend_free_ai_credit() (RPC / transactional path).
-- Run: make -C wren-supabase dev && make -C wren-supabase test

begin;
select plan(4);
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'spend@example.com');

select is(
  public.spend_free_ai_credit(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '2026-06-19',
    2,
    'dev-a',
    '203.0.113.1',
    16,
    64
  )->>'granted',
  'true',
  'first spend succeeds'
);

select is(
  (public.spend_free_ai_credit(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '2026-06-19',
    2,
    'dev-a',
    '203.0.113.1',
    16,
    64
  )->>'granted'),
  'true',
  'second spend still under quota'
);

select is(
  public.spend_free_ai_credit(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '2026-06-19',
    2,
    'dev-a',
    '203.0.113.1',
    16,
    64
  )->>'reason',
  'over_quota',
  'third spend rejected; throttle not left partially bumped'
);

select is(
  (select used::text from public.ai_usage
   where user_id = '11111111-1111-1111-1111-111111111111'
     and period_key = '2026-06-19'),
  '2',
  'usage stops at quota'
);

select finish();
rollback;
