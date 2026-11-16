-- Escopos do token do conector: "conteudo" (calendário editorial) e/ou "financeiro" (OWL e FDMC)
alter table mcp_tokens add column if not exists scopes text[] not null default '{conteudo}';
