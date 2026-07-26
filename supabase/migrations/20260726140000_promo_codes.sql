-- Promo codes are now managed from the admin panel instead of a Vercel env var.
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_percent int not null check (discount_percent > 0 and discount_percent <= 100),
  active boolean not null default true,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create unique index promo_codes_code_key on public.promo_codes (upper(code));

create trigger set_promo_codes_updated_date
  before update on public.promo_codes
  for each row execute procedure public.set_updated_date();

alter table public.promo_codes enable row level security;

create policy "promo_codes_select_authenticated" on public.promo_codes
  for select to authenticated using (true);

create policy "promo_codes_insert_admin" on public.promo_codes
  for insert to authenticated with check (public.is_admin());

create policy "promo_codes_update_admin" on public.promo_codes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "promo_codes_delete_admin" on public.promo_codes
  for delete to authenticated using (public.is_admin());
