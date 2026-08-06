-- Tabela de tarefas internas da agência
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  client_id uuid references clients(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido')),
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  due_date date,
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "authenticated_all" on tasks
  for all
  to authenticated
  using (true)
  with check (true);
