-- Free trial, then StayOS approval.
-- Every new hostel gets 14 days. After that it is locked (nothing can be read or changed, all data kept) until a
-- StayOS software admin approves it for 1, 3, 6 or 12 months; when that period ends it locks again. Owners ask for
-- approval from the app; the old test checkout no longer switches plans by itself. The shared demo never locks.

alter table public.orgs
  add column if not exists approval_requested_at timestamptz,
  add column if not exists requested_plan text,
  add column if not exists requested_cycle text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text;

-- StayOS's own admins (not hostel staff). No app access to the table itself.
create table if not exists public.platform_admins (email text primary key, added_at timestamptz not null default now());
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from authenticated, anonymous;
-- Admins are added straight in the database, never in code (their emails stay out of the repository):
--   insert into public.platform_admins (email) values ('admin@example.com') on conflict do nothing;

create or replace function app.is_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins pa join neon_auth."user" u on lower(u.email) = lower(pa.email)
                 where u.id::text = auth.user_id() and u."emailVerified")
$$;

-- Is the hostel allowed to run right now? The demo and the sample template always are.
create or replace function app.org_active(o uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select is_demo or is_template
      or (subscription_status = 'trialing' and coalesce(trial_ends_at, now() + interval '1 day') > now())
      or (subscription_status = 'active' and (current_period_end is null or current_period_end > now()))
    from public.orgs where id = o), false)
$$;
revoke all on function app.is_platform_admin(), app.org_active(uuid) from public, anonymous;
grant execute on function app.is_platform_admin(), app.org_active(uuid) to authenticated;

-- The lock: on top of every other rule, a hostel's rows are only reachable while it is active
do $$
declare t text;
begin
  foreach t in array array['rooms','beds','residents','invoices','expenses','staff','complaints','gate_events','leaves','visitors','meal_optouts','notices','activity','wa_threads','invites','payments']
  loop
    execute format('drop policy if exists %I_org_active on public.%I', t, t);
    execute format('create policy %I_org_active on public.%I as restrictive for all to authenticated using (app.org_active(org_id)) with check (app.org_active(org_id))', t, t);
  end loop;
end $$;

-- Functions that work with a hostel's data on their own also stop while it is locked
create or replace function public.org_snapshot(p_org uuid) returns jsonb language plpgsql stable as $$
declare
  uid text := app.require_user();
  staff_rows jsonb;
begin
  if not app.is_member(p_org) then raise exception 'not a member of this hostel'; end if;
  if not app.org_active(p_org) then raise exception 'hostel_locked' using errcode = 'P0001', hint = 'StayOS has not approved this hostel'; end if;
  if app.is_staff(p_org) then
    select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') into staff_rows from public.staff t where t.org_id = p_org;
  else
    staff_rows := public.staff_directory(p_org);
  end if;
  return jsonb_build_object(
    'now', now(),
    'org', (select to_jsonb(o) from public.orgs o where o.id = p_org),
    'rooms', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.rooms t where t.org_id = p_org),
    'staff', staff_rows,
    'beds', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.beds t where t.org_id = p_org),
    'residents', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.residents t where t.org_id = p_org),
    'invoices', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.invoices t where t.org_id = p_org),
    'expenses', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.expenses t where t.org_id = p_org),
    'complaints', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.complaints t where t.org_id = p_org),
    'gate_events', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.gate_events t where t.org_id = p_org),
    'leaves', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.leaves t where t.org_id = p_org),
    'visitors', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.visitors t where t.org_id = p_org),
    'meal_optouts', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.meal_optouts t where t.org_id = p_org),
    'notices', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.notices t where t.org_id = p_org),
    'activity', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.activity t where t.org_id = p_org),
    'wa_threads', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id' order by t.id), '[]') from public.wa_threads t where t.org_id = p_org)
  );
end $$;

