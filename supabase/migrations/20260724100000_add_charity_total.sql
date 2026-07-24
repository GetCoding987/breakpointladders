-- Store the actual dollar amount paid per membership (was previously only
-- recording *which* Stripe session paid via stripe_payment_id, not how much),
-- and expose a public aggregate total for the "Raised for Charity" counter
-- on the logged-out login page, which has no row-level access to
-- ladder_memberships (select policy is `to authenticated` only).

alter table public.ladder_memberships add column amount_paid numeric;

create or replace function public.get_total_raised()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_paid), 0) from public.ladder_memberships;
$$;

grant execute on function public.get_total_raised() to anon, authenticated;
