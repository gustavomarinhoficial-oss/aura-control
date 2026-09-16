-- Receita antecipada: reserva separada do caixa da empresa, pra guardar
-- dinheiro que cliente pagou adiantado (e o rendimento que ele gera),
-- sem misturar com o saldo normal do caixa. Mesmo padrao de
-- cash_movements (linha com sinal, saldo = soma de tudo), so numa
-- tabela propria.
create table if not exists advance_revenue_movements (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('deposito', 'rendimento', 'retirada')),
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table advance_revenue_movements enable row level security;

create policy "authenticated_all" on advance_revenue_movements
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists advance_revenue_movements_date_idx on advance_revenue_movements(date desc);
