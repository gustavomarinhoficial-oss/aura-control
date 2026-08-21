-- O upsert de relatório semanal (week_start, client_id) nunca funcionou:
-- os índices únicos parciais criados na migração 008 não servem de "arbiter"
-- pro ON CONFLICT (week_start, client_id) sem WHERE — Postgres sempre
-- recusava com "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Resultado: a tabela weekly_reports nunca recebeu uma
-- linha sequer. Troca pelos dois índices parciais por uma constraint única
-- de verdade, tratando NULL como igual a NULL (client_id nulo = relatório
-- da empresa) pra bater exatamente com o onConflict usado no código.

drop index if exists weekly_reports_company_idx;
drop index if exists weekly_reports_client_idx;

alter table weekly_reports
  add constraint weekly_reports_week_client_uniq
  unique nulls not distinct (week_start, client_id);
