-- Central de IA do FDMC Hub -- mesma tabela da OWL (ai_resources),
-- so ganha a mesma coluna "workspace" ja usada em tasks/meetings.
alter table ai_resources add column if not exists workspace text not null default 'owl';
alter table ai_resources drop constraint if exists ai_resources_workspace_check;
alter table ai_resources add constraint ai_resources_workspace_check check (workspace in ('owl', 'fdmc'));

create index if not exists ai_resources_workspace_idx on ai_resources(workspace);

-- Aba "Caixa" dentro do Financeiro do FDMC -- reserva guardada,
-- lancada manualmente (mesma ideia da pagina Caixa da OWL, so mais
-- simples: sem tipos de movimento especificos de socio, so
-- entrada/saida com valor, data e nota).
create table if not exists fdmc_cash_movements (
  id uuid primary key default gen_random_uuid(),
  movement_date date not null,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists fdmc_cash_movements_date_idx on fdmc_cash_movements(movement_date desc);
