-- Fix a bug in the busy-opponent check added in 20260726160000_rules_fixes.sql:
-- the unqualified `challenger_id`/`opponent_id` references inside the
-- correlated subquery resolved to the subquery's own alias (c2) rather than
-- the row being inserted, since both share the same column names — making
-- the "not exists" clause self-referential and trivially true for any row,
-- which blocked EVERY insert once any pending/accepted challenge existed
-- anywhere in the ladder. Qualify with the table name to reference the new
-- row explicitly, same pattern already used for challenges.ladder_id below.
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
          c2.challenger_id in (challenges.challenger_id, challenges.opponent_id)
          or c2.opponent_id in (challenges.challenger_id, challenges.opponent_id)
        )
    )
  );
