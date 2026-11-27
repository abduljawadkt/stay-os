-- New real hostels start clean: the owner's own room layout and an empty weekly menu (no copied sample menu or plate
-- costs). Staff can now save the weekly menu; before, menu edits only showed on screen.

-- Rooms and beds for a new hostel: blocks x floors x rooms per floor. Beds per room 1, 2, 3 or 6 makes every room that
-- size; 0 keeps the mixed layout (singles to six-bed rooms).
drop function if exists app.build_layout(uuid, integer, integer);
create or replace function app.build_layout(target uuid, blocks integer, floors integer, rooms integer default 10, beds integer default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b integer; f integer; i integer; letter text; rid text; typ text; cap integer; rents jsonb;
  mixed text[] := array['single','single','double','double','double','double','triple','triple','triple','six'];
begin
  select rent_by_type into rents from public.orgs where id = target;
  for b in 1..greatest(1, least(blocks, 6)) loop
    letter := chr(64 + b);
    for f in 1..greatest(1, least(floors, 8)) loop
      for i in 1..greatest(1, least(rooms, 30)) loop
        rid := letter || '-' || f || lpad(i::text, 2, '0');
        typ := case beds when 1 then 'single' when 2 then 'double' when 3 then 'triple' when 6 then 'six' else mixed[((i - 1) % 10) + 1] end;
        cap := case typ when 'single' then 1 when 'double' then 2 when 'triple' then 3 else 6 end;
        insert into public.rooms (org_id, id, block, floor, number, type, rent, capacity, bath)
          values (target, rid, letter, f, f || lpad(i::text, 2, '0'), typ, coalesce((rents ->> typ)::integer, 0), cap, case when typ = 'six' then 'common' else 'attached' end);
        insert into public.beds (org_id, id, room_id, block, floor, label, status)
          select target, rid || '-' || g, rid, letter, f, g::text, 'vacant' from generate_series(1, cap) g;
      end loop;
    end loop;
  end loop;
end $$;
revoke all on function app.build_layout(uuid, integer, integer, integer, integer) from public, authenticated, anonymous;

drop function if exists public.create_org(text, text, boolean, integer, integer);
create or replace function public.create_org(p_name text, p_city text, p_sample boolean default true, p_blocks integer default 2,
  p_floors integer default 3, p_rooms integer default 10, p_beds integer default 0)
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
    perform app.build_layout(new_id, p_blocks, p_floors, p_rooms, p_beds);
    -- no sample menu: the owner fills in their own
    update public.orgs set settings = settings || jsonb_build_object('blocks', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b, 'name', 'Block ' || b, 'gender', 'M', 'floors', p_floors, 'curfew', '22:00') order by b), '[]'::jsonb)
      from (select distinct block as b from public.rooms where org_id = new_id) x))
    where id = new_id;
  end if;
  return new_id;
end $$;
revoke all on function public.create_org(text, text, boolean, integer, integer, integer, integer) from public, anonymous;
grant execute on function public.create_org(text, text, boolean, integer, integer, integer, integer) to authenticated;

-- Staff save one dish of the weekly menu (day 0 = Sunday … 6 = Saturday)
create or replace function public.set_menu_item(p_org uuid, p_day integer, p_meal text, p_text text, p_veg boolean default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  menu jsonb; day jsonb; item jsonb; i integer; found boolean := false;
  blank jsonb := jsonb_build_object('en', '', 'ml', '', 'veg', true);
begin
  perform app.require_user();
  if not app.is_staff(p_org) then raise exception 'only staff can change the menu'; end if;
  if not app.org_active(p_org) then raise exception 'hostel_locked' using errcode = 'P0001'; end if;
  if p_day not between 0 and 6 or p_meal not in ('breakfast', 'lunch', 'snacks', 'dinner') then raise exception 'unknown day or meal'; end if;
  if length(coalesce(p_text, '')) > 120 then raise exception 'keep the dish under 120 characters'; end if;
  select coalesce(settings -> 'mess' -> 'menu', '[]'::jsonb) into menu from public.orgs where id = p_org;
  for i in 0..jsonb_array_length(menu) - 1 loop
    if (menu -> i ->> 'day')::integer = p_day then found := true; day := menu -> i; exit; end if;
  end loop;
  if not found then
    day := jsonb_build_object('day', p_day, 'breakfast', blank, 'lunch', blank, 'snacks', blank, 'dinner', blank);
  end if;
  item := coalesce(day -> p_meal, blank) || jsonb_build_object('en', trim(p_text), 'ml', trim(p_text));
  if p_veg is not null then item := item || jsonb_build_object('veg', p_veg); end if;
  day := day || jsonb_build_object(p_meal, item);
  menu := coalesce((select jsonb_agg(x) from jsonb_array_elements(menu) x where (x ->> 'day')::integer <> p_day), '[]'::jsonb) || jsonb_build_array(day);
  update public.orgs set settings = jsonb_set(settings, '{mess}', coalesce(settings -> 'mess', '{}'::jsonb) || jsonb_build_object('menu', menu)) where id = p_org;
  return day;
end $$;
revoke all on function public.set_menu_item(uuid, integer, text, text, boolean) from public, anonymous;
grant execute on function public.set_menu_item(uuid, integer, text, text, boolean) to authenticated;
