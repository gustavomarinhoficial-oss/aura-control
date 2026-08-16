-- Relatórios semanais gerados pelo Omar (geral da empresa + um por cliente)

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  client_id uuid references clients(id) on delete cascade,
  summary text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table weekly_reports enable row level security;

create policy "authenticated_all" on weekly_reports
  for all
  to authenticated
  using (true)
  with check (true);

-- Só um relatório geral (client_id nulo) por semana
create unique index if not exists weekly_reports_company_idx
  on weekly_reports(week_start) where client_id is null;

-- Só um relatório por cliente por semana
create unique index if not exists weekly_reports_client_idx
  on weekly_reports(week_start, client_id) where client_id is not null;

create index if not exists weekly_reports_week_start_idx on weekly_reports(week_start desc);
