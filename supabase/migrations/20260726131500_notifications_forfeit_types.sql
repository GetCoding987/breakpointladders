-- Allow the two new auto-forfeit notification types.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'challenge_received','challenge_accepted','challenge_declined',
    'challenge_forfeit_won','challenge_forfeit_lost',
    'score_submitted','score_confirmed','score_disputed',
    'membership_expiring','membership_expired','rank_updated',
    'new_message','match_reminder'
  ));
