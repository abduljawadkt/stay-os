-- Parents approving a gate pass (and residents changing their own complaints) failed with "only the resident can request
-- leave, and only the parent can decide it": the app saves with an upsert, and the guard from 003 treated every upsert
-- as a new request. Same rules as 003, judged on the right step.

create or replace function app.guard_family_writes() returns trigger language plpgsql security definer set search_path = '' as $$
declare r text := app.role_in(new.org_id); existing boolean;
begin
  if r is null or r in ('owner', 'warden') then return new; end if;

  -- The app saves with "insert, or update if it's there". Postgres runs this guard as an INSERT first even when the row
  -- exists, then again as an UPDATE with the old row. So a row that exists is judged by the update rules only.
  if tg_op = 'INSERT' then
    execute format('select exists (select 1 from public.%I where org_id = $1 and id = $2)', tg_table_name) into existing using new.org_id, new.id;
    if existing then return new; end if;
  end if;

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
