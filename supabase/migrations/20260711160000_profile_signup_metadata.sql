-- Populate profiles from auth signup metadata (Register.jsx passes
-- first_name/last_name/gender/location/city/state/phone as signUp options.data),
-- since the email-confirmation-link flow means we can no longer save these
-- fields in a separate authenticated step right after signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, gender, location, city, state, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'location',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;
