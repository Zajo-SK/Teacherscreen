-- Triedy (zoznamy žiakov) učiteľa. Súkromné: vidí a mení ich iba vlastník (ani administrátor, ani príjemcovia zdieľania).
-- Synchronizujú sa len ak to učiteľ v aplikácii výslovne zapne.

create table public.class_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  names jsonb not null default '[]'::jsonb check (jsonb_typeof(names) = 'array' and jsonb_array_length(names) <= 200),
  updated_at timestamptz not null default now()
);
create index class_lists_owner_idx on public.class_lists (owner_id);
alter table public.class_lists enable row level security;

create trigger class_lists_touch before update on public.class_lists for each row execute function public.touch_updated_at();
create trigger class_lists_owner_lock before update on public.class_lists for each row execute function public.prevent_owner_change();

create policy "trieda: vidí vlastník" on public.class_lists for select to authenticated using (owner_id = auth.uid());
create policy "trieda: vloží vlastník" on public.class_lists for insert to authenticated with check (owner_id = auth.uid());
create policy "trieda: upraví vlastník" on public.class_lists for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "trieda: zmaže vlastník" on public.class_lists for delete to authenticated using (owner_id = auth.uid());

revoke all on public.class_lists from anon;
grant select, insert, update, delete on public.class_lists to authenticated;
