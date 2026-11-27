-- Real WhatsApp, from one StayOS number (Meta WhatsApp Cloud API, sent by the `whatsapp` Neon Function).
-- The app keeps writing messages into each conversation (wa_threads) as before; the function sends the hostel's
-- template messages from there and logs each one here. Only real hostels whose owner switched WhatsApp on are sent
-- to, and only messages written after that moment. Sample and demo hostels never send (their phone numbers are made up).

create table if not exists public.wa_outbox (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  thread_id text,
  message_id text,
  resident_id text,
  role text not null default 'resident',
  to_phone text not null,
  template text not null,
  params jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'dry_run', 'skipped')),
  wamid text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);
create unique index if not exists wa_outbox_message on public.wa_outbox (org_id, thread_id, message_id) where message_id is not null;
create index if not exists wa_outbox_wamid on public.wa_outbox (wamid) where wamid is not null;
drop trigger if exists wa_outbox_touch on public.wa_outbox;
create trigger wa_outbox_touch before update on public.wa_outbox for each row execute function public.touch_updated_at();

-- staff see what was sent and whether it arrived; only the server writes
alter table public.wa_outbox enable row level security;
drop policy if exists wa_outbox_staff_read on public.wa_outbox;
create policy wa_outbox_staff_read on public.wa_outbox for select to authenticated using (app.is_staff(org_id));
drop policy if exists wa_outbox_org_active on public.wa_outbox;
create policy wa_outbox_org_active on public.wa_outbox as restrictive for all to authenticated using (app.org_active(org_id)) with check (app.org_active(org_id));
revoke insert, update, delete on public.wa_outbox from authenticated;
grant select on public.wa_outbox to authenticated;

-- Owner: switch WhatsApp on or off for the hostel, and the daily rent reminders
create or replace function public.set_whatsapp(p_org uuid, p_enabled boolean, p_reminders boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cur jsonb; out jsonb;
begin
  perform app.require_user();
  if not app.is_owner(p_org) then raise exception 'only the owner can change WhatsApp'; end if;
  if (select is_demo or coalesce(settings -> 'clock' ->> 'mode', 'real') = 'demo' from public.orgs where id = p_org) then
    raise exception 'sample hostels can''t send real WhatsApp messages';
  end if;
  select coalesce(settings -> 'whatsapp', '{}'::jsonb) into cur from public.orgs where id = p_org;
  out := jsonb_build_object('enabled', p_enabled, 'reminders', p_reminders,
    -- only messages from this moment on are sent, so switching on doesn't replay old ones
    'since', case when p_enabled and not coalesce((cur ->> 'enabled')::boolean, false) then to_jsonb(now()) else coalesce(cur -> 'since', to_jsonb(now())) end);
  update public.orgs set settings = jsonb_set(settings, '{whatsapp}', out) where id = p_org;
  return out;
end $$;
revoke all on function public.set_whatsapp(uuid, boolean, boolean) from public, anonymous;
grant execute on function public.set_whatsapp(uuid, boolean, boolean) to authenticated;
