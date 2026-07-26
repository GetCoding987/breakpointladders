-- Group conversations: lets an admin start a chat with 2+ people at once where
-- every participant (including other players) sees all messages, alongside the
-- existing strictly-1:1 `messages` table (left untouched — many features like
-- disputes/schedule-proposals depend on its sender/recipient shape).

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_by uuid not null references auth.users(id),
  created_date timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  added_date timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  content text not null,
  created_date timestamptz not null default now()
);

create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;

create policy "conversations_select_participant_or_admin" on public.conversations
  for select to authenticated
  using (public.is_admin() or public.is_conversation_participant(id));

create policy "conversations_insert_admin" on public.conversations
  for insert to authenticated with check (public.is_admin() and created_by = auth.uid());

alter table public.conversation_participants enable row level security;

create policy "conversation_participants_select_participant_or_admin" on public.conversation_participants
  for select to authenticated
  using (public.is_admin() or public.is_conversation_participant(conversation_id));

create policy "conversation_participants_insert_admin" on public.conversation_participants
  for insert to authenticated with check (public.is_admin());

create policy "conversation_participants_delete_admin" on public.conversation_participants
  for delete to authenticated using (public.is_admin());

alter table public.conversation_messages enable row level security;

create policy "conversation_messages_select_participant_or_admin" on public.conversation_messages
  for select to authenticated
  using (public.is_admin() or public.is_conversation_participant(conversation_id));

create policy "conversation_messages_insert_participant" on public.conversation_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and (public.is_admin() or public.is_conversation_participant(conversation_id)));

create index conversation_participants_user_id_idx on public.conversation_participants(user_id);
create index conversation_messages_conversation_id_idx on public.conversation_messages(conversation_id);
