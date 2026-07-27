-- Lets a user hide a chat from their own Messages view without affecting the
-- other participant(s). Hiding is time-based, not a flag: a thread/group
-- reappears automatically once a message newer than the hide point arrives.

create table public.hidden_threads (
  user_id uuid not null references auth.users(id) on delete cascade,
  other_user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, other_user_id)
);

alter table public.hidden_threads enable row level security;

create policy "hidden_threads_own" on public.hidden_threads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.conversation_participants add column hidden_at timestamptz;

create policy "conversation_participants_update_own" on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
