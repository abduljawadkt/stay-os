-- Staff pay (salary and advance) is for the owner only. Wardens manage staff and attendance, so they can read
-- public.staff; pay now lives in public.staff_pay, which only owners can read.
--
-- The app keeps sending pay with each staff row. A trigger moves it into staff_pay when the owner writes (or the
-- database itself, e.g. creating a sample hostel), ignores it from anyone else, and leaves 0 in public.staff.
-- org_snapshot and changes_since put it back into the staff rows for owners only.
begin;

create table if not exists public.staff_pay (
  org_id uuid not null,
  staff_id text not null,
  salary integer not null default 0,
  advance integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, staff_id),
  -- deferred: the trigger below writes pay before the staff row itself is in
  foreign key (org_id, staff_id) references public.staff (org_id, id) on delete cascade deferrable initially deferred
);
alter table public.staff_pay enable row level security;
drop policy if exists staff_pay_owner on public.staff_pay;
create policy staff_pay_owner on public.staff_pay for select to authenticated using (app.is_owner(org_id));
drop policy if exists staff_pay_org_active on public.staff_pay;
create policy staff_pay_org_active on public.staff_pay as restrictive for all to authenticated using (app.org_active(org_id)) with check (app.org_active(org_id));
revoke all on public.staff_pay from public, authenticated;
grant select on public.staff_pay to authenticated; -- clients only read it; pay is written through public.staff

-- move today's pay across, then clear it from public.staff (before the trigger exists)
insert into public.staff_pay (org_id, staff_id, salary, advance)
  select org_id, id, coalesce(salary, 0), coalesce(advance, 0) from public.staff
  on conflict (org_id, staff_id) do update set salary = excluded.salary, advance = excluded.advance, updated_at = now();
update public.staff set salary = 0, advance = 0 where salary <> 0 or advance <> 0;

