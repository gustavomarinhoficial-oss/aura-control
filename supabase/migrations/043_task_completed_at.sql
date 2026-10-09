-- Data em que a tarefa foi concluida, pra os relatorios contarem "o que foi feito na semana".
alter table tasks add column if not exists completed_at timestamptz;
create index if not exists tasks_completed_at_idx on tasks(completed_at) where completed_at is not null;
