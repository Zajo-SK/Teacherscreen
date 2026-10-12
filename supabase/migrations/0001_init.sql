-- TeacherScreen – voliteľný backend (Supabase / PostgreSQL)
-- Spustite v SQL editore Supabase alebo cez `supabase db push`.
-- Všetky tabuľky majú zapnuté Row Level Security (RLS); anonymný používateľ nemá k tabuľkám prístup.


-- ---------------------------------------------------------------- typy a pomocné funkcie
do $$ begin
  create type public.app_role as enum ('teacher', 'admin');
exception when duplicate_object then null; end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profily a roly
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role public.app_role not null default 'teacher',
  can_share boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Pomocné funkcie bežia s právami vlastníka (security definer), aby RLS politiky nevytvárali rekurziu.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;

create or replace function public.can_share() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.can_share from public.profiles p where p.id = auth.uid()), false)
$$;

-- Nový používateľ dostane rolu „teacher“. Rolu admin nastavuje iba existujúci admin (alebo prvý admin cez SQL, pozri README).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profil: vidím svoj, admin vidí všetky" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- Používateľ smie meniť iba zobrazované meno (role a can_share menia iba admin RPC funkcie).
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy "profil: upravím si svoj" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.set_user_role(target uuid, new_role public.app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'cannot change own role' using errcode = '42501'; end if;
  update public.profiles set role = new_role where id = target;
end $$;

create or replace function public.set_user_can_share(target uuid, allowed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set can_share = allowed where id = target;
end $$;

-- Vyhľadanie používateľa podľa e‑mailu (pre zdieľanie). Vracia iba ID a zobrazované meno, nie celý profil.
create or replace function public.find_user_by_email(p_email text) returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name from public.profiles p
  where auth.uid() is not null and lower(p.email) = lower(p_email) and p.id <> auth.uid()
$$;

-- ---------------------------------------------------------------- osobné obrazovky
create table public.screens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  data jsonb not null check (octet_length(data::text) <= 8000000),
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index screens_owner_idx on public.screens (owner_id);
alter table public.screens enable row level security;
create trigger screens_touch before update on public.screens for each row execute function public.touch_updated_at();

create or replace function public.prevent_owner_change() returns trigger
language plpgsql as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'owner cannot be changed' using errcode = '42501'; end if;
  return new;
end $$;
create trigger screens_owner_lock before update on public.screens for each row execute function public.prevent_owner_change();

-- ---------------------------------------------------------------- zdieľanie s konkrétnym učiteľom
create table public.screen_shares (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.screens (id) on delete cascade,
  grantee_id uuid not null references auth.users (id) on delete cascade,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  created_at timestamptz not null default now(),
  unique (screen_id, grantee_id)
);
create index screen_shares_grantee_idx on public.screen_shares (grantee_id);
alter table public.screen_shares enable row level security;

create or replace function public.screen_owner(sid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select owner_id from public.screens where id = sid
$$;

create or replace function public.has_share(sid uuid, need_edit boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.screen_shares s
    where s.screen_id = sid and s.grantee_id = auth.uid() and (not need_edit or s.permission = 'edit')
  )
$$;

create policy "obrazovka: vlastník alebo zdieľaná so mnou" on public.screens
  for select to authenticated using (owner_id = auth.uid() or public.has_share(id, false));
create policy "obrazovka: vložím len svoju" on public.screens
  for insert to authenticated with check (owner_id = auth.uid());
create policy "obrazovka: upravím svoju alebo s právom edit" on public.screens
  for update to authenticated using (owner_id = auth.uid() or public.has_share(id, true))
  with check (owner_id = public.screen_owner(id));
create policy "obrazovka: zmažem iba svoju" on public.screens
  for delete to authenticated using (owner_id = auth.uid());

create policy "zdieľanie: vidí vlastník obrazovky a príjemca" on public.screen_shares
  for select to authenticated using (grantee_id = auth.uid() or public.screen_owner(screen_id) = auth.uid());
create policy "zdieľanie: vytvorí vlastník s oprávnením" on public.screen_shares
  for insert to authenticated with check (public.screen_owner(screen_id) = auth.uid() and grantee_id <> auth.uid() and public.can_share());
create policy "zdieľanie: mení vlastník" on public.screen_shares
  for update to authenticated using (public.screen_owner(screen_id) = auth.uid())
  with check (public.screen_owner(screen_id) = auth.uid());
create policy "zdieľanie: ruší vlastník alebo príjemca" on public.screen_shares
  for delete to authenticated using (public.screen_owner(screen_id) = auth.uid() or grantee_id = auth.uid());

-- ---------------------------------------------------------------- odkazy na zdieľanie (zrušiteľné)
create table public.share_links (
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  screen_id uuid not null references public.screens (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index share_links_screen_idx on public.share_links (screen_id);
alter table public.share_links enable row level security;

create policy "odkaz: vidí vlastník obrazovky" on public.share_links
  for select to authenticated using (public.screen_owner(screen_id) = auth.uid());
create policy "odkaz: vytvorí vlastník s oprávnením" on public.share_links
  for insert to authenticated with check (public.screen_owner(screen_id) = auth.uid() and created_by = auth.uid() and public.can_share());
create policy "odkaz: zruší vlastník" on public.share_links
  for update to authenticated using (public.screen_owner(screen_id) = auth.uid())
  with check (public.screen_owner(screen_id) = auth.uid());
create policy "odkaz: zmaže vlastník" on public.share_links
  for delete to authenticated using (public.screen_owner(screen_id) = auth.uid());

-- Verejné čítanie podľa tokenu: vráti iba jednu obrazovku a len ak odkaz nie je zrušený ani expirovaný.
create or replace function public.get_shared_screen(p_token text)
returns table (name text, data jsonb, schema_version int)
language sql stable security definer set search_path = public as $$
  select s.name, s.data, s.schema_version
  from public.share_links l join public.screens s on s.id = l.screen_id
  where l.token = p_token and l.revoked_at is null and l.expires_at > now()
$$;
revoke all on function public.get_shared_screen(text) from public;
grant execute on function public.get_shared_screen(text) to anon, authenticated;

-- ---------------------------------------------------------------- školské šablóny a predvolené hodnoty
create table public.school_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  data jsonb not null check (octet_length(data::text) <= 8000000),
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.school_templates enable row level security;
create trigger school_templates_touch before update on public.school_templates for each row execute function public.touch_updated_at();

create policy "šablóny: čítajú prihlásení" on public.school_templates for select to authenticated using (true);
create policy "šablóny: vkladá admin" on public.school_templates for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "šablóny: upravuje admin" on public.school_templates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "šablóny: maže admin" on public.school_templates for delete to authenticated using (public.is_admin());

create table public.school_settings (
  id boolean primary key default true check (id),
  defaults jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.school_settings (id) values (true) on conflict do nothing;
alter table public.school_settings enable row level security;
create trigger school_settings_touch before update on public.school_settings for each row execute function public.touch_updated_at();
create policy "nastavenia: čítajú prihlásení" on public.school_settings for select to authenticated using (true);
create policy "nastavenia: upravuje admin" on public.school_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- oprávnenia na úrovni tabuliek
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.screens to authenticated;
grant select, insert, update, delete on public.screen_shares to authenticated;
grant select, insert, update, delete on public.share_links to authenticated;
grant select, insert, update, delete on public.school_templates to authenticated;
grant select, update on public.school_settings to authenticated;

revoke all on function public.set_user_role(uuid, public.app_role) from public;
revoke all on function public.set_user_can_share(uuid, boolean) from public;
revoke all on function public.find_user_by_email(text) from public;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.set_user_can_share(uuid, boolean) to authenticated;
grant execute on function public.find_user_by_email(text) to authenticated;
