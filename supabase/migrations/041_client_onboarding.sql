-- Formulario de onboarding do cliente (diagnostico completo), preenchido por um
-- link unico por cliente. As respostas ficam guardadas exatamente como o cliente
-- escreveu e, ao enviar, sao aplicadas automaticamente no Hub da marca.
alter table clients add column if not exists onboarding_token text;
create unique index if not exists clients_onboarding_token_key on clients(onboarding_token) where onboarding_token is not null;

create table if not exists client_onboarding (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado')),
  current_step int not null default 0,
  submitted_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table client_onboarding enable row level security;

drop policy if exists "authenticated_all" on client_onboarding;
create policy "authenticated_all" on client_onboarding
  for all
  to authenticated
  using (true)
  with check (true);
