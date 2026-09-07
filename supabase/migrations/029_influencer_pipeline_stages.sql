-- Amplia o pipeline de influenciadores com as etapas de produção/publicação
-- (antes só ia até "fechado" ou "recusado" — faltava acompanhar o pós-fechamento).
alter table influencers drop constraint if exists influencers_status_check;
alter table influencers add constraint influencers_status_check
  check (status in (
    'a_contatar', 'em_contato', 'negociando', 'fechado',
    'video_gravado', 'aguardando_aprovacao', 'publicado',
    'recusado'
  ));
