-- Criativos de Tráfego: campanhas de anúncios pagos (Meta Ads) por cliente e os criativos de cada uma,
-- aprovados pelo cliente no mesmo link público do calendário. Área separada do calendário editorial.

create table if not exists ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  objective text not null default 'mensagens' check (objective in ('mensagens', 'alcance', 'engajamento', 'trafego')),
  budget_type text not null default 'total' check (budget_type in ('total', 'diaria')),
  budget_amount numeric check (budget_amount is null or budget_amount >= 0),
  start_date date,
  end_date date,
  schedule text,            -- dias e horários de veiculação (texto livre)
  audience text,            -- público (texto livre)
  status text not null default 'rascunho' check (status in ('rascunho', 'aguardando_aprovacao', 'aprovada', 'no_ar', 'pausada', 'encerrada')),
  notes text,               -- observação interna (nunca vai pro cliente)
  source text,              -- 'claude' quando criada pelo conector
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_campaigns_client_idx on ad_campaigns(client_id, created_at desc);

create table if not exists ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade, -- repetido da campanha: o link público confere o dono direto
  name text not null,
  media_urls text[] not null default '{}',
  cover_url text,
  placement text not null default 'ambos' check (placement in ('feed', 'stories_reels', 'ambos')),
  primary_text text,
  headline text,
  cta text not null default 'enviar_mensagem' check (cta in ('enviar_mensagem', 'saiba_mais', 'reservar', 'ligar_agora', 'ver_cardapio', 'pedir_agora')),
  destination_type text check (destination_type in ('whatsapp', 'link', 'instagram')),
  destination text,
  approval_status text not null default 'aguardando' check (approval_status in ('aguardando', 'aprovado', 'ajuste', 'reprovado')),
  client_comment text,
  approved_at timestamptz,
  reviewed_at timestamptz,
  position int not null default 0,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_creatives_campaign_idx on ad_creatives(campaign_id, position, created_at);
create index if not exists ad_creatives_client_idx on ad_creatives(client_id);

-- Mesmo padrão das outras tabelas internas: só usuário logado (e o servidor) acessa.
-- O cliente nunca lê direto: o link público passa pela API, que filtra pelo cliente dono do link.
alter table ad_campaigns enable row level security;
alter table ad_creatives enable row level security;
drop policy if exists "authenticated_all" on ad_campaigns;
drop policy if exists "authenticated_all" on ad_creatives;
create policy "authenticated_all" on ad_campaigns for all to authenticated using (true) with check (true);
create policy "authenticated_all" on ad_creatives for all to authenticated using (true) with check (true);
