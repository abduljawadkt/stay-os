-- Residents and parents record activity about themselves ("Anjali raised a complaint", "skipped lunch", "leave
-- approved"), which the staff dashboard shows live. Before, only staff could write the activity log, so every resident
-- and parent action ended with "That change wasn't allowed". They may add and see entries about their own resident only;
-- the hostel-wide feed stays staff-only.

-- replaces activity_member_insert, which let any member add entries about anyone
drop policy if exists activity_member_insert on public.activity;
drop policy if exists activity_family_read on public.activity;
drop policy if exists activity_family_insert on public.activity;
drop policy if exists activity_family_update on public.activity;

create policy activity_family_read on public.activity for select to authenticated
  using ((data ->> 'residentId') = app.my_resident(org_id));
create policy activity_family_insert on public.activity for insert to authenticated
  with check ((data ->> 'residentId') = app.my_resident(org_id));
create policy activity_family_update on public.activity for update to authenticated
  using ((data ->> 'residentId') = app.my_resident(org_id)) with check ((data ->> 'residentId') = app.my_resident(org_id));
