-- Permite marcar manualmente um lancamento do FDMC como pago/recebido
-- (mesmo padrao de expenses/charges no Financeiro principal), em vez de
-- confiar só na data pra decidir se ja entrou ou nao.
alter table fdmc_entries add column if not exists paid_at timestamptz;
