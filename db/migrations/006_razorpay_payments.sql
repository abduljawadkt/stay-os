-- Real rent payments through each hostel's own Razorpay account.
-- payment_settings holds the hostel's Razorpay keys, encrypted by the payments function. No app user can
-- read it, not even the owner: only the payments function (database owner role) touches it.
create table if not exists public.payment_settings (
  org_id uuid primary key references public.orgs (id) on delete cascade,
  provider text not null default 'razorpay',
  key_id text not null,
  key_secret_enc text not null,
  webhook_secret_enc text not null,
  mode text not null check (mode in ('test', 'live')),
  connected_by text,
  connected_at timestamptz not null default now()
);
alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from public, anonymous, authenticated;

-- One row per payment link. Staff can see them all; residents and parents their own invoices' links.
create table if not exists public.payments (
  org_id uuid not null references public.orgs (id) on delete cascade,
  id text not null,
  invoice_id text not null,
  provider text not null default 'razorpay',
  url text not null,
  amount integer not null,
  status text not null default 'created' check (status in ('created', 'paid', 'expired', 'cancelled')),
  via text not null default 'app',
  created_by text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  provider_payment_id text,
  method text,
  reference text,
  primary key (org_id, id)
);
create index if not exists payments_invoice_idx on public.payments (org_id, invoice_id);
alter table public.payments enable row level security;
revoke all on public.payments from public, anonymous;
grant select on public.payments to authenticated;
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (
  app.is_staff(org_id)
  or exists (select 1 from public.invoices i where i.org_id = payments.org_id and i.id = payments.invoice_id and i.resident_id = app.my_resident(payments.org_id))
);
