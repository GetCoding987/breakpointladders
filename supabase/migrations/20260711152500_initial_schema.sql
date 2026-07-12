-- Breakpoint Ladders — initial schema, replacing Base44
-- Tables mirror base44/entities/*.jsonc; RLS policies replicate base44 rls
-- blocks except where noted (notifications/ladder_memberships insert is
-- deliberately service-role-only — see migration comment near those tables).

-- ============================================================
-- Helpers
-- ============================================================

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

-- ============================================================
-- profiles (extends auth.users — replaces Base44's User entity)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('admin','player')),
  avatar_url text,
  first_name text,
  last_name text,
  gender text check (gender in ('Male','Female')),
  location text,
  city text,
  state text check (state in ('New York','Connecticut')),
  playing_style text check (playing_style in ('Baseline Player','Serve & Volley','All-Court','Counter-Puncher','Big Hitter')),
  favorite_surface text check (favorite_surface in ('Hard Court','Clay','Grass','Indoor')),
  bio text,
  phone text,
  full_name text generated always as (trim(both ' ' from coalesce(first_name,'') || ' ' || coalesce(last_name,''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_date();

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ============================================================
-- ladders
-- ============================================================

create table public.ladders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  annual_fee numeric not null default 25,
  status text not null default 'active' check (status in ('active','archived')),
  challenge_window_spots int not null default 10,
  score_confirm_hours int not null default 24,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger set_ladders_updated_date
  before update on public.ladders
  for each row execute procedure public.set_updated_date();

alter table public.ladders enable row level security;

create policy "ladders_select_authenticated" on public.ladders
  for select to authenticated using (true);

create policy "ladders_insert_admin" on public.ladders
  for insert to authenticated with check (public.is_admin());

create policy "ladders_update_admin" on public.ladders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "ladders_delete_admin" on public.ladders
  for delete to authenticated using (public.is_admin());

-- ============================================================
-- announcements
-- ============================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  ladder_id uuid not null references public.ladders(id) on delete cascade,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger set_announcements_updated_date
  before update on public.announcements
  for each row execute procedure public.set_updated_date();

alter table public.announcements enable row level security;

create policy "announcements_select_authenticated" on public.announcements
  for select to authenticated using (true);

create policy "announcements_insert_admin" on public.announcements
  for insert to authenticated with check (public.is_admin());

create policy "announcements_update_admin" on public.announcements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "announcements_delete_admin" on public.announcements
  for delete to authenticated using (public.is_admin());

create index announcements_ladder_id_idx on public.announcements(ladder_id);

-- ============================================================
-- ladder_memberships
-- Note: no client insert policy — creation only ever happens via the
-- redeem-promo-code / stripe-webhook Vercel functions using the
-- service-role key (matches actual pre-migration call-site reality).
-- ============================================================

create table public.ladder_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ladder_id uuid not null references public.ladders(id) on delete cascade,
  display_name text,
  avatar_url text,
  location text,
  playing_style text,
  favorite_surface text,
  rank int,
  wins int not null default 0,
  losses int not null default 0,
  status text not null default 'active' check (status in ('active','frozen_voluntary','frozen_expired','inactive','suspended')),
  freeze_start_date date,
  freeze_return_date date,
  membership_expires date,
  stripe_payment_id text,
  joined_date date,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger set_ladder_memberships_updated_date
  before update on public.ladder_memberships
  for each row execute procedure public.set_updated_date();

alter table public.ladder_memberships enable row level security;

create policy "ladder_memberships_select_authenticated" on public.ladder_memberships
  for select to authenticated using (true);

create policy "ladder_memberships_update_self_or_admin" on public.ladder_memberships
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "ladder_memberships_delete_admin" on public.ladder_memberships
  for delete to authenticated using (public.is_admin());

create index ladder_memberships_user_id_idx on public.ladder_memberships(user_id);
create index ladder_memberships_ladder_id_idx on public.ladder_memberships(ladder_id);

-- ============================================================
-- challenges
-- ============================================================

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id),
  opponent_id uuid not null references auth.users(id),
  ladder_id uuid not null references public.ladders(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','completed','cancelled','expired')),
  challenger_rank_at_time int,
  opponent_rank_at_time int,
  proposed_date date,
  proposed_time text,
  proposed_location text,
  proposed_by_id uuid references auth.users(id),
  proposal_status text check (proposal_status in ('proposed','accepted','declined')),
  message text,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger set_challenges_updated_date
  before update on public.challenges
  for each row execute procedure public.set_updated_date();

alter table public.challenges enable row level security;

create policy "challenges_select_authenticated" on public.challenges
  for select to authenticated using (true);

create policy "challenges_insert_creator" on public.challenges
  for insert to authenticated with check (created_by_id = auth.uid());

create policy "challenges_update_participant_or_admin" on public.challenges
  for update to authenticated
  using (challenger_id = auth.uid() or opponent_id = auth.uid() or public.is_admin())
  with check (challenger_id = auth.uid() or opponent_id = auth.uid() or public.is_admin());

create policy "challenges_delete_admin" on public.challenges
  for delete to authenticated using (public.is_admin());

create index challenges_ladder_id_idx on public.challenges(ladder_id);
create index challenges_opponent_status_idx on public.challenges(opponent_id, status);
create index challenges_challenger_id_idx on public.challenges(challenger_id);

-- ============================================================
-- matches
-- ============================================================

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges(id) on delete set null,
  ladder_id uuid not null references public.ladders(id) on delete cascade,
  player1_id uuid not null references auth.users(id),
  player2_id uuid not null references auth.users(id),
  winner_id uuid references auth.users(id),
  score text,
  played_date date,
  submitted_by_id uuid references auth.users(id),
  confirmed_by_id uuid references auth.users(id),
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation','confirmed','disputed','overridden')),
  confirmation_deadline timestamptz,
  admin_notes text,
  ranking_updated boolean not null default false,
  proposed_score text,
  proposed_winner_id uuid references auth.users(id),
  proposed_by_id uuid references auth.users(id),
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger set_matches_updated_date
  before update on public.matches
  for each row execute procedure public.set_updated_date();

alter table public.matches enable row level security;

create policy "matches_select_authenticated" on public.matches
  for select to authenticated using (true);

create policy "matches_insert_participant" on public.matches
  for insert to authenticated with check (player1_id = auth.uid() or player2_id = auth.uid());

create policy "matches_update_participant_or_admin" on public.matches
  for update to authenticated
  using (player1_id = auth.uid() or player2_id = auth.uid() or public.is_admin())
  with check (player1_id = auth.uid() or player2_id = auth.uid() or public.is_admin());

create policy "matches_delete_admin" on public.matches
  for delete to authenticated using (public.is_admin());

create index matches_ladder_id_idx on public.matches(ladder_id);
create index matches_challenge_id_idx on public.matches(challenge_id);

-- ============================================================
-- messages
-- ============================================================

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  content text not null,
  read boolean not null default false,
  thread_id text,
  match_id uuid references public.matches(id) on delete set null,
  created_by_id uuid references auth.users(id) default auth.uid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger set_messages_updated_date
  before update on public.messages
  for each row execute procedure public.set_updated_date();

alter table public.messages enable row level security;

create policy "messages_select_participant_or_admin" on public.messages
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

create policy "messages_insert_sender" on public.messages
  for insert to authenticated with check (sender_id = auth.uid());

create policy "messages_update_recipient_or_admin" on public.messages
  for update to authenticated
  using (recipient_id = auth.uid() or public.is_admin())
  with check (recipient_id = auth.uid() or public.is_admin());

create policy "messages_delete_admin" on public.messages
  for delete to authenticated using (public.is_admin());

create index messages_sender_id_idx on public.messages(sender_id);
create index messages_recipient_id_idx on public.messages(recipient_id);
create index messages_thread_id_idx on public.messages(thread_id);

-- ============================================================
-- notifications
-- Note: no client insert policy — creation is deliberately routed
-- through the /api/notify Vercel function using the service-role key.
-- Base44's declared rule was "admin only", but ~10+ real call sites had
-- regular players creating notifications for other users; rather than
-- porting a rule that was apparently unenforced, all creation now goes
-- through one server endpoint that can both insert and send email.
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'challenge_received','challenge_accepted','challenge_declined',
    'score_submitted','score_confirmed','score_disputed',
    'membership_expiring','membership_expired','rank_updated',
    'new_message','match_reminder'
  )),
  title text not null,
  body text not null,
  read boolean not null default false,
  related_id text,
  created_by_id uuid references auth.users(id),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger set_notifications_updated_date
  before update on public.notifications
  for each row execute procedure public.set_updated_date();

alter table public.notifications enable row level security;

create policy "notifications_select_self_or_admin" on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "notifications_update_self_or_admin" on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "notifications_delete_admin" on public.notifications
  for delete to authenticated using (public.is_admin());

create index notifications_user_id_read_idx on public.notifications(user_id, read);

-- ============================================================
-- Rank-shuffle RPC (replaces matchRanking.js's bulkUpdate)
-- SECURITY DEFINER bypasses the self-or-admin update policy above, so it
-- validates the caller is a member of the target ladder (or admin) and
-- scopes every row it touches to that ladder_id, preventing an arbitrary
-- authenticated user from rewriting ranks on a ladder they're not on.
-- ============================================================

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
  set rank = (u->>'rank')::int
  from jsonb_array_elements(updates) as u
  where lm.id = (u->>'id')::uuid
    and lm.ladder_id = p_ladder_id;
end;
$$;

grant execute on function public.update_ladder_ranks(uuid, jsonb) to authenticated;

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.challenges;
