-- Prospecção de micro-influenciadores pros clientes da agência (função interna,
-- separada do Pipeline de vendas — não é lead de cliente novo).

create table if not exists influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  niche text,
  instagram text,
  phone text,
  email text,
  client_id uuid references clients(id) on delete set null,
  status text not null default 'a_contatar'
    check (status in ('a_contatar', 'em_contato', 'negociando', 'fechado', 'recusado')),
  value numeric(12,2),
  responsible text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table influencers enable row level security;

create policy "authenticated_all" on influencers
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists influencers_status_idx on influencers(status);
create index if not exists influencers_client_idx on influencers(client_id);
