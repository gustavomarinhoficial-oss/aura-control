-- Marca um post de conteúdo como sincronizado automaticamente a partir de um
-- jogo de futebol (ESPN) — evita duplicar o mesmo jogo em execuções futuras
-- da rotina, e permite corrigir data/hora sozinho se o jogo for adiado.

alter table content_posts add column if not exists external_event_id text;

create unique index if not exists content_posts_external_event_unique
  on content_posts(client_id, external_event_id)
  where external_event_id is not null;
