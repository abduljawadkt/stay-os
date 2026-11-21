-- Lunch spot: residents choose, day by day, whether they have lunch at their institute (the default)
-- or at the hostel. Stored on the same per-day meal row as skipped meals, which residents may already write.

alter table public.meal_optouts add column if not exists lunch_at text not null default 'institute';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meal_optouts_lunch_at_check') then
    alter table public.meal_optouts add constraint meal_optouts_lunch_at_check check (lunch_at in ('institute', 'hostel'));
  end if;
end $$;

-- "Reset demo" copies the sample hostel's rows; keep the lunch spot when it does
create or replace function app.copy_template(target uuid) returns void language plpgsql security definer set search_path = '' as $$
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

-- Sample data: some residents have lunch at the hostel in the week the demo shows (more on Sunday)
do $$
declare o uuid; d date; pct int;
begin
  for o in select id from public.orgs where is_template or is_demo loop
    for d in select generate_series(date '2026-11-27', date '2026-12-03', interval '1 day')::date loop
      pct := case when extract(isodow from d) = 7 then 70 when extract(isodow from d) = 6 then 35 else 9 end;
      update public.meal_optouts m set lunch_at = 'hostel'
        where m.org_id = o and m.date = d and not ('lunch' = any (m.meals))
          and abs(hashtext(m.resident_id || d::text)) % 100 < pct;
      insert into public.meal_optouts (org_id, id, resident_id, date, meals, reason, source, created_at, lunch_at)
        select o, 'OL-' || to_char(d, 'MMDD') || '-' || r.id, r.id, d, '{}', '', 'app', (d - 1) + time '20:15' - interval '5 hours 30 minutes', 'hostel'
        from public.residents r
        where r.org_id = o and r.status <> 'checked_out' and r.mess_plan and r.check_in_date <= d
          and abs(hashtext(r.id || d::text)) % 100 < pct
          and not exists (select 1 from public.meal_optouts x where x.org_id = o and x.resident_id = r.id and x.date = d)
        on conflict (org_id, id) do nothing;
    end loop;
  end loop;
end $$;