/** Owner (or the database itself): store this staff member's pay. Anyone else is refused. */
create or replace function app.put_staff_pay(o uuid, s text, sal integer, adv integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.user_id() is not null and not app.is_owner(o) then raise exception 'only the owner can change pay'; end if;
  insert into public.staff_pay (org_id, staff_id, salary, advance) values (o, s, coalesce(sal, 0), coalesce(adv, 0))
  on conflict (org_id, staff_id) do update set salary = excluded.salary, advance = excluded.advance, updated_at = now()
  where (public.staff_pay.salary, public.staff_pay.advance) is distinct from (excluded.salary, excluded.advance);
end $$;
revoke all on function app.put_staff_pay(uuid, text, integer, integer) from public;
grant execute on function app.put_staff_pay(uuid, text, integer, integer) to authenticated;

-- security definer: wardens may not read the auth schema. auth.user_id() still sees who is writing (it comes from
-- the request's sign-in token, not the database role).
create or replace function app.staff_pay_split() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- an app save is an upsert: the insert half carries the pay; the update half only sees the 0 the insert half left,
  -- so an update that brings no new pay (same as the 0 stored here) leaves staff_pay alone
  if tg_op = 'UPDATE' and new.salary is not distinct from old.salary and new.advance is not distinct from old.advance then
    null;
  elsif app.is_owner(new.org_id) then
    perform app.put_staff_pay(new.org_id, new.id, new.salary, new.advance);
  elsif auth.user_id() is null and (coalesce(new.salary, 0) <> 0 or coalesce(new.advance, 0) <> 0) then
    -- the database itself (setup scripts, sample data); zeros here are a copy of public.staff, not real pay
    perform app.put_staff_pay(new.org_id, new.id, new.salary, new.advance);
  end if;
  new.salary := 0;
  new.advance := 0;
  return new;
end $$;
drop trigger if exists staff_pay_split on public.staff;
create trigger staff_pay_split before insert or update on public.staff for each row execute function app.staff_pay_split();

-- staff rows with pay added back: the owner sees it, wardens get 0 (staff_pay's rules hide it from them)
create or replace function app.staff_json(t public.staff) returns jsonb
language sql stable set search_path = '' as $$
  select (to_jsonb(t) - 'org_id') || coalesce(
    (select jsonb_build_object('salary', p.salary, 'advance', p.advance) from public.staff_pay p where p.org_id = t.org_id and p.staff_id = t.id),
    '{}'::jsonb)
$$;
grant execute on function app.staff_json(public.staff) to authenticated;

create or replace function public.org_snapshot(p_org uuid)
 returns jsonb
 language plpgsql
 stable
as $function$
declare
  uid text := app.require_user();
  staff_rows jsonb;
begin
  if not app.is_member(p_org) then raise exception 'not a member of this hostel'; end if;
  if not app.org_active(p_org) then raise exception 'hostel_locked' using errcode = 'P0001', hint = 'StayOS has not approved this hostel'; end if;
  if app.is_staff(p_org) then
    select coalesce(jsonb_agg(app.staff_json(t) order by t.id), '[]') into staff_rows from public.staff t where t.org_id = p_org;
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
end $function$;

create or replace function public.changes_since(p_org uuid, p_since timestamp with time zone)
 returns jsonb
 language plpgsql
 stable
as $function$
declare result jsonb := jsonb_build_object('now', now()); _uid text := app.require_user();
begin
  if (select (settings ->> 'reset_at')::timestamptz > p_since from public.orgs where id = p_org) then
    return result || jsonb_build_object('reload', true);
  end if;
  result := result
    || jsonb_build_object('beds', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.beds t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('residents', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.residents t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('invoices', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.invoices t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('expenses', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.expenses t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('staff', (select coalesce(jsonb_agg(app.staff_json(t)), '[]') from public.staff t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('complaints', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.complaints t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('gate_events', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.gate_events t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('leaves', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.leaves t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('visitors', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.visitors t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('meal_optouts', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.meal_optouts t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('notices', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.notices t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('activity', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.activity t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('wa_threads', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.wa_threads t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('org_updated', (select updated_at > p_since from public.orgs where id = p_org));
  return result;
end $function$;

-- sample hostels copy the template's pay from staff_pay (public.staff holds 0 now)
create or replace function app.copy_template(target uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare tpl uuid;
begin
  select id into tpl from public.orgs where is_template limit 1;
  if tpl is null then raise exception 'sample data is not loaded'; end if;
  insert into public.rooms select target, id, block, floor, number, type, rent, capacity, bath, now() from public.rooms where org_id = tpl;
  insert into public.beds select target, id, room_id, block, floor, label, status, resident_id, reservation, maintenance_note, now() from public.beds where org_id = tpl;
  insert into public.residents select target, id, name, gender, phone, dob, blood_group, hometown, occupation, institution, parent, bed_id, check_in_date, check_out_date, status, kyc, police, mess_plan, deposit, now() from public.residents where org_id = tpl;
  insert into public.invoices select target, id, resident_id, month, issued_on, due_on, lines, total, status, paid_on, method, utr, paid_via, reminders_sent, now() from public.invoices where org_id = tpl;
  insert into public.expenses select target, id, date, category, vendor, description, amount, mode, receipt, status, now() from public.expenses where org_id = tpl;
  insert into public.staff select target, id, name, role, title, 0, shift, phone, joined_on, attendance, 0, now() from public.staff where org_id = tpl;
  insert into public.staff_pay (org_id, staff_id, salary, advance) select target, staff_id, salary, advance from public.staff_pay where org_id = tpl
    on conflict (org_id, staff_id) do update set salary = excluded.salary, advance = excluded.advance, updated_at = now();
  insert into public.complaints select target, id, resident_id, room_id, category, title, description, channel, status, priority, created_at, sla_hours, assigned_to, resolved_at, rating, updates, photo, now() from public.complaints where org_id = tpl;
  insert into public.gate_events select target, id, resident_id, type, at, method, late, pass_id, now() from public.gate_events where org_id = tpl;
  insert into public.leaves select target, id, resident_id, "from", "to", reason, destination, status, requested_at, parent_decision_at, now() from public.leaves where org_id = tpl;
  insert into public.visitors select target, id, name, phone, relation, resident_id, purpose, in_at, out_at, id_proof, id_last4, now() from public.visitors where org_id = tpl;
  insert into public.meal_optouts (org_id, id, resident_id, date, meals, reason, source, created_at, updated_at, lunch_at)
    select target, id, resident_id, date, meals, reason, source, created_at, now(), lunch_at from public.meal_optouts where org_id = tpl;
  insert into public.notices select target, id, category, pinned, audience, posted_at, title, title_ml, body, body_ml, now() from public.notices where org_id = tpl;
  insert into public.activity select target, id, at, kind, data, now() from public.activity where org_id = tpl;
  insert into public.wa_threads select target, id, contact_name, role, resident_id, phone, unread, messages, now() from public.wa_threads where org_id = tpl;
  update public.orgs o set
    settings = t.settings || jsonb_build_object('reset_at', now()),
    rent_by_type = t.rent_by_type, mess_fee = t.mess_fee, deposit = t.deposit, due_day = t.due_day,
    address = coalesce(nullif(o.address, ''), t.address), phone = coalesce(nullif(o.phone, ''), t.phone),
    whatsapp = coalesce(nullif(o.whatsapp, ''), t.whatsapp), upi_id = coalesce(nullif(o.upi_id, ''), t.upi_id),
    bank = coalesce(nullif(o.bank, ''), t.bank), owner_name = coalesce(nullif(o.owner_name, ''), t.owner_name),
    owner_phone = coalesce(nullif(o.owner_phone, ''), t.owner_phone)
  from public.orgs t
  where o.id = target and t.id = tpl;
end $function$;

commit;
