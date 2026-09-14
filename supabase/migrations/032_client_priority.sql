-- Ordem de exibicao dos clientes (ex: abas da Central de Conteudo) --
-- numero menor aparece primeiro. Default alto (999) pra cliente novo,
-- sem prioridade definida, cair no fim da lista em vez do comeco.
alter table clients add column if not exists priority integer not null default 999;
