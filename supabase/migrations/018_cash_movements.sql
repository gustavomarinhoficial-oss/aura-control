-- Caixa da empresa (reserva financeira) — controlado manualmente pelo Gustavo.
-- Cada linha é um movimento com sinal (positivo entra, negativo sai); o saldo
-- é sempre a soma de tudo. Começa zerado (nenhum movimento lançado ainda).

create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('aporte', 'retirada', 'distribuicao_socio', 'reinvestimento', 'ajuste')),
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table cash_movements enable row level security;

create policy "authenticated_all" on cash_movements
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists cash_movements_date_idx on cash_movements(date desc);

-- Configuração única do caixa (meta de reserva mínima)
create table if not exists cash_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  reserve_target numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table cash_settings enable row level security;

create policy "authenticated_all" on cash_settings
  for all
  to authenticated
  using (true)
  with check (true);

insert into cash_settings (id, reserve_target)
values ('00000000-0000-0000-0000-000000000001', 0)
on conflict (id) do nothing;
