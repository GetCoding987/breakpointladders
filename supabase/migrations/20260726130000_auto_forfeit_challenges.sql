-- Auto-forfeit: a pending challenge unanswered for 48 hours counts as a
-- loss-by-forfeit for the non-responder (ranking updated like a normal
-- match) and two consecutive no-responses auto-freezes their ladder spot.

alter table public.ladder_memberships drop constraint ladder_memberships_status_check;
alter table public.ladder_memberships add constraint ladder_memberships_status_check
  check (status in ('active','frozen_voluntary','frozen_expired','frozen_no_response','inactive','suspended'));

alter table public.ladder_memberships add column no_response_streak int not null default 0;
