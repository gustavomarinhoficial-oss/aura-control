-- Link de aprovacao com o nome da empresa (hub.owlcreative.club/stadium-steakhouse)
-- em vez do token longo. O link antigo (/publico/<token>) continua funcionando.
alter table clients add column if not exists share_slug text;
create unique index if not exists clients_share_slug_key on clients (lower(share_slug)) where share_slug is not null;
