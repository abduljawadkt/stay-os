-- Where each meal is had, day by day. Breakfast, lunch and dinner can each be at the resident's institute (college or
-- office) or at the hostel: their own block's dining ("hostel") or another block's ("block:<id>").
-- Defaults when nothing is chosen: breakfast and dinner at the hostel, lunch at the institute (as before).
-- lunch_at (db/migrations/007) stays, kept in step, so older copies of the app still read and write lunch.
begin;

create or replace function app.valid_meal_at(j jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(j) = 'object' and not exists (
    select 1 from jsonb_each(j) e
    where e.key not in ('breakfast', 'lunch', 'dinner') or jsonb_typeof(e.value) <> 'string'
       or (e.value #>> '{}') !~ '^(institute|hostel|block:[A-Za-z0-9_-]{1,12})$')
$$;

alter table public.meal_optouts add column if not exists meal_at jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meal_optouts_meal_at_check') then
    alter table public.meal_optouts add constraint meal_optouts_meal_at_check check (app.valid_meal_at(meal_at));
  end if;
end $$;

-- lunch chosen with the older app becomes the lunch place
update public.meal_optouts set meal_at = meal_at || '{"lunch": "hostel"}'::jsonb where lunch_at = 'hostel' and not (meal_at ? 'lunch');

-- keep lunch_at in step: a newer app sets meal_at, an older one sets lunch_at
create or replace function app.meal_at_sync() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.lunch_at is distinct from old.lunch_at and (new.meal_at -> 'lunch') is not distinct from (old.meal_at -> 'lunch') then
    -- an older app changed lunch only
    new.meal_at := case when new.lunch_at = 'hostel' then new.meal_at || '{"lunch": "hostel"}'::jsonb else new.meal_at - 'lunch' end;
  elsif new.meal_at ? 'lunch' then
    new.lunch_at := case when new.meal_at ->> 'lunch' = 'institute' then 'institute' else 'hostel' end;
  elsif new.lunch_at = 'hostel' then
    new.meal_at := new.meal_at || '{"lunch": "hostel"}'::jsonb;
  end if;
  return new;
end $$;
drop trigger if exists meal_at_sync on public.meal_optouts;
create trigger meal_at_sync before insert or update on public.meal_optouts for each row execute function app.meal_at_sync();

-- "Reset demo" copies the sample hostel's rows; keep the meal places when it does
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
  insert into public.meal_optouts (org_id, id, resident_id, date, meals, reason, source, created_at, updated_at, lunch_at, meal_at)
    select target, id, resident_id, date, meals, reason, source, created_at, now(), lunch_at, meal_at from public.meal_optouts where org_id = tpl;
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
