-- Ponto de partida do fluxo de caixa mensal: saldo inicial e a partir de qual mes contar.
alter table available_cash add column if not exists opening_balance numeric not null default 0;
alter table available_cash add column if not exists flow_start_month text;
