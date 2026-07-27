-- NTRP eligibility range per ladder. Both nullable: null on either side means
-- no restriction on that bound, so existing ladders remain open to everyone
-- until an admin backfills a range through the Admin ladder form.
alter table public.ladders add column ntrp_min numeric;
alter table public.ladders add column ntrp_max numeric;
