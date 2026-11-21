-- StayOS multi-tenant schema for Neon Postgres (Data API + Neon Auth).
-- Every row belongs to an org (a hostel). Row-level security uses auth.user_id() from the Neon Auth JWT.
-- Re-runnable: drops and recreates the app objects (not the neon_auth schema).

set check_function_bodies = off;
alter database neondb set timezone to 'Asia/Kolkata';
set timezone to 'Asia/Kolkata';

drop schema if exists app cascade;
drop table if exists public.payments, public.payment_settings, public.billing_invoices, public.invites, public.wa_threads, public.activity, public.notices, public.meal_optouts,
  public.visitors, public.leaves, public.gate_events, public.complaints, public.staff, public.expenses, public.invoices,
  public.residents, public.beds, public.rooms, public.members, public.orgs cascade;
drop function if exists public.create_org, public.reset_demo_data, public.changes_since, public.create_invite, public.accept_invite,
  public.checkout_plan, public.my_memberships, public.update_org_profile, public.staff_directory cascade;

-- ---------------------------------------------------------------------------
-- Tenants and people
-- ---------------------------------------------------------------------------
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '',
  address text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  upi_id text not null default '',
  bank text not null default '',
  owner_name text not null default '',
  owner_phone text not null default '',
  rent_by_type jsonb not null default '{"single":9000,"double":7000,"triple":6000,"six":4500}',
  mess_fee integer not null default 3000,
  deposit integer not null default 10000,
  due_day integer not null default 7,
  settings jsonb not null default '{}',
  plan text not null default 'growth' check (plan in ('starter', 'growth', 'scale')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  subscription_status text not null default 'trialing' check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz default now() + interval '14 days',
  current_period_end timestamptz,
  is_demo boolean not null default false,
  is_template boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner', 'warden', 'resident', 'parent')),
  resident_id text,
  name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.invites (
  code text primary key,
  org_id uuid not null references public.orgs (id) on delete cascade,
  role text not null check (role in ('warden', 'resident', 'parent')),
  resident_id text,
  created_by text,
  created_at timestamptz not null default now(),
  used_by text,
  used_at timestamptz
);

create table public.billing_invoices (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  plan text not null,
  cycle text not null,
  period_start date not null,
  period_end date not null,
  amount integer not null,
  gst integer not null,
  total integer not null,
  status text not null default 'paid',
  method text not null default 'upi',
  paid_at timestamptz not null default now(),
  primary key (org_id, id)
);

-- ---------------------------------------------------------------------------
-- Hostel data. Text ids are unique per org (R-1042, INV-2611-0208, ...).
-- Nested parts of the app's objects are jsonb.
-- ---------------------------------------------------------------------------
create table public.rooms (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  block text not null,
  floor integer not null,
  number text not null,
  type text not null check (type in ('single', 'double', 'triple', 'six')),
  rent integer not null,
  capacity integer not null,
  bath text not null default 'attached',
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.beds (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  room_id text not null,
  block text not null,
  floor integer not null,
  label text not null,
  status text not null check (status in ('occupied', 'vacant', 'reserved', 'maintenance')),
  resident_id text,
  reservation jsonb,
  maintenance_note text,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.residents (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  name text not null,
  gender text not null,
  phone text not null default '',
  dob date,
  blood_group text not null default '',
  hometown text not null default '',
  occupation text not null default 'student',
  institution text not null default '',
  parent jsonb not null default '{}',
  bed_id text not null,
  check_in_date date not null,
  check_out_date date,
  status text not null default 'active' check (status in ('active', 'notice', 'checked_out')),
  kyc jsonb not null default '{}',
  police jsonb not null default '{}',
  mess_plan boolean not null default true,
  deposit integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.invoices (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  resident_id text not null,
  month text not null,
  issued_on date not null,
  due_on date not null,
  lines jsonb not null default '[]',
  total integer not null,
  status text not null check (status in ('paid', 'unpaid')),
  paid_on timestamptz,
  method text,
  utr text,
  paid_via text,
  reminders_sent integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);
create index invoices_resident_idx on public.invoices (org_id, resident_id);

create table public.expenses (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  date date not null,
  category text not null,
  vendor text not null,
  description text not null default '',
  amount integer not null,
  mode text not null default 'bank',
  receipt jsonb,
  status text not null default 'paid',
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.staff (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  name text not null,
  role text not null,
  title text not null default '',
  salary integer not null default 0,
  shift text not null default '',
  phone text not null default '',
  joined_on date,
  attendance jsonb not null default '{}',
  advance integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.complaints (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  resident_id text not null,
  room_id text not null,
  category text not null,
  title text not null,
  description text not null default '',
  channel text not null,
  status text not null check (status in ('new', 'in_progress', 'resolved')),
  priority text not null default 'medium',
  created_at timestamptz not null,
  sla_hours integer not null,
  assigned_to text,
  resolved_at timestamptz,
  rating integer,
  updates jsonb not null default '[]',
  photo text,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.gate_events (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  resident_id text not null,
  type text not null check (type in ('in', 'out')),
  at timestamptz not null,
  method text not null default 'qr',
  late boolean not null default false,
  pass_id text,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);
create index gate_resident_idx on public.gate_events (org_id, resident_id);

create table public.leaves (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  resident_id text not null,
  "from" timestamptz not null,
  "to" timestamptz not null,
  reason text not null default '',
  destination text not null default '',
  status text not null,
  requested_at timestamptz not null,
  parent_decision_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.visitors (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  name text not null,
  phone text not null default '',
  relation text not null default '',
  resident_id text not null,
  purpose text not null default '',
  in_at timestamptz not null,
  out_at timestamptz,
  id_proof text not null default '',
  id_last4 text not null default '',
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.meal_optouts (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  resident_id text not null,
  date date not null,
  meals text[] not null default '{}',
  reason text not null default '',
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- where the resident has lunch that day: at their college or office, or back at the hostel
  lunch_at text not null default 'institute' check (lunch_at in ('institute', 'hostel')),
  primary key (org_id, id)
);
create index optouts_date_idx on public.meal_optouts (org_id, date);

create table public.notices (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  category text not null default 'general',
  pinned boolean not null default false,
  audience text not null default 'all',
  posted_at timestamptz not null default now(),
  title text not null,
  title_ml text not null default '',
  body text not null default '',
  body_ml text not null default '',
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.activity (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  at timestamptz not null,
  kind text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table public.wa_threads (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  contact_name text not null,
  role text not null,
  resident_id text not null,
  phone text not null default '',
  unread integer not null default 0,
  messages jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

-- updated_at on every write, so clients can poll for changes
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['orgs','rooms','beds','residents','invoices','expenses','staff','complaints','gate_events','leaves','visitors','meal_optouts','notices','activity','wa_threads']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer so they can read members without recursion)
-- ---------------------------------------------------------------------------
create schema app;

create function app.uid() returns text language sql stable as $$ select auth.user_id() $$;

create function app.role_in(o uuid) returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.members m where m.org_id = o and m.user_id = auth.user_id()
$$;

create function app.is_member(o uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.org_id = o and m.user_id = auth.user_id())
$$;

create function app.is_staff(o uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.org_id = o and m.user_id = auth.user_id() and m.role in ('owner', 'warden'))
$$;

create function app.is_owner(o uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.org_id = o and m.user_id = auth.user_id() and m.role = 'owner')
$$;

create function app.my_resident(o uuid) returns text language sql stable security definer set search_path = '' as $$
  select m.resident_id from public.members m where m.org_id = o and m.user_id = auth.user_id() and m.role in ('resident', 'parent')
$$;

create function app.room_of(bed text) returns text language sql immutable as $$
  select split_part(bed, '-', 1) || '-' || split_part(bed, '-', 2)
$$;

create function app.my_room(o uuid) returns text language sql stable security definer set search_path = '' as $$
  select app.room_of(r.bed_id) from public.residents r where r.org_id = o and r.id = app.my_resident(o)
$$;

grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
alter table public.orgs enable row level security;
create policy orgs_read on public.orgs for select to authenticated using (app.is_member(id));
create policy orgs_update on public.orgs for update to authenticated using (app.is_owner(id)) with check (app.is_owner(id));

alter table public.members enable row level security;
create policy members_read on public.members for select to authenticated
  using (app.is_staff(org_id) or user_id = auth.user_id());
create policy members_write on public.members for all to authenticated using (app.is_owner(org_id)) with check (app.is_owner(org_id));

alter table public.invites enable row level security;
create policy invites_staff on public.invites for all to authenticated using (app.is_staff(org_id)) with check (app.is_staff(org_id));

alter table public.billing_invoices enable row level security;
create policy billing_owner on public.billing_invoices for select to authenticated using (app.is_owner(org_id));

-- shared reads: every member; writes: staff
do $$
declare t text;
begin
  foreach t in array array['rooms','beds','notices']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_read on public.%I for select to authenticated using (app.is_member(org_id))', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (app.is_staff(org_id)) with check (app.is_staff(org_id))', t, t);
  end loop;
end $$;

-- staff only
do $$
declare t text;
begin
  foreach t in array array['expenses','staff','activity']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_staff on public.%I for all to authenticated using (app.is_staff(org_id)) with check (app.is_staff(org_id))', t, t);
  end loop;
end $$;

create policy activity_member_insert on public.activity for insert to authenticated with check (app.is_member(org_id));

-- residents and parents see their own rows (and residents see roommates); staff see everything
alter table public.residents enable row level security;
create policy residents_read on public.residents for select to authenticated
  using (app.is_staff(org_id) or id = app.my_resident(org_id) or app.room_of(bed_id) = app.my_room(org_id));
create policy residents_write on public.residents for all to authenticated using (app.is_staff(org_id)) with check (app.is_staff(org_id));

do $$
declare t text;
begin
  foreach t in array array['invoices','complaints','gate_events','leaves','visitors','meal_optouts','wa_threads']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I_read on public.%I for select to authenticated using (app.is_staff(org_id) or resident_id = app.my_resident(org_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (app.is_staff(org_id) or resident_id = app.my_resident(org_id))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using (app.is_staff(org_id) or resident_id = app.my_resident(org_id)) with check (app.is_staff(org_id) or resident_id = app.my_resident(org_id))', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (app.is_staff(org_id))', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Functions the app calls (Data API rpc)
-- ---------------------------------------------------------------------------

-- The orgs and memberships of the signed-in user
create function public.my_memberships() returns table (
  org_id uuid, role text, resident_id text, org_name text, city text, plan text, subscription_status text, trial_ends_at timestamptz, is_demo boolean
) language sql stable security definer set search_path = '' as $$
  select m.org_id, m.role, m.resident_id, o.name, o.city, o.plan, o.subscription_status, o.trial_ends_at, o.is_demo
  from public.members m join public.orgs o on o.id = m.org_id
  where m.user_id = auth.user_id() and not o.is_template
  order by o.is_demo, o.created_at
$$;

-- Copy every row of the sample hostel (the template org) into another org
create function app.copy_template(target uuid) returns void language plpgsql security definer set search_path = '' as $$
declare tpl uuid;
begin
  select id into tpl from public.orgs where is_template limit 1;
  if tpl is null then raise exception 'sample data is not loaded'; end if;
  insert into public.rooms select target, id, block, floor, number, type, rent, capacity, bath, now() from public.rooms where org_id = tpl;
  insert into public.beds select target, id, room_id, block, floor, label, status, resident_id, reservation, maintenance_note, now() from public.beds where org_id = tpl;
  insert into public.residents select target, id, name, gender, phone, dob, blood_group, hometown, occupation, institution, parent, bed_id, check_in_date, check_out_date, status, kyc, police, mess_plan, deposit, now() from public.residents where org_id = tpl;
  insert into public.invoices select target, id, resident_id, month, issued_on, due_on, lines, total, status, paid_on, method, utr, paid_via, reminders_sent, now() from public.invoices where org_id = tpl;
  insert into public.expenses select target, id, date, category, vendor, description, amount, mode, receipt, status, now() from public.expenses where org_id = tpl;
  insert into public.staff select target, id, name, role, title, salary, shift, phone, joined_on, attendance, advance, now() from public.staff where org_id = tpl;
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
end $$;

create function app.clear_org(target uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.wa_threads where org_id = target;
  delete from public.activity where org_id = target;
  delete from public.notices where org_id = target;
  delete from public.meal_optouts where org_id = target;
  delete from public.visitors where org_id = target;
  delete from public.leaves where org_id = target;
  delete from public.gate_events where org_id = target;
  delete from public.complaints where org_id = target;
  delete from public.staff where org_id = target;
  delete from public.expenses where org_id = target;
  delete from public.invoices where org_id = target;
  delete from public.residents where org_id = target;
  delete from public.beds where org_id = target;
  delete from public.rooms where org_id = target;
end $$;

-- Rooms and beds for an empty hostel: blocks x floors, 10 rooms (25 beds) per floor
create function app.build_layout(target uuid, blocks integer, floors integer) returns void language plpgsql security definer set search_path = '' as $$
declare
  b integer; f integer; letter text; layout text[][] := array[
    array['01','single'], array['02','single'], array['03','double'], array['04','double'], array['05','double'],
    array['06','double'], array['07','triple'], array['08','triple'], array['09','triple'], array['10','six']];
  i integer; rid text; typ text; cap integer; rents jsonb;
begin
  select rent_by_type into rents from public.orgs where id = target;
  for b in 1..greatest(1, least(blocks, 6)) loop
    letter := chr(64 + b);
    for f in 1..greatest(1, least(floors, 8)) loop
      for i in 1..10 loop
        rid := letter || '-' || f || layout[i][1];
        typ := layout[i][2];
        cap := case typ when 'single' then 1 when 'double' then 2 when 'triple' then 3 else 6 end;
        insert into public.rooms values (target, rid, letter, f, f || layout[i][1], typ, (rents ->> typ)::integer, cap, case when typ = 'six' then 'common' else 'attached' end, now());
        insert into public.beds (org_id, id, room_id, block, floor, label, status)
          select target, rid || '-' || g, rid, letter, f, g::text, 'vacant' from generate_series(1, cap) g;
      end loop;
    end loop;
  end loop;
end $$;

-- Create a hostel for the signed-in user (they become its owner)
create function public.create_org(p_name text, p_city text, p_sample boolean default true, p_blocks integer default 2, p_floors integer default 3)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid text := auth.user_id();
  new_id uuid;
  uname text; uemail text;
begin
  if uid is null then raise exception 'sign in first'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'hostel name is required'; end if;
  select u.name, u.email into uname, uemail from neon_auth."user" u where u.id::text = uid;
  insert into public.orgs (name, city, owner_name, created_by, settings)
    values (trim(p_name), coalesce(trim(p_city), ''), coalesce(uname, ''), uid,
      jsonb_build_object('clock', jsonb_build_object('mode', 'real'), 'blocks', '[]'::jsonb))
    returning id into new_id;
  insert into public.members (org_id, user_id, role, name, email) values (new_id, uid, 'owner', coalesce(uname, ''), coalesce(uemail, ''));
  if p_sample then
    perform app.copy_template(new_id);
  else
    perform app.build_layout(new_id, p_blocks, p_floors);
    update public.orgs set settings = settings
      || jsonb_build_object('mess', (select t.settings -> 'mess' from public.orgs t where t.is_template limit 1))
      || jsonb_build_object('blocks', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b, 'name', 'Block ' || b, 'gender', 'M', 'floors', p_floors, 'curfew', '22:00') order by b), '[]'::jsonb)
      from (select distinct block as b from public.rooms where org_id = new_id) x))
    where id = new_id;
  end if;
  return new_id;
end $$;

-- Owner: wipe the hostel and load the sample data again (the guided demo uses this)
create function public.reset_demo_data(p_org uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_owner(p_org) then raise exception 'only the owner can reset data'; end if;
  perform app.clear_org(p_org);
  perform app.copy_template(p_org);
end $$;

-- Everything in the org that changed after p_since (RLS still applies: security invoker)
create function public.changes_since(p_org uuid, p_since timestamptz) returns jsonb language plpgsql stable as $$
declare result jsonb := jsonb_build_object('now', now());
begin
  if (select (settings ->> 'reset_at')::timestamptz > p_since from public.orgs where id = p_org) then
    return result || jsonb_build_object('reload', true);
  end if;
  result := result
    || jsonb_build_object('beds', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.beds t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('residents', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.residents t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('invoices', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.invoices t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('expenses', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.expenses t where org_id = p_org and updated_at > p_since))
    || jsonb_build_object('staff', (select coalesce(jsonb_agg(to_jsonb(t) - 'org_id'), '[]') from public.staff t where org_id = p_org and updated_at > p_since))
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
end $$;

-- Staff: invite a warden, a resident or a parent with a short code
create function public.create_invite(p_org uuid, p_role text, p_resident_id text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not app.is_staff(p_org) then raise exception 'only staff can invite'; end if;
  if p_role = 'warden' and not app.is_owner(p_org) then raise exception 'only the owner can invite wardens'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites (code, org_id, role, resident_id, created_by) values (c, p_org, p_role, p_resident_id, auth.user_id());
  return c;
end $$;

create function public.accept_invite(p_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.invites; uname text; uemail text;
begin
  select * into inv from public.invites where code = upper(trim(p_code)) and used_at is null;
  if inv.code is null then raise exception 'that invite code is not valid'; end if;
  select u.name, u.email into uname, uemail from neon_auth."user" u where u.id::text = auth.user_id();
  insert into public.members (org_id, user_id, role, resident_id, name, email)
    values (inv.org_id, auth.user_id(), inv.role, inv.resident_id, coalesce(uname, ''), coalesce(uemail, ''))
    on conflict (org_id, user_id) do update set role = excluded.role, resident_id = excluded.resident_id;
  update public.invites set used_by = auth.user_id(), used_at = now() where code = inv.code;
  return inv.org_id;
end $$;

-- Owner: subscribe to a plan (test-mode checkout; a payment gateway webhook replaces this in production)
create function public.checkout_plan(p_org uuid, p_plan text, p_cycle text, p_method text default 'upi') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  base integer := case p_plan when 'starter' then 1999 when 'growth' then 4999 when 'scale' then 9999 else null end;
  amount integer; gst integer; period_end date; inv_id text;
begin
  if not app.is_owner(p_org) then raise exception 'only the owner can change the plan'; end if;
  if base is null or p_cycle not in ('monthly', 'yearly') then raise exception 'unknown plan'; end if;
  amount := case when p_cycle = 'yearly' then base * 10 else base end;
  gst := round(amount * 0.18);
  period_end := (current_date + case when p_cycle = 'yearly' then interval '1 year' else interval '1 month' end)::date;
  inv_id := 'SO-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
  update public.orgs set plan = p_plan, billing_cycle = p_cycle, subscription_status = 'active', trial_ends_at = null, current_period_end = period_end where id = p_org;
  insert into public.billing_invoices (org_id, id, plan, cycle, period_start, period_end, amount, gst, total, method)
    values (p_org, inv_id, p_plan, p_cycle, current_date, period_end, amount, gst, amount + gst, p_method);
  return jsonb_build_object('invoice', inv_id, 'total', amount + gst, 'period_end', period_end);
end $$;

-- Names and roles of the hostel staff, for residents and parents (no salary or attendance)
create function public.staff_directory(p_org uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select case when app.is_member(p_org) then coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'role', s.role, 'title', s.title, 'shift', s.shift, 'phone', s.phone) order by s.id), '[]'::jsonb) end
  from public.staff s where s.org_id = p_org
$$;

-- ---------------------------------------------------------------------------
-- Grants for the Data API roles
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anonymous;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.orgs, public.billing_invoices from authenticated;
-- owners edit the profile directly; plan and subscription only change through checkout_plan
grant update (name, city, address, phone, whatsapp, upi_id, bank, owner_name, owner_phone, rent_by_type, mess_fee, deposit, due_day)
  on public.orgs to authenticated;
revoke all on function public.create_org, public.reset_demo_data, public.changes_since, public.create_invite, public.accept_invite,
  public.checkout_plan, public.my_memberships, public.staff_directory from public, anonymous;
grant execute on function public.create_org, public.reset_demo_data, public.changes_since, public.create_invite, public.accept_invite,
  public.checkout_plan, public.my_memberships, public.staff_directory to authenticated;
revoke execute on function public.touch_updated_at from public, anonymous;
revoke execute on function app.copy_template, app.clear_org, app.build_layout from public, authenticated;
