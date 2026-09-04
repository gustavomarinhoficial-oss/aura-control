-- Permite compartilhar o cronograma (aba Projetos) com o cliente pelo mesmo
-- link público que já é usado pra aprovação de conteúdo — controlado por
-- cliente, independente da aprovação de conteúdo estar ligada ou não.
alter table clients add column if not exists project_sharing_enabled boolean not null default false;
