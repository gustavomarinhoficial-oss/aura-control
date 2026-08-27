-- Horário opcional de publicação (junto da data agendada) e o link do post
-- depois de publicado, pedido no momento em que o status vira "publicado".

alter table content_posts add column if not exists scheduled_time time;
alter table content_posts add column if not exists post_link text;
