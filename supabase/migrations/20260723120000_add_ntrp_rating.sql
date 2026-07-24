-- Add NTRP self-rating to profiles, and populate it from signup metadata
-- the same way first_name/last_name/gender/location/city/state/phone are
-- already passed (see 20260711160000_profile_signup_metadata.sql).

alter table public.profiles
  add column ntrp_rating numeric
  check (ntrp_rating in (1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, gender, location, city, state, phone, ntrp_rating)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'location',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'phone',
    (new.raw_user_meta_data->>'ntrp_rating')::numeric
  );
  return new;
end;
$$;
