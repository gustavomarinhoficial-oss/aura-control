-- Horario de termino do compromisso (sem ele, o calendario considera 1 hora).
alter table meetings add column if not exists end_time time;
