-- Residents and parents can only do what their app lets them do. Enforced in the database, not just the UI.
--  * Invoices are read-only for them. Paying online goes through pay_invoice_test(), which only works in
--    sample hostels until a payment gateway confirms real payments. Staff still record cash and bank payments.
--  * Leave: a resident can request and cancel; only the parent decides.
--  * Complaints: a resident can raise one and rate it; only staff assign or resolve.
--  * Gate log and visitors: staff only.

-- invoices
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
create policy invoices_insert on public.invoices for insert to authenticated with check (app.is_staff(org_id));
create policy invoices_update on public.invoices for update to authenticated using (app.is_staff(org_id)) with check (app.is_staff(org_id));

-- gate log and visitors
drop policy if exists gate_events_insert on public.gate_events;
drop policy if exists gate_events_update on public.gate_events;
create policy gate_events_insert on public.gate_events for insert to authenticated with check (app.is_staff(org_id));
create policy gate_events_update on public.gate_events for update to authenticated using (app.is_staff(org_id)) with check (app.is_staff(org_id));
drop policy if exists visitors_insert on public.visitors;
drop policy if exists visitors_update on public.visitors;
create policy visitors_insert on public.visitors for insert to authenticated with check (app.is_staff(org_id));
create policy visitors_update on public.visitors for update to authenticated using (app.is_staff(org_id)) with check (app.is_staff(org_id));

-- test-mode online payment (sample hostels only)
create or replace function public.pay_invoice_test(p_org uuid, p_invoice text, p_via text default 'app', p_paid_on timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv public.invoices;
  sample boolean;
begin
  perform app.require_user();
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
revoke all on function public.pay_invoice_test(uuid, text, text, timestamptz) from public, anonymous;
grant execute on function public.pay_invoice_test(uuid, text, text, timestamptz) to authenticated;

-- leave and complaint rules for residents and parents
create or replace function app.guard_family_writes() returns trigger language plpgsql security definer set search_path = '' as $$
declare r text := app.role_in(new.org_id);
begin
  if r is null or r in ('owner', 'warden') then return new; end if;

  if tg_table_name = 'leaves' then
    if tg_op = 'INSERT' then
      if r <> 'resident' or new.status <> 'awaiting_parent' or new.parent_decision_at is not null then
        raise exception 'only the resident can request leave, and only the parent can decide it';
      end if;
    elsif (new.resident_id, new."from", new."to", new.reason, new.destination, new.requested_at)
          is distinct from (old.resident_id, old."from", old."to", old.reason, old.destination, old.requested_at) then
      raise exception 'leave details can only be changed by staff';
    elsif new.status is distinct from old.status then
      if r = 'parent' and old.status = 'awaiting_parent' and new.status in ('approved', 'rejected') then null;
      elsif r = 'resident' and old.status = 'awaiting_parent' and new.status = 'cancelled' then null;
      else raise exception 'only the parent can approve or reject leave';
      end if;
    end if;
  end if;

  if tg_table_name = 'complaints' then
    if tg_op = 'INSERT' then
      if new.status <> 'new' or new.assigned_to is not null or new.resolved_at is not null or new.rating is not null then
        raise exception 'a new complaint starts unassigned';
      end if;
    elsif (new.resident_id, new.room_id, new.category, new.status, new.priority, new.assigned_to, new.resolved_at, new.created_at, new.sla_hours, new.channel)
          is distinct from (old.resident_id, old.room_id, old.category, old.status, old.priority, old.assigned_to, old.resolved_at, old.created_at, old.sla_hours, old.channel) then
      raise exception 'only staff can assign or resolve complaints';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.guard_family_writes() from public, authenticated, anonymous;

drop trigger if exists leaves_family_guard on public.leaves;
create trigger leaves_family_guard before insert or update on public.leaves for each row execute function app.guard_family_writes();
drop trigger if exists complaints_family_guard on public.complaints;
create trigger complaints_family_guard before insert or update on public.complaints for each row execute function app.guard_family_writes();

notify pgrst, 'reload schema';
