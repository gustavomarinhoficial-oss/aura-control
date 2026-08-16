-- CEO Briefing — recomendação diária gerada pelo Omar, cacheada por dia

create table if not exists ceo_briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null unique,
  recommendation text not null,
  focos jsonb not null default '[]',
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table ceo_briefings enable row level security;

create policy "authenticated_all" on ceo_briefings
  for all
  to authenticated
  using (true)
  with check (true);