create or replace function public.pay_invoice_test(p_org uuid, p_invoice text, p_via text default 'app', p_paid_on timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
  sample boolean;
begin
  perform app.require_user();
  if not app.org_active(p_org) then raise exception 'hostel_locked' using errcode = 'P0001', hint = 'StayOS has not approved this hostel'; end if;
  select * into inv from public.invoices where org_id = p_org and id = p_invoice;
  if inv.id is null then raise exception 'invoice not found'; end if;
  if not (app.is_staff(p_org) or inv.resident_id = app.my_resident(p_org)) then raise exception 'not your invoice'; end if;
  select coalesce(o.settings -> 'clock' ->> 'mode', 'real') = 'demo' into sample from public.orgs o where o.id = p_org;
  if not sample then raise exception 'online_payments_not_connected'; end if;
  if inv.status = 'paid' then return to_jsonb(inv) - 'org_id'; end if;
  update public.invoices set
    status = 'paid', paid_on = coalesce(p_paid_on, now()), method = 'upi',
    utr = (3 + floor(random() * 6))::int::text || lpad(floor(random() * 1e11)::bigint::text, 11, '0'),
    paid_via = case when p_via in ('app', 'whatsapp_link', 'qr') then p_via else 'app' end
  where org_id = p_org and id = p_invoice
  returning * into inv;
  return to_jsonb(inv) - 'org_id';
end $$;

create or replace function public.create_invite(p_org uuid, p_role text, p_resident_id text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not app.is_staff(p_org) then raise exception 'only staff can invite'; end if;
  if not app.org_active(p_org) then raise exception 'hostel_locked' using errcode = 'P0001', hint = 'StayOS has not approved this hostel'; end if;
  if p_role = 'warden' and not app.is_owner(p_org) then raise exception 'only the owner can invite wardens'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites (code, org_id, role, resident_id, created_by) values (c, p_org, p_role, p_resident_id, auth.user_id());
  return c;
end $$;

create or replace function public.reset_demo_data(p_org uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_owner(p_org) then raise exception 'only the owner can reset data'; end if;
  if not app.org_active(p_org) then raise exception 'hostel_locked' using errcode = 'P0001', hint = 'StayOS has not approved this hostel'; end if;
  perform app.clear_org(p_org);
  perform app.copy_template(p_org);
end $$;

create or replace function public.staff_directory(p_org uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when app.is_member(p_org) and app.org_active(p_org) then coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'role', s.role, 'title', s.title, 'shift', s.shift, 'phone', s.phone) order by s.id), '[]'::jsonb) end
  from public.staff s where s.org_id = p_org
$$;

-- The hostels this person belongs to, now with whether each is active and its approval state
drop function if exists public.my_memberships();
create function public.my_memberships() returns table (
  org_id uuid, role text, resident_id text, org_name text, city text, plan text, subscription_status text, trial_ends_at timestamptz,
  is_demo boolean, current_period_end timestamptz, approval_requested_at timestamptz, requested_plan text, active boolean
) language plpgsql stable security definer set search_path = '' as $$
declare uid text := app.require_user();
begin
  return query
    select m.org_id, m.role, m.resident_id, o.name, o.city, o.plan, o.subscription_status, o.trial_ends_at, o.is_demo,
      o.current_period_end, o.approval_requested_at, o.requested_plan, app.org_active(o.id)
    from public.members m join public.orgs o on o.id = m.org_id
    where m.user_id = uid and not o.is_template
    order by o.is_demo, o.created_at;
end $$;
revoke all on function public.my_memberships() from public, anonymous;
grant execute on function public.my_memberships() to authenticated;

-- Owners ask StayOS to switch the hostel on (the plan they want); the old self-serve checkout is retired
create or replace function public.request_approval(p_org uuid, p_plan text, p_cycle text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_user();
  if not app.is_owner(p_org) then raise exception 'only the owner can ask for approval'; end if;
  if p_plan not in ('starter', 'growth', 'scale') or p_cycle not in ('monthly', 'yearly') then raise exception 'unknown plan'; end if;
  update public.orgs set requested_plan = p_plan, requested_cycle = p_cycle, approval_requested_at = now() where id = p_org and not is_demo;
  return jsonb_build_object('requested_at', now(), 'plan', p_plan, 'cycle', p_cycle);
end $$;
revoke all on function public.request_approval(uuid, text, text) from public, anonymous;
grant execute on function public.request_approval(uuid, text, text) to authenticated;

create or replace function public.checkout_plan(p_org uuid, p_plan text, p_cycle text, p_method text default 'upi') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'approval_needed' using errcode = 'P0001', hint = 'Ask StayOS to approve the hostel (request_approval)';
end $$;

-- StayOS admin: every hostel and its state
create or replace function public.am_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_platform_admin()
$$;

create or replace function public.admin_hostels() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_user();
  if not app.is_platform_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(to_jsonb(h) order by (h.approval_requested_at is null), h.approval_requested_at desc, h.created_at desc) from (
    select o.id, o.name, o.city, o.phone, o.owner_name, o.owner_phone, o.plan, o.billing_cycle, o.subscription_status,
      o.trial_ends_at, o.current_period_end, o.approval_requested_at, o.requested_plan, o.requested_cycle, o.approved_at, o.approved_by,
      o.created_at, app.org_active(o.id) as active, coalesce(o.settings -> 'clock' ->> 'mode', 'real') = 'demo' as sample,
      (select m.email from public.members m where m.org_id = o.id and m.role = 'owner' order by m.created_at limit 1) as owner_email,
      (select count(*) from public.members m where m.org_id = o.id)::int as members,
      (select count(*) from public.residents r where r.org_id = o.id and r.status <> 'checked_out')::int as residents,
      (select count(*) from public.beds b where b.org_id = o.id)::int as beds
    from public.orgs o where not o.is_demo and not o.is_template) h), '[]'::jsonb);
