-- Ranks are a stored int column (not computed), so removing/deactivating a
-- member previously left a gap in the sequence (e.g. 1,2,4,5) since nothing
-- re-numbered the remaining rows. Close the gap automatically whenever a
-- member drops from the ladder: hard-removed (admin "remove player") or
-- deactivated (status -> 'inactive', the only status LadderPage hides from
-- the standings list).

create or replace function public.compact_ladder_ranks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.rank is not null then
    update public.ladder_memberships
    set rank = rank - 1
    where ladder_id = old.ladder_id
      and rank > old.rank;
  end if;
  return null;
end;
$$;

create trigger ladder_memberships_compact_ranks_on_delete
  after delete on public.ladder_memberships
  for each row execute procedure public.compact_ladder_ranks();

create trigger ladder_memberships_compact_ranks_on_inactivate
  after update of status on public.ladder_memberships
  for each row
  when (old.status is distinct from 'inactive' and new.status = 'inactive')
  execute procedure public.compact_ladder_ranks();

-- One-time backfill: close any gaps already present from past removals.
with ranked as (
  select id, row_number() over (
    partition by ladder_id
    order by rank nulls last, created_date
  ) as rn
  from public.ladder_memberships
  where status <> 'inactive'
)
update public.ladder_memberships lm
set rank = ranked.rn
from ranked
where lm.id = ranked.id
  and lm.rank is distinct from ranked.rn;
