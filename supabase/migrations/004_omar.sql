-- Omar — agente de IA interno: conversas e mensagens

create table if not exists omar_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table omar_conversations enable row level security;

create policy "own_conversations" on omar_conversations
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists omar_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references omar_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

alter table omar_messages enable row level security;

create policy "own_messages" on omar_messages
  for all
  to authenticated
  using (
    exists (
      select 1 from omar_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from omar_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create index if not exists omar_messages_conversation_id_idx on omar_messages(conversation_id);
create index if not exists omar_conversations_user_id_idx on omar_conversations(user_id);
