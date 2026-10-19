-- Financeiro do FDMC no mesmo padrao do da OWL: categorias, recorrencia mensal e
-- (ja existente) data de pagamento. Receita/despesa continuam no mesmo lancamento.
alter table fdmc_entries add column if not exists category text not null default 'outro';
alter table fdmc_entries add column if not exists recurrent boolean not null default false;
alter table fdmc_entries add column if not exists recurrence_group uuid;
alter table fdmc_entries add column if not exists recurrence_end_date date;
create index if not exists fdmc_entries_recurrence_group_idx on fdmc_entries(recurrence_group);
-- impede gerar duas parcelas do mesmo grupo no mesmo mes
create unique index if not exists fdmc_entries_group_date_uniq on fdmc_entries(recurrence_group, entry_date);
