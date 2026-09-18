-- Hub da Marca: enriquece client_extras com o brief completo de cada
-- cliente (sem remover nada do que ja existe -- responsavel, objectives,
-- social_media, links, passwords continuam intactos).
alter table client_extras add column if not exists mission text;
alter table client_extras add column if not exists positioning text;
alter table client_extras add column if not exists target_audience text;
alter table client_extras add column if not exists competitors text;
alter table client_extras add column if not exists tone_of_voice text;
alter table client_extras add column if not exists avoid_topics text;
alter table client_extras add column if not exists brand_colors text;
alter table client_extras add column if not exists brand_manual_url text;
alter table client_extras add column if not exists products_services text;
alter table client_extras add column if not exists recurring_promos text;
alter table client_extras add column if not exists responsible_contacts jsonb not null default '[]'::jsonb;
alter table client_extras add column if not exists content_pillars text;
alter table client_extras add column if not exists content_goal text;
alter table client_extras add column if not exists instagram_notes text;
