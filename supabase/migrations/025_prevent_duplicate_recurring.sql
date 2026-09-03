-- Corrige o bug que fez a BMF e a Petnico aparecerem duas vezes no financeiro:
-- a página do financeiro chama /api/charges/generate e /api/expenses/generate
-- a cada carregamento, e se duas chamadas caem quase juntas (duas abas
-- abertas, F5 durante o carregamento etc), ambas liam "ainda não gerei o mês
-- que vem" antes de qualquer uma das duas terminar de inserir, e as duas
-- criavam a mesma cobrança/despesa. Esse índice único trava isso no banco:
-- nunca mais deixa existir duas cobranças do mesmo serviço no mesmo
-- vencimento, nem duas parcelas da mesma despesa recorrente no mesmo mês.
create unique index if not exists charges_service_due_date_uniq
  on charges (service_id, due_date)
  where service_id is not null;

create unique index if not exists expenses_recurrence_due_date_uniq
  on expenses (recurrence_group, due_date)
  where recurrence_group is not null;
