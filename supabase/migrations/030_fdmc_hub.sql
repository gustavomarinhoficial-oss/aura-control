-- FDMC Hub: sub-area do app so pra Gustavo e Gabriel, com Financeiro,
-- Tarefas e Reunioes proprios, separados dos dados da OWL.
--
-- Tarefas e reunioes reusam as mesmas tabelas da OWL, so ganham uma
-- coluna "workspace" pra marcar de quem e cada linha -- todo mundo que
-- ja existe vira 'owl' automaticamente (valor padrao), entao nada muda
-- pra quem ja usa o app hoje.
alter table tasks add column if not exists workspace text not null default 'owl';
alter table tasks drop constraint if exists tasks_workspace_check;
alter table tasks add constraint tasks_workspace_check check (workspace in ('owl', 'fdmc'));

alter table meetings add column if not exists workspace text not null default 'owl';
alter table meetings drop constraint if exists meetings_workspace_check;
alter table meetings add constraint meetings_workspace_check check (workspace in ('owl', 'fdmc'));

create index if not exists tasks_workspace_idx on tasks(workspace);
create index if not exists meetings_workspace_idx on meetings(workspace);

-- Financeiro do FDMC: lancamento solto de receita/despesa, sem vinculo
-- com cliente (diferente do Financeiro da OWL, que e baseado em
-- clientes/servicos).
create table if not exists fdmc_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receita', 'despesa')),
  description text not null,
  amount numeric not null check (amount > 0),
  entry_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists fdmc_entries_date_idx on fdmc_entries(entry_date desc);
