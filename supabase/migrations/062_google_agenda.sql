-- Google Agenda nos dois sentidos + regra nova do link de agendamento:
-- duas captações nunca ao mesmo tempo; reunião só bloqueia se não sobrar gente suficiente livre.

-- 1) Link de agendamento
alter table booking_links add column if not exists min_people int not null default 2 check (min_people between 1 and 10);

create or replace function book_capture_slot(
  p_link uuid, p_date date, p_start int, p_title text, p_location text, p_notes text
) returns uuid language plpgsql set search_path = public as $$
declare
  l booking_links%rowtype;
  v_end int;
  v_used int;
  v_team int;
  v_out int;
  v_unknown int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(60060);
  select * into l from booking_links where id = p_link;
  if not found or not l.active then raise exception 'LINK_CLOSED'; end if;

  if l.max_bookings is not null then
    select count(*) into v_used from meetings where booking_link_id = p_link and status <> 'cancelada';
    if v_used >= l.max_bookings then raise exception 'LINK_FULL'; end if;
  else
    -- link sem limite: trava em 40 marcações futuras, pra ninguém lotar a agenda
    select count(*) into v_used from meetings
      where booking_link_id = p_link and status <> 'cancelada' and meeting_date >= (now() at time zone 'America/Sao_Paulo')::date;
    if v_used >= 40 then raise exception 'LINK_FULL'; end if;
  end if;

  v_end := p_start + l.duration_min;
  if p_start < 0 or v_end > 1439 then raise exception 'SLOT_TAKEN'; end if;

  -- mesma conta de src/lib/booking/slots.ts (isBusy)
  if exists (
    select 1 from meetings m
    where m.workspace = 'owl' and m.meeting_date = p_date and m.status <> 'cancelada' and m.type = 'captacao'
      and (
        m.start_time is null
        or (
          p_start < coalesce(extract(epoch from m.end_time), extract(epoch from m.start_time) + 3600) / 60 + l.buffer_min
          and v_end + l.buffer_min > extract(epoch from m.start_time) / 60
        )
      )
  ) then raise exception 'SLOT_TAKEN'; end if;

  select count(distinct a.member_id) filter (where a.member_id = any(l.member_ids)),
         count(*) filter (where a.member_id is null and m.start_time is not null)
    into v_out, v_unknown
    from meetings m left join meeting_attendees a on a.meeting_id = m.id
    where m.workspace = 'owl' and m.meeting_date = p_date and m.status <> 'cancelada' and m.type <> 'captacao'
      and (
        m.start_time is null
        or (
          p_start < coalesce(extract(epoch from m.end_time), extract(epoch from m.start_time) + 3600) / 60 + l.buffer_min
          and v_end + l.buffer_min > extract(epoch from m.start_time) / 60
        )
      );
  select count(distinct x) into v_team from unnest(l.member_ids) x;
  -- reunião sem participante (as criadas no Google) conta como uma pessoa ocupada
  if v_team - v_out - least(v_unknown, 1) < least(l.min_people, v_team) then raise exception 'SLOT_TAKEN'; end if;

  insert into meetings (title, type, client_id, meeting_date, start_time, end_time, location, notes, status, workspace, booking_link_id)
  values (p_title, 'captacao', l.client_id, p_date,
          time '00:00' + make_interval(mins => p_start), time '00:00' + make_interval(mins => v_end),
          p_location, p_notes, 'agendada', 'owl', p_link)
  returning id into v_id;

  insert into meeting_attendees (meeting_id, member_id)
  select v_id, mb.id from members mb where mb.id = any(l.member_ids);

  return v_id;
end $$;

-- 2) Google Agenda
alter table meetings add column if not exists google_event_id text;
alter table meetings add column if not exists google_updated text;                                  -- "updated" do Google na última conferência
alter table meetings add column if not exists google_dirty boolean not null default false;          -- mudou no Hub e falta mandar pro Google
alter table meetings add column if not exists google_changed_at timestamptz not null default now(); -- quando mudou no Hub
create unique index if not exists meetings_google_event_idx on meetings(google_event_id) where google_event_id is not null;

-- Compromissos apagados no Hub que ainda precisam sair do Google
create table if not exists google_deletions (
  event_id text primary key,
  created_at timestamptz not null default now()
);

-- Situação da sincronização (uma linha só)
create table if not exists google_sync (
  id int primary key default 1 check (id = 1),
  calendar_id text,
  locked_until timestamptz,
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text
);
insert into google_sync (id) values (1) on conflict do nothing;

-- Só o servidor do Hub enxerga
alter table google_deletions enable row level security;
alter table google_sync enable row level security;

create or replace function meetings_google_mark() returns trigger language plpgsql as $$
begin
  -- gravação feita pela própria sincronização: não marca de novo
  if new.google_event_id is distinct from old.google_event_id or new.google_updated is distinct from old.google_updated then return new; end if;
  if (new.title, new.type, new.client_id, new.lead_id, new.meeting_date, new.start_time, new.end_time, new.location, new.meeting_link, new.notes, new.status)
     is distinct from
     (old.title, old.type, old.client_id, old.lead_id, old.meeting_date, old.start_time, old.end_time, old.location, old.meeting_link, old.notes, old.status) then
    new.google_dirty := true;
    new.google_changed_at := clock_timestamp();
  end if;
  return new;
end $$;
drop trigger if exists meetings_google_mark on meetings;
create trigger meetings_google_mark before update on meetings for each row execute function meetings_google_mark();

-- Trocar participantes atualiza a descrição do evento (não vale como "mudança mais recente")
create or replace function attendees_google_mark() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update meetings set google_dirty = true
    where id = (case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end) and google_event_id is not null;
  return null;
end $$;
drop trigger if exists attendees_google_mark on meeting_attendees;
create trigger attendees_google_mark after insert or delete on meeting_attendees for each row execute function attendees_google_mark();

create or replace function meetings_google_deleted() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.google_event_id is not null then
    insert into google_deletions (event_id) values (old.google_event_id) on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists meetings_google_deleted on meetings;
create trigger meetings_google_deleted after delete on meetings for each row execute function meetings_google_deleted();

create or replace view google_meetings with (security_invoker = true) as
  select m.id, m.title, m.type, m.meeting_date, m.start_time, m.end_time, m.location, m.meeting_link, m.notes, m.status,
         m.google_event_id, m.google_updated, m.google_dirty, m.google_changed_at,
         coalesce(c.name, l.company_name) as client_name,
         (select string_agg(mb.name, ', ' order by mb.name) from meeting_attendees a join members mb on mb.id = a.member_id where a.meeting_id = m.id) as team
  from meetings m
  left join clients c on c.id = m.client_id
  left join leads l on l.id = m.lead_id
  where m.workspace = 'owl';
revoke all on google_meetings from anon, authenticated;
grant select on google_meetings to service_role;

-- 3) Confere os dois lados a cada minuto
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('google-agenda', '* * * * *',
  $$ select net.http_post(url := 'https://hub.owlcreative.club/api/cron/google-agenda', timeout_milliseconds := 30000) $$);

notify pgrst, 'reload schema';
