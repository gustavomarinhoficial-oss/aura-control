-- Despesas parceladas: parcela n de N (aparece como "Parcela 3/8" no Financeiro)
alter table expenses add column if not exists installment_number int;
alter table expenses add column if not exists installments_total int;
alter table fdmc_entries add column if not exists installment_number int;
alter table fdmc_entries add column if not exists installments_total int;
