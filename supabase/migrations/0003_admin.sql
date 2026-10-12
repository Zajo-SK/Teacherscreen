-- Správa účtov administrátorom školy: reset hesla, zmazanie účtu, prehľad používateľov, správa tried, záznam akcií.
-- Funkcie bežia s právami vlastníka (security definer) a vždy najprv overia, že volajúci je administrátor.
-- Súkromné PLOCHY učiteľov administrátor ani tak NEVIDÍ (vidí len počty); triedy (zoznamy žiakov) spravovať môže.

-- ---------------------------------------------------------------- záznam akcií administrátora
create table public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_id uuid,
  target_nick text,
  detail text not null default '',
  created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
create policy "audit: číta admin" on public.admin_audit for select to authenticated using (public.is_admin());
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;

-- ---------------------------------------------------------------- prehľad používateľov
create or replace function public.admin_user_overview()
returns table (id uuid, email text, display_name text, role public.app_role, can_share boolean, created_at timestamptz, screens_count bigint, classes_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.display_name, p.role, p.can_share, p.created_at,
           (select count(*) from public.screens s where s.owner_id = p.id),
           (select count(*) from public.class_lists c where c.owner_id = p.id)
    from public.profiles p order by p.display_name, p.email;
end $$;

-- ---------------------------------------------------------------- reset hesla
-- Nastaví nové (dočasné) heslo a odhlási používateľa zo všetkých zariadení. Používa pgcrypto zo schémy `extensions` (štandard v Supabase).
create or replace function public.admin_reset_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare nick text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(coalesce(new_password, '')) < 8 or char_length(new_password) > 72 then raise exception 'password length' using errcode = '22023'; end if;
  select coalesce(nullif(display_name, ''), email) into nick from public.profiles where profiles.id = target;
  if nick is null then raise exception 'user not found' using errcode = 'P0002'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now() where users.id = target;
  delete from auth.sessions where user_id = target;
  insert into public.admin_audit (admin_id, action, target_id, target_nick) values (auth.uid(), 'reset_password', target, nick);
end $$;

-- ---------------------------------------------------------------- zmazanie účtu (so všetkými jeho plochami, triedami a zdieľaním)
create or replace function public.admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare nick text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'cannot delete self' using errcode = '42501'; end if;
  select coalesce(nullif(display_name, ''), email) into nick from public.profiles where profiles.id = target;
  if nick is null then raise exception 'user not found' using errcode = 'P0002'; end if;
  insert into public.admin_audit (admin_id, action, target_id, target_nick) values (auth.uid(), 'delete_user', target, nick);
  delete from auth.users where users.id = target;
end $$;

-- ---------------------------------------------------------------- správa tried iných učiteľov
create policy "trieda: admin číta" on public.class_lists for select to authenticated using (public.is_admin());
create policy "trieda: admin upravuje" on public.class_lists for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "trieda: admin maže" on public.class_lists for delete to authenticated using (public.is_admin());

-- Každá zmena alebo zmazanie triedy cudzieho učiteľa administrátorom sa zapíše do záznamu.
create or replace function public.audit_admin_class_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid := coalesce(old.owner_id, new.owner_id);
begin
  if auth.uid() is not null and owner <> auth.uid() and public.is_admin() then
    insert into public.admin_audit (admin_id, action, target_id, target_nick, detail)
    values (auth.uid(), case when tg_op = 'DELETE' then 'delete_class' else 'update_class' end, owner,
            (select coalesce(nullif(display_name, ''), email) from public.profiles where id = owner), coalesce(old.name, new.name));
  end if;
  return coalesce(new, old);
end $$;
create trigger class_lists_admin_audit after update or delete on public.class_lists for each row execute function public.audit_admin_class_change();

revoke all on function public.admin_user_overview() from public;
revoke all on function public.admin_reset_password(uuid, text) from public;
revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_user_overview() to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
