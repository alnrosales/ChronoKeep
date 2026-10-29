-- Speeds up the admin Time records search and list.
-- Safe to run more than once. Run it in the Supabase SQL editor.

-- 1. The list is sorted newest first by clock_in. Without this index Postgres sorts the whole table
--    for every page. This is the index that matters most as time_entries grows.
create index if not exists idx_time_entries_clock_in
  on public.time_entries (clock_in desc);

-- 2. Name and email search uses ILIKE '%text%'. A normal index can't help with a leading wildcard,
--    but a trigram index can. On a small employee list Postgres may still choose a plain scan
--    (that is fine and just as fast); the index keeps search quick if the list grows to thousands.
--    Supabase keeps extensions in the "extensions" schema. If pg_trgm is already installed in
--    another schema, change "extensions." below to that schema.
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_profiles_full_name_trgm
  on public.profiles using gin (full_name extensions.gin_trgm_ops);

create index if not exists idx_profiles_email_trgm
  on public.profiles using gin (email extensions.gin_trgm_ops);

-- Refresh planner statistics so the new indexes are used right away
analyze public.time_entries;
analyze public.profiles;
