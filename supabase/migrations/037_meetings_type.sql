-- Permite marcar um compromisso como reuniao ou captacao (filmagem/producao
-- de conteudo com o cliente), sem criar uma tabela paralela -- mesma
-- estrutura de titulo/data/local/participantes/status ja serve pras duas.
alter table meetings add column if not exists type text not null default 'reuniao';
alter table meetings drop constraint if exists meetings_type_check;
alter table meetings add constraint meetings_type_check check (type in ('reuniao', 'captacao'));
