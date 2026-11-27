-- Expenses (bills, receipts, salaries paid) are the owner's. Wardens no longer receive them at all:
-- before, the app only hid the Expenses page from the warden while the rows still reached their phone.

drop policy if exists expenses_staff on public.expenses;
drop policy if exists expenses_owner on public.expenses;
create policy expenses_owner on public.expenses for all to authenticated
  using (app.is_owner(org_id)) with check (app.is_owner(org_id));
