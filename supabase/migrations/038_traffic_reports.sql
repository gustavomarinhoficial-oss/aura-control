-- Relatorio de trafego pago por cliente/mes (numeros da Meta Ads), com
-- pagina publica compartilhavel. Etapa 1: numeros lancados manualmente (ou
-- colados do export do Gerenciador); a automacao pela Marketing API vem
-- depois e preenche esta mesma tabela.
create table if not exists traffic_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  spend numeric(12,2) not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  link_clicks bigint not null default 0,
  results bigint not null default 0,
  result_label text not null default 'Resultados',
  campaigns jsonb not null default '[]'::jsonb,
  analysis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);

alter table traffic_reports enable row level security;

create policy "authenticated_all" on traffic_reports
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists traffic_reports_client_month_idx on traffic_reports(client_id, month desc);

-- Liga/desliga a pagina publica de trafego de cada cliente (mesmo padrao do
-- toggle de aprovacao de conteudo). Comeca desligado.
alter table clients add column if not exists traffic_sharing_enabled boolean not null default false;
