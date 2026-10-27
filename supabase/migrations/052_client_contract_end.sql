-- Fim do contrato do cliente (vazio = contrato sem fim definido)
alter table clients add column if not exists contract_end date;
