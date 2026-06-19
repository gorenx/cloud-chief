-- Atomic free-tier spend: device/IP throttle + per-user daily quota (ai-gateway-worker RPC).

create or replace function public.spend_free_ai_credit(
  p_user_id uuid,
  p_period text,
  p_quota int,
  p_device text default null,
  p_ip text default null,
  p_device_cap int default 16,
  p_ip_cap int default 64
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  if p_user_id is null then
    return jsonb_build_object('granted', false, 'reason', 'over_quota', 'used', 0, 'quota', p_quota);
  end if;
  if p_period is null or p_period !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid period_key';
  end if;
  if p_quota < 1 or p_quota > 100 then
    raise exception 'invalid quota';
  end if;
  if p_device_cap < 1 or p_device_cap > 1000 or p_ip_cap < 1 or p_ip_cap > 1000 then
    raise exception 'invalid throttle cap';
  end if;
  if p_device is not null and length(p_device) > 80 then
    raise exception 'invalid device_id';
  end if;
  if coalesce(p_ip, '') <> '' and length(p_ip) > 128 then
    raise exception 'invalid throttle bucket';
  end if;

  -- PL/pgSQL functions cannot use SAVEPOINT; undo prior throttle bumps on later failure.
  if coalesce(p_device, '') <> '' then
    insert into public.ai_throttle as t (scope, bucket, period_key, used)
    values ('device', p_device, p_period, 1)
    on conflict (scope, bucket, period_key)
    do update set
      used = t.used + 1,
      updated_at = now()
    where t.used < p_device_cap;
    if not found then
      return jsonb_build_object('granted', false, 'reason', 'throttled');
    end if;
  end if;

  if coalesce(p_ip, '') <> '' then
    insert into public.ai_throttle as t (scope, bucket, period_key, used)
    values ('ip', p_ip, p_period, 1)
    on conflict (scope, bucket, period_key)
    do update set
      used = t.used + 1,
      updated_at = now()
    where t.used < p_ip_cap;
    if not found then
      if coalesce(p_device, '') <> '' then
        update public.ai_throttle
        set used = greatest(used - 1, 0), updated_at = now()
        where scope = 'device' and bucket = p_device and period_key = p_period;
      end if;
      return jsonb_build_object('granted', false, 'reason', 'throttled');
    end if;
  end if;

  insert into public.ai_usage as u (user_id, period_key, used, device_id)
  values (p_user_id, p_period, 1, p_device)
  on conflict (user_id, period_key)
  do update set
    used = u.used + 1,
    device_id = coalesce(p_device, u.device_id),
    updated_at = now()
  where u.used < p_quota
  returning u.used into v_used;

  if not found then
    if coalesce(p_ip, '') <> '' then
      update public.ai_throttle
      set used = greatest(used - 1, 0), updated_at = now()
      where scope = 'ip' and bucket = p_ip and period_key = p_period;
    end if;
    if coalesce(p_device, '') <> '' then
      update public.ai_throttle
      set used = greatest(used - 1, 0), updated_at = now()
      where scope = 'device' and bucket = p_device and period_key = p_period;
    end if;
    select used into v_used
    from public.ai_usage
    where user_id = p_user_id and period_key = p_period;
    return jsonb_build_object(
      'granted', false,
      'reason', 'over_quota',
      'used', coalesce(v_used, p_quota),
      'quota', p_quota
    );
  end if;

  return jsonb_build_object(
    'granted', true,
    'used', v_used,
    'quota', p_quota
  );
end;
$$;

revoke all on function public.spend_free_ai_credit(uuid, text, int, text, text, int, int) from public;
revoke all on function public.spend_free_ai_credit(uuid, text, int, text, text, int, int) from anon;
revoke all on function public.spend_free_ai_credit(uuid, text, int, text, text, int, int) from authenticated;
grant execute on function public.spend_free_ai_credit(uuid, text, int, text, text, int, int) to service_role;
