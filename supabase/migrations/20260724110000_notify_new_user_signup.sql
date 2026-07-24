-- Notify manager@breakpointladders.com whenever a new profile is created (account creation),
-- via an async HTTP call to a Vercel endpoint. Fires once per signup regardless of
-- email/password vs. Google OAuth, since both paths insert exactly one profiles row.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'new_user_webhook_secret';

  perform net.http_post(
    url := 'https://breakpointladders.com/api/notify-new-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := jsonb_build_object('user_id', new.id)
  );
  return new;
end;
$$;

create trigger on_profile_created_notify_manager
  after insert on public.profiles
  for each row execute procedure public.notify_new_user_signup();
