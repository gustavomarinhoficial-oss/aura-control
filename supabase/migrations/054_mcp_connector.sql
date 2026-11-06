-- Conector MCP (Claude -> calendário editorial do Hub)

-- Tokens do conector: só o hash fica guardado. RLS ligado e SEM policies:
-- só o servidor (service role) lê; nenhum usuário logado nem cliente enxerga.
create table if not exists mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  label text,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table mcp_tokens enable row level security;

-- Origem do post: "claude" quando criado pelo conector, e quando
alter table content_posts add column if not exists source text;
alter table content_posts add column if not exists source_at timestamptz;
