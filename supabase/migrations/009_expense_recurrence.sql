-- Liga as instâncias de uma despesa recorrente (ex: salários mensais) pra
-- permitir gerar os meses futuros automaticamente e atualizar o valor
-- "a partir de agora" em todas as parcelas futuras não pagas.

alter table expenses add column if not exists recurrence_group uuid;

create index if not exists expenses_recurrence_group_idx on expenses(recurrence_group);
