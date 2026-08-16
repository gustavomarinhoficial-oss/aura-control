-- Permite atribuir uma tarefa a mais de uma pessoa (0, 1, 2 ou mais responsáveis)

create table if not exists task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (task_id, member_id)
);

alter table task_assignees enable row level security;

create policy "authenticated_all" on task_assignees
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists task_assignees_task_id_idx on task_assignees(task_id);
create index if not exists task_assignees_member_id_idx on task_assignees(member_id);

-- Migra o responsável único já cadastrado (assignee_id) para a nova tabela
insert into task_assignees (task_id, member_id)
select id, assignee_id from tasks
where assignee_id is not null
on conflict do nothing;
