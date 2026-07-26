-- Client-side code already hides the challenge UI for non-active players
-- (frozen/suspended/inactive), but nothing enforced it at the database
-- level — a direct insert could bypass the UI entirely. Require both the
-- challenger and opponent to have an active membership in the ladder being
-- challenged on.
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
  );
