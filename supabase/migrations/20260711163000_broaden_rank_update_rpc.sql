-- matchRanking.js's rank-shuffle also bumps wins/losses on OTHER players'
-- ladder_membership rows (the winner updates the loser's losses, and vice
-- versa) — same authorization gap as the rank shuffle itself, since RLS
-- only allows self-or-admin updates. Broaden update_ladder_ranks to accept
-- optional wins/losses per row alongside rank, still scoped to one ladder
-- and gated on the caller being a member of it (or admin).

drop function if exists public.update_ladder_ranks(uuid, jsonb);

create or replace function public.update_ladder_ranks(p_ladder_id uuid, updates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_member boolean;
begin
  select exists(
    select 1 from public.ladder_memberships
    where ladder_id = p_ladder_id and user_id = auth.uid()
  ) into is_member;

  if not is_member and not public.is_admin() then
    raise exception 'not authorized to update ranks for this ladder';
  end if;

  update public.ladder_memberships lm
  set rank = coalesce((u->>'rank')::int, lm.rank),
      wins = coalesce((u->>'wins')::int, lm.wins),
      losses = coalesce((u->>'losses')::int, lm.losses)
  from jsonb_array_elements(updates) as u
  where lm.id = (u->>'id')::uuid
    and lm.ladder_id = p_ladder_id;
end;
$$;

grant execute on function public.update_ladder_ranks(uuid, jsonb) to authenticated;
