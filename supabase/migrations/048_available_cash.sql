-- Caixa disponivel: quanto esta solto na conta corrente (sem aplicar e sem uso), informado na mao.
-- Uma linha por empresa (OWL e FDMC).
create table if not exists available_cash (
  workspace text primary key check (workspace in ('owl', 'fdmc')),
  amount numeric not null default 0,
  note text,
  updated_at timestamptz not null default now()
);

alter table available_cash enable row level security;
drop policy if exists "authenticated_all" on available_cash;
create policy "authenticated_all" on available_cash for all to authenticated using (true) with check (true);

insert into available_cash (workspace, amount) values ('owl', 0), ('fdmc', 0) on conflict (workspace) do nothing;
