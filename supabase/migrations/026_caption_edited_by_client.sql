-- Permite o cliente editar a legenda direto no painel de aprovação (em vez de
-- ter que reprovar o post só pra corrigir um detalhe do texto). Esse campo
-- marca que a legenda em vigor foi ajustada pelo cliente, pra aparecer um
-- aviso "Legenda ajustada" no painel interno na hora de copiar pra postar.
alter table content_posts add column if not exists caption_edited_by_client boolean not null default false;
