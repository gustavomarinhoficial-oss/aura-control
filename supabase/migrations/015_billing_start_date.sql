-- clients.billing_day já existia no banco (adicionada direto pelo dashboard,
-- sem migration) — formaliza aqui com uma constraint de faixa segura (1-28,
-- evita problema de mês com menos dias, tipo fevereiro).
alter table clients add column if not exists billing_day integer;
alter table clients drop constraint if exists clients_billing_day_check;
alter table clients add constraint clients_billing_day_check
  check (billing_day is null or (billing_day between 1 and 28));

-- Data a partir da qual um serviço passa a gerar cobrança de verdade.
-- Usado quando um cliente entra no meio do mês mas só deve começar a pagar
-- num mês futuro (ex: entrou dia 15/08, primeira cobrança só em setembro).
alter table services add column if not exists first_charge_date date;
