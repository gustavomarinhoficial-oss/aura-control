-- Guarda o ultimo mix de formatos + dias da semana usados no gerador de
-- calendario de cada cliente, pra pre-preencher a proxima geracao
-- automaticamente (ver /api/clients/[id]/generate-calendar).
alter table client_extras add column if not exists default_content_mix jsonb not null default '{}'::jsonb;
