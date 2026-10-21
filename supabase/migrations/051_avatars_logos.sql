-- Foto de perfil da equipe e logo das empresas
alter table members add column if not exists avatar_url text;
alter table clients add column if not exists logo_url text;
