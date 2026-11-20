-- A waking database can run the first requests before the caller's JWT is applied; they then see no rows
-- instead of failing. These functions refuse to answer without an identity, so the app retries instead
-- of showing an empty hostel. org_snapshot loads a whole hostel in one call (row-level security applies).

create or replace function app.require_user() returns text language plpgsql stable security definer set search_path = '' as $$
declare uid text := auth.user_id();
begin
  if uid is null then raise exception 'auth_not_ready' using errcode = 'P0001', hint = 'retry'; end if;
  return uid;
end $$;
grant execute on function app.require_user() to authenticated;

create or replace function public.my_memberships() returns table (
  org_id uuid, role text, resident_id text, org_name text, city text, plan text, subscription_status text, trial_ends_at timestamptz, is_demo boolean
) language plpgsql stable security definer set search_path = '' as $$
declare uid text := app.require_user();
begin
  return query
    select m.org_id, m.role, m.resident_id, o.name, o.city, o.plan, o.subscription_status, o.trial_ends_at, o.is_demo
    from public.members m join public.orgs o on o.id = m.org_id
    where m.user_id = uid and not o.is_template
    order by o.is_demo, o.created_at;
end $$;

create or replace function public.org_snapshot(p_org uuid) returns jsonb language plpgsql stable as $$
declare
  uid text := app.require_user();
  staff_rows jsonb;
begin
  if not app.is_member(p_org) then raise exception 'not a member of this hostel'; end if;
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
revoke all on function public.org_snapshot(uuid) from public, anonymous;
grant execute on function public.org_snapshot(uuid) to authenticated;

-- polling: same guard, so a cold request is retried on the next tick instead of returning nothing
do $$
declare def text;
begin
  select pg_get_functiondef('public.changes_since(uuid, timestamptz)'::regprocedure) into def;
  if position('app.require_user()' in def) = 0 then
    def := replace(def, 'declare result jsonb := jsonb_build_object(''now'', now());', 'declare result jsonb := jsonb_build_object(''now'', now()); _uid text := app.require_user();');
    execute def;
  end if;
end $$;

-- let the Data API see new functions right away
notify pgrst, 'reload schema';
