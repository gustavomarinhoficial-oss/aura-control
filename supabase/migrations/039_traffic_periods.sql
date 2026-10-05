-- Relatorio de trafego passa de "mes" pra "periodo" livre (ex: 15/09 a 14/10),
-- porque o ciclo das campanhas comeca no dia 15. Os relatorios que ja existem
-- viram o mes cheio (1o ao ultimo dia) -- nada e perdido.
alter table traffic_reports add column if not exists period_start date;
alter table traffic_reports add column if not exists period_end date;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'traffic_reports' and column_name = 'month'
  ) then
    update traffic_reports
    set period_start = to_date(month || '-01', 'YYYY-MM-DD'),
        period_end = (to_date(month || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date
    where period_start is null;
  end if;
end $$;

alter table traffic_reports alter column period_start set not null;
alter table traffic_reports alter column period_end set not null;

alter table traffic_reports drop constraint if exists traffic_reports_client_id_month_key;
drop index if exists traffic_reports_client_month_idx;
alter table traffic_reports drop column if exists month;

alter table traffic_reports drop constraint if exists traffic_reports_period_order;
alter table traffic_reports add constraint traffic_reports_period_order check (period_end >= period_start);
alter table traffic_reports drop constraint if exists traffic_reports_client_period_key;
alter table traffic_reports add constraint traffic_reports_client_period_key unique (client_id, period_start);
create index if not exists traffic_reports_client_period_idx on traffic_reports(client_id, period_start desc);