end $$;

create or replace function public.admin_set_access(p_org uuid, p_action text, p_months int default 1, p_days int default 7) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  perform app.require_user();
  if not app.is_platform_admin() then raise exception 'not allowed'; end if;
  select u.email into who from neon_auth."user" u where u.id::text = auth.user_id();
  if p_action = 'approve' then
    if p_months not in (1, 3, 6, 12) then raise exception 'pick 1, 3, 6 or 12 months'; end if;
    -- a new period starts today, or where a still-running one ends
    update public.orgs set subscription_status = 'active',
      plan = coalesce(requested_plan, plan), billing_cycle = coalesce(requested_cycle, billing_cycle),
      current_period_end = greatest(now(), case when subscription_status = 'active' then coalesce(current_period_end, now()) else now() end) + make_interval(months => p_months),
      approval_requested_at = null, approved_at = now(), approved_by = who
    where id = p_org and not is_demo and not is_template;
  elsif p_action = 'extend_trial' then
    if p_days < 1 or p_days > 60 then raise exception 'extend by 1 to 60 days'; end if;
    update public.orgs set subscription_status = 'trialing', trial_ends_at = greatest(now(), coalesce(trial_ends_at, now())) + make_interval(days => p_days)
    where id = p_org and not is_demo and not is_template;
  elsif p_action = 'suspend' then
    update public.orgs set subscription_status = 'canceled', current_period_end = now(), trial_ends_at = least(coalesce(trial_ends_at, now()), now())
    where id = p_org and not is_demo and not is_template;
  else
    raise exception 'unknown action';
  end if;
  return (select to_jsonb(o) - 'settings' from public.orgs o where o.id = p_org);
end $$;

revoke all on function public.am_platform_admin(), public.admin_hostels(), public.admin_set_access(uuid, text, int, int) from public, anonymous;
grant execute on function public.am_platform_admin(), public.admin_hostels(), public.admin_set_access(uuid, text, int, int) to authenticated;
