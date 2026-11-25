-- Links de agendamento: o cliente escolhe um horário livre e a captação entra sozinha em Reuniões.

create table if not exists booking_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default 'Captação',
  client_id uuid references clients(id) on delete cascade, -- vazio = link aberto (a pessoa diz a empresa)
  member_ids uuid[] not null default '{}',                 -- quem vai: a agenda dessas pessoas bloqueia horários
  duration_min int not null default 180 check (duration_min between 15 and 720),
  step_min int not null default 60 check (step_min between 15 and 240),
  buffer_min int not null default 30 check (buffer_min between 0 and 240),   -- folga antes/depois de cada compromisso
  notice_hours int not null default 24 check (notice_hours between 0 and 720),
  mode text not null default 'semanal' check (mode in ('semanal', 'escolhidos')),
  weekly jsonb not null default '{}',                      -- {"1": [["09:00","12:00"],["14:00","18:00"]]} (0=domingo)
  slots text[] not null default '{}',                      -- "AAAA-MM-DD HH:MM": retirados (semanal) ou oferecidos (escolhidos)
  start_date date,
  end_date date,                                           -- vazio = sempre os próximos window_days dias
  window_days int not null default 30 check (window_days between 1 and 90),
  location text,                                           -- vazio = o cliente informa o local
  message text,
  max_bookings int default 1 check (max_bookings is null or max_bookings between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table booking_links enable row level security;
drop policy if exists "authenticated_all" on booking_links;
create policy "authenticated_all" on booking_links for all to authenticated using (true) with check (true);

alter table meetings add column if not exists booking_link_id uuid references booking_links(id) on delete set null;
create index if not exists meetings_booking_link_idx on meetings(booking_link_id) where booking_link_id is not null;

-- Marca o horário de forma segura: confere e grava de uma vez, um agendamento por vez,
-- então dois clientes nunca ficam com o mesmo horário.
create or replace function book_capture_slot(
  p_link uuid, p_date date, p_start int, p_title text, p_location text, p_notes text
) returns uuid language plpgsql set search_path = public as $$
declare
  l booking_links%rowtype;
  v_end int;
  v_used int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(60060);
  select * into l from booking_links where id = p_link;
  if not found or not l.active then raise exception 'LINK_CLOSED'; end if;

  if l.max_bookings is not null then
    select count(*) into v_used from meetings where booking_link_id = p_link and status <> 'cancelada';
    if v_used >= l.max_bookings then raise exception 'LINK_FULL'; end if;
  else
    -- link sem limite: trava em 10 marcações futuras, pra ninguém lotar a agenda
    select count(*) into v_used from meetings
      where booking_link_id = p_link and status <> 'cancelada' and meeting_date >= (now() at time zone 'America/Sao_Paulo')::date;
    if v_used >= 10 then raise exception 'LINK_FULL'; end if;
  end if;

  v_end := p_start + l.duration_min;
  if p_start < 0 or v_end > 1439 then raise exception 'SLOT_TAKEN'; end if;

  if exists (
    select 1 from meetings m
    where m.meeting_date = p_date
      and m.status <> 'cancelada'
      and (
        exists (select 1 from meeting_attendees a where a.meeting_id = m.id and a.member_id = any(l.member_ids))
        or not exists (select 1 from meeting_attendees a where a.meeting_id = m.id)
      )
      and (
        m.start_time is null
        or (
          p_start < coalesce(extract(epoch from m.end_time), extract(epoch from m.start_time) + 3600) / 60 + l.buffer_min
          and v_end + l.buffer_min > extract(epoch from m.start_time) / 60
        )
      )
  ) then raise exception 'SLOT_TAKEN'; end if;

  insert into meetings (title, type, client_id, meeting_date, start_time, end_time, location, notes, status, workspace, booking_link_id)
  values (p_title, 'captacao', l.client_id, p_date,
          time '00:00' + make_interval(mins => p_start), time '00:00' + make_interval(mins => v_end),
          p_location, p_notes, 'agendada', 'owl', p_link)
  returning id into v_id;

  insert into meeting_attendees (meeting_id, member_id)
  select v_id, mb.id from members mb where mb.id = any(l.member_ids);

  return v_id;
end $$;

-- Só o servidor do Hub pode marcar (nunca direto pelo navegador)
revoke all on function book_capture_slot(uuid, date, int, text, text, text) from public, anon, authenticated;
grant execute on function book_capture_slot(uuid, date, int, text, text, text) to service_role;

notify pgrst, 'reload schema';
