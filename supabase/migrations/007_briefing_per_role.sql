-- Estende o CEO Briefing pra gerar uma recomendação diária personalizada por pessoa (role)

alter table ceo_briefings add column if not exists role text not null default 'gustavo';

alter table ceo_briefings drop constraint if exists ceo_briefings_briefing_date_key;

create unique index if not exists ceo_briefings_date_role_idx on ceo_briefings(briefing_date, role);
