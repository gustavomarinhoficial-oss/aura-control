-- Permite encerrar uma despesa recorrente a partir de um mês específico
-- (ex: "não preciso mais pagar isso a partir de dezembro"). Quando setado,
-- a geração automática de novas parcelas futuras para o grupo para nessa data.

alter table expenses add column if not exists recurrence_end_date date;
