-- Link da reuniao online + notificacoes push (lembretes de reuniao/captacao no celular).
alter table meetings add column if not exists meeting_link text;

-- Aparelhos que ativaram as notificacoes (um por navegador/celular), ligados ao membro da equipe.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  member_id uuid references members(id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_member_idx on push_subscriptions(member_id);

-- Lembretes ja enviados (evita avisar duas vezes a mesma reuniao no mesmo horario).
create table if not exists meeting_reminders_sent (
  reminder_key text primary key,
  meeting_id uuid not null references meetings(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
alter table meeting_reminders_sent enable row level security;
drop policy if exists "authenticated_all" on push_subscriptions;
create policy "authenticated_all" on push_subscriptions for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_all" on meeting_reminders_sent;
create policy "authenticated_all" on meeting_reminders_sent for all to authenticated using (true) with check (true);
