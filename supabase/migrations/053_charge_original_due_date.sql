-- Vencimento oficial da cobrança (o do painel do cliente), guardado quando a data daquele mês é reagendada
alter table charges add column if not exists original_due_date date;
