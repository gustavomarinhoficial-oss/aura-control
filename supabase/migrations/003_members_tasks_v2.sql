-- Membros da agência (para atribuição de tarefas)
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  color text not null default '#7c3aed',
  created_at timestamptz not null default now()
);
alter table members enable row level security;
create policy "authenticated_all" on members for all to authenticated using (true) with check (true);

-- Checklist items das tarefas
create table if not exists task_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table task_items enable row level security;
create policy "authenticated_all" on task_items for all to authenticated using (true) with check (true);

-- Adicionar assignee nas tarefas
alter table tasks add column if not exists assignee_id uuid references members(id) on delete set null;

-- Adicionar data de término nos serviços (já existe ended_at, garantir que está lá)
alter table services add column if not exists contract_end date;
alter table services add column if not exists renewal_reminded_at timestamptz;
