-- Adds a fixed $750 base to the "Raised for Charity" counter on top of real
-- Stripe payment totals, so the login page shows a credible number before
-- real season signups accumulate, while still growing with real payments.
create or replace function public.get_total_raised()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select 750 + coalesce(sum(amount_paid), 0) from public.ladder_memberships;
$$;
