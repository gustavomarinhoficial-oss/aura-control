-- Capa (imagem) opcional de posts em vídeo (stories/reels), enviada pelo conector
alter table content_posts add column if not exists cover_url text;
