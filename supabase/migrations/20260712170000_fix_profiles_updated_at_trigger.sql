-- profiles.updated_at was wired to public.set_updated_date(), which sets
-- new.updated_date (the column name used by every other table) — profiles
-- is the only table with a differently-named updated_at column, so any
-- update to profiles errored with "record new has no field updated_date".

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
