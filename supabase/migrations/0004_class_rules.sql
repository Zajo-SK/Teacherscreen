-- Pravidlá rozdeľovača skupín pre triedu (dvojice, ktoré nesmú / musia byť spolu). Rovnaké súkromie ako zoznam žiakov (RLS z 0002).
alter table public.class_lists
  add column if not exists rules jsonb not null default '{}'::jsonb
  check (jsonb_typeof(rules) = 'object' and octet_length(rules::text) <= 20000);
