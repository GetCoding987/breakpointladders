-- Rules-page consistency fixes: track when a challenge was accepted (for the
-- 14-day match-completion window), mark retirements distinctly, and add two
-- new notification types (season transition reminder, no-fault challenge
-- expiry).

alter table public.challenges add column accepted_date timestamptz;
alter table public.matches add column is_retirement boolean not null default false;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'challenge_received','challenge_accepted','challenge_declined',
    'challenge_forfeit_won','challenge_forfeit_lost','challenge_expired',
    'score_submitted','score_confirmed','score_disputed',
    'membership_expiring','membership_expired','rank_updated',
    'new_message','match_reminder','season_transition'
  ));

-- Defense-in-depth: a challenge insert already required both parties to be
-- 'active' (see 20260726150000_challenges_require_active_status.sql) — also
-- block it if either party already has a pending/accepted challenge with
-- anyone else, matching the "no double-challenging" rule that was previously
-- only enforced client-side.
drop policy "challenges_insert_creator" on public.challenges;

create policy "challenges_insert_creator" on public.challenges
  for insert to authenticated
  with check (
    created_by_id = auth.uid()
    and exists (
      select 1 from public.ladder_memberships
      where user_id = challenger_id and ladder_id = challenges.ladder_id and status = 'active'
    )
    and exists (
      select 1 from public.ladder_memberships
      where user_id = opponent_id and ladder_id = challenges.ladder_id and status = 'active'
    )
    and not exists (
      select 1 from public.challenges c2
      where c2.ladder_id = challenges.ladder_id
        and c2.status in ('pending', 'accepted')
        and (
          c2.challenger_id in (challenger_id, opponent_id)
          or c2.opponent_id in (challenger_id, opponent_id)
        )
    )
  );
