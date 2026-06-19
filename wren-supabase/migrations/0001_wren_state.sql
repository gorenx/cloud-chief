-- Per-user state documents for cross-device sync (the RemoteStore port's table).
-- Previously documented only in lib/data/sync/CLAUDE.md; vendored here so the
-- backend is reproducible from the repo. One row per user section; RLS scopes
-- access to the owner; realtime publication feeds RemoteStore.watch().

create table if not exists public.wren_state (
  user_id    uuid not null references auth.users(id) on delete cascade,
  section    text not null default 'core',
  rev        bigint not null default 0,
  updated_at bigint not null default 0,          -- ms epoch, set by the writing device
  device_id  text   not null default '',
  data       jsonb  not null default '{}'::jsonb,
  synced_at  timestamptz not null default now(),
  primary key (user_id, section)
);

alter table public.wren_state enable row level security;

create policy "owner reads"
  on public.wren_state for select using (auth.uid() = user_id);
create policy "owner inserts"
  on public.wren_state for insert with check (auth.uid() = user_id);
create policy "owner updates"
  on public.wren_state for update using (auth.uid() = user_id)
                                  with check (auth.uid() = user_id);

-- realtime feed for watch(); guarded so re-running the migration is safe
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wren_state'
  ) then
    alter publication supabase_realtime add table public.wren_state;
  end if;
end $$;
