-- Aporte lançado na aba Caixa/Reserva vira despesa "Aplicação / aporte" no Financeiro, ligada ao movimento
alter table expenses add column if not exists cash_movement_id uuid references cash_movements(id) on delete cascade;
create index if not exists expenses_cash_movement_id_idx on expenses(cash_movement_id);
