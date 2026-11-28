-- Hostel setup: the owner changes what was fixed when the hostel was created.
--   set_rents     rent for each room type, applied to every room of that type (bills already raised stay as they are)
--   set_blocks    each block's name, who it is for (men or women) and its gate time; adds blocks
--   set_cutoffs   until when residents can skip a meal or change where they have it
--   add_room, set_room, remove_room   rooms and their beds
-- Only the owner, only while the hostel is running, and never in the shared live demo (every visitor shares it).
-- Each change stamps settings.layout_at, and changes_since then tells every open device to load the hostel again.
begin;

create or replace function app.setup_guard(p_org uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_user();
  if not app.is_owner(p_org) then raise exception 'only the owner can change the hostel setup'; end if;
  if not app.org_active(p_org) then raise exception 'hostel_locked' using errcode = 'P0001'; end if;
  if (select is_demo from public.orgs where id = p_org) then
    raise exception 'the live demo is shared by everyone, so its setup can''t be changed. Your own hostel can.';
  end if;
end $$;
revoke all on function app.setup_guard(uuid) from public, anonymous;
grant execute on function app.setup_guard(uuid) to authenticated;

create or replace function app.touch_layout(p_org uuid) returns void
language sql security definer set search_path = '' as $$
  update public.orgs set settings = settings || jsonb_build_object('layout_at', now()), updated_at = now() where id = p_org
$$;
revoke all on function app.touch_layout(uuid) from public, authenticated, anonymous;

create or replace function app.capacity_of(typ text) returns integer language sql immutable set search_path = '' as $$
  select case typ when 'single' then 1 when 'double' then 2 when 'triple' then 3 when 'six' then 6 end
$$;
grant execute on function app.capacity_of(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rent for each room type
create or replace function public.set_rents(p_org uuid, p_rents jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; out jsonb := '{}'::jsonb;
begin
  perform app.setup_guard(p_org);
  foreach k in array array['single', 'double', 'triple', 'six'] loop
    v := p_rents -> k;
    if v is null or jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric)
       or (v #>> '{}')::numeric not between 0 and 1000000 then
      raise exception 'rent for % rooms must be a whole number of rupees, up to 10,00,000', k;
    end if;
    out := out || jsonb_build_object(k, (v #>> '{}')::integer);
  end loop;
  update public.orgs set rent_by_type = out where id = p_org;
  update public.rooms r set rent = (out ->> r.type)::integer, updated_at = now()
    where r.org_id = p_org and r.rent <> (out ->> r.type)::integer;
  perform app.touch_layout(p_org);
  return out;
end $$;
revoke all on function public.set_rents(uuid, jsonb) from public, anonymous;
grant execute on function public.set_rents(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Blocks: [{ id: "A", name, gender: "M" | "F", curfew: "22:00" }, …]. A block with rooms can't be left out.
create or replace function public.set_blocks(p_org uuid, p_blocks jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cur jsonb; b jsonb; old jsonb; out jsonb := '[]'::jsonb; ids text[] := '{}'; bid text; nm text; missing text;
begin
  perform app.setup_guard(p_org);
  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) not between 1 and 26 then
    raise exception 'a hostel has between 1 and 26 blocks';
  end if;
  select coalesce(settings -> 'blocks', '[]'::jsonb) into cur from public.orgs where id = p_org;
  for b in select * from jsonb_array_elements(p_blocks) loop
    bid := b ->> 'id';
    nm := trim(coalesce(b ->> 'name', ''));
    if bid is null or bid !~ '^[A-Z]$' then raise exception 'block ids are single letters, A to Z'; end if;
    if bid = any(ids) then raise exception 'block % is listed twice', bid; end if;
    if nm = '' or length(nm) > 40 then raise exception 'give block % a name of up to 40 characters', bid; end if;
    if coalesce(b ->> 'gender', '') not in ('M', 'F') then raise exception 'block % is for men or for women', bid; end if;
    if coalesce(b ->> 'curfew', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'gate time for block % must look like 22:00', bid; end if;
    ids := ids || bid;
    old := null;
    select x into old from jsonb_array_elements(cur) x where x ->> 'id' = bid;
    out := out || jsonb_build_array(coalesce(old, '{}'::jsonb) || jsonb_build_object(
      'id', bid, 'name', nm, 'gender', b ->> 'gender', 'curfew', b ->> 'curfew',
      'floors', greatest(coalesce((old ->> 'floors')::integer, 1),
                         coalesce((select max(floor) from public.rooms where org_id = p_org and block = bid), 1))));
  end loop;
  select string_agg(distinct block, ', ' order by block) into missing from public.rooms where org_id = p_org and block <> all(ids);
  if missing is not null then raise exception 'block % still has rooms. Remove its rooms first.', missing; end if;
  select coalesce(jsonb_agg(x order by x ->> 'id'), '[]'::jsonb) into out from jsonb_array_elements(out) x;
  update public.orgs set settings = settings || jsonb_build_object('blocks', out) where id = p_org;
  perform app.touch_layout(p_org);
  return out;
end $$;
revoke all on function public.set_blocks(uuid, jsonb) from public, anonymous;
grant execute on function public.set_blocks(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Meal cut-offs: { breakfast: "21:00 previous day", lunch: "10:00", snacks: "14:00", dinner: "16:00" }
create or replace function public.set_cutoffs(p_org uuid, p_cutoffs jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; v text; out jsonb := '{}'::jsonb;
begin
  perform app.setup_guard(p_org);
  foreach k in array array['breakfast', 'lunch', 'snacks', 'dinner'] loop
    v := p_cutoffs ->> k;
    if v is null or v !~ '^([01][0-9]|2[0-3]):[0-5][0-9]( previous day)?$' then
      raise exception 'cut-off for % must look like 10:00 or 21:00 previous day', k;
    end if;
    out := out || jsonb_build_object(k, v);
  end loop;
  update public.orgs set settings = jsonb_set(settings, '{mess}', coalesce(settings -> 'mess', '{}'::jsonb) || jsonb_build_object('cutoffs', out))
    where id = p_org;
  perform app.touch_layout(p_org);
  return out;
end $$;
revoke all on function public.set_cutoffs(uuid, jsonb) from public, anonymous;
grant execute on function public.set_cutoffs(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Rooms. A room's id is "<block>-<number>" and its beds "<room>-1", "<room>-2", …
create or replace function public.add_room(p_org uuid, p_block text, p_floor integer, p_number text, p_type text, p_bath text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare rid text; cap integer; v_rent integer; v_bath text;
begin
  perform app.setup_guard(p_org);
  if not exists (select 1 from public.orgs o, jsonb_array_elements(coalesce(o.settings -> 'blocks', '[]'::jsonb)) b
                 where o.id = p_org and b ->> 'id' = p_block)
     and not exists (select 1 from public.rooms where org_id = p_org and block = p_block) then
    raise exception 'add block % first', coalesce(p_block, '');
  end if;
  if p_floor is null or p_floor not between 1 and 20 then raise exception 'floor must be between 1 and 20'; end if;
  p_number := upper(trim(coalesce(p_number, '')));
  if p_number !~ '^[A-Z0-9]{1,6}$' then raise exception 'room numbers are up to 6 letters or digits, like 105'; end if;
  cap := app.capacity_of(p_type);
  if cap is null then raise exception 'unknown room type'; end if;
  v_bath := coalesce(p_bath, case when p_type = 'six' then 'common' else 'attached' end);
  if v_bath not in ('attached', 'common') then raise exception 'bathroom is attached or common'; end if;
  rid := p_block || '-' || p_number;
  if exists (select 1 from public.rooms where org_id = p_org and id = rid) then raise exception 'room % is already there', rid; end if;
  select coalesce((rent_by_type ->> p_type)::integer, 0) into v_rent from public.orgs where id = p_org;
  insert into public.rooms (org_id, id, block, floor, number, type, rent, capacity, bath)
    values (p_org, rid, p_block, p_floor, p_number, p_type, v_rent, cap, v_bath);
  insert into public.beds (org_id, id, room_id, block, floor, label, status)
    select p_org, rid || '-' || g, rid, p_block, p_floor, g::text, 'vacant' from generate_series(1, cap) g;
  -- the block's floor count grows with its highest room
  update public.orgs o set settings = jsonb_set(o.settings, '{blocks}', (
    select jsonb_agg(case when b ->> 'id' = p_block then b || jsonb_build_object('floors', greatest(coalesce((b ->> 'floors')::integer, 1), p_floor)) else b end)
    from jsonb_array_elements(o.settings -> 'blocks') b))
  where o.id = p_org and jsonb_typeof(o.settings -> 'blocks') = 'array' and jsonb_array_length(o.settings -> 'blocks') > 0;
  perform app.touch_layout(p_org);
  return rid;
end $$;
revoke all on function public.add_room(uuid, text, integer, text, text, text) from public, anonymous;
grant execute on function public.add_room(uuid, text, integer, text, text, text) to authenticated;

-- Change how many share a room (and its bathroom). Beds that go away must be free.
create or replace function public.set_room(p_org uuid, p_room text, p_type text, p_bath text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rooms; cap integer; taken text; v_bath text;
begin
  perform app.setup_guard(p_org);
  select * into r from public.rooms where org_id = p_org and id = p_room;
  if r.id is null then raise exception 'room % isn''t there', coalesce(p_room, ''); end if;
  cap := app.capacity_of(p_type);
  if cap is null then raise exception 'unknown room type'; end if;
  v_bath := coalesce(p_bath, r.bath);
  if v_bath not in ('attached', 'common') then raise exception 'bathroom is attached or common'; end if;
  select string_agg(b.id, ', ' order by b.id) into taken from public.beds b
    where b.org_id = p_org and b.room_id = p_room and b.label ~ '^[0-9]+$' and b.label::integer > cap
      and (b.status in ('occupied', 'reserved') or b.resident_id is not null
           or exists (select 1 from public.residents x where x.org_id = p_org and x.bed_id = b.id and x.status <> 'checked_out'));
  if taken is not null then raise exception 'bed % is taken. Move its resident first.', taken; end if;
  delete from public.beds b where b.org_id = p_org and b.room_id = p_room and b.label ~ '^[0-9]+$' and b.label::integer > cap;
  insert into public.beds (org_id, id, room_id, block, floor, label, status)
    select p_org, p_room || '-' || g, p_room, r.block, r.floor, g::text, 'vacant' from generate_series(1, cap) g
    where not exists (select 1 from public.beds x where x.org_id = p_org and x.id = p_room || '-' || g);
  update public.rooms set type = p_type, capacity = cap, bath = v_bath,
    rent = coalesce((select (rent_by_type ->> p_type)::integer from public.orgs where id = p_org), r.rent), updated_at = now()
    where org_id = p_org and id = p_room;
  perform app.touch_layout(p_org);
end $$;
revoke all on function public.set_room(uuid, text, text, text) from public, anonymous;
grant execute on function public.set_room(uuid, text, text, text) to authenticated;

create or replace function public.remove_room(p_org uuid, p_room text) returns void
language plpgsql security definer set search_path = '' as $$
declare taken text;
begin
  perform app.setup_guard(p_org);
  if not exists (select 1 from public.rooms where org_id = p_org and id = p_room) then
    raise exception 'room % isn''t there', coalesce(p_room, '');
  end if;
  select string_agg(b.id, ', ' order by b.id) into taken from public.beds b
    where b.org_id = p_org and b.room_id = p_room and (b.status in ('occupied', 'reserved') or b.resident_id is not null
      or exists (select 1 from public.residents x where x.org_id = p_org and x.bed_id = b.id and x.status <> 'checked_out'));
  if taken is not null then raise exception 'bed % is taken. Move its resident first.', taken; end if;
  delete from public.beds where org_id = p_org and room_id = p_room;
  delete from public.rooms where org_id = p_org and id = p_room;
  perform app.touch_layout(p_org);
end $$;
revoke all on function public.remove_room(uuid, text) from public, anonymous;
grant execute on function public.remove_room(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Every open device loads the hostel again after a setup change (rooms and blocks aren't part of the 4-second pull)
create or replace function public.changes_since(p_org uuid, p_since timestamp with time zone)
 returns jsonb
 language plpgsql
 stable
as $function$
declare result jsonb := jsonb_build_object('now', now()); _uid text := app.require_user();
begin
  if (select (settings ->> 'reset_at')::timestamptz > p_since or (settings ->> 'layout_at')::timestamptz > p_since
      from public.orgs where id = p_org) then
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

notify pgrst, 'reload schema';
commit;
