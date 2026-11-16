-- Patrimônio da empresa: bens (câmeras, lentes, iluminação...) e as despesas de Reinvestimento ligadas a eles
create table if not exists company_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'outros' check (category in ('video', 'foto', 'audio', 'informatica', 'outros')),
  brand_model text,
  serial_number text,
  purchase_date date not null,
  total_amount numeric not null default 0,
  payment_method text not null default 'avista' check (payment_method in ('avista', 'parcelado')),
  installments int,
  first_installment_date date,
  card text,
  holder text,
  condition text not null default 'novo' check (condition in ('novo', 'em_uso', 'manutencao', 'vendido', 'perdido')),
  invoice_url text,
  invoice_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table company_assets enable row level security;
create policy "authenticated_all" on company_assets for all to authenticated using (true) with check (true);

-- Despesa gerada por um bem (à vista ou parcela). Apagar o bem não apaga as parcelas já pagas.
alter table expenses add column if not exists asset_id uuid references company_assets(id) on delete set null;
create index if not exists expenses_asset_id_idx on expenses(asset_id);
