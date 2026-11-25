-- Agendamento: reuniões do FDMC não bloqueiam horário; link sem limite aceita até 40 marcações futuras.

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
    -- link sem limite: trava em 40 marcações futuras, pra ninguém lotar a agenda
    select count(*) into v_used from meetings
      where booking_link_id = p_link and status <> 'cancelada' and meeting_date >= (now() at time zone 'America/Sao_Paulo')::date;
    if v_used >= 40 then raise exception 'LINK_FULL'; end if;
  end if;

  v_end := p_start + l.duration_min;
  if p_start < 0 or v_end > 1439 then raise exception 'SLOT_TAKEN'; end if;

  if exists (
    select 1 from meetings m
    where m.workspace = 'owl'
      and m.meeting_date = p_date
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
