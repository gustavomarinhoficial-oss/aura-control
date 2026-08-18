-- Reuniões: agenda separada de tarefas, com horário, local e participantes.

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references clients(id) on delete set null,
  meeting_date date not null,
  start_time time,
  location text,
  notes text,
  status text not null default 'agendada',
  created_at timestamptz not null default now()
);

create table if not exists meeting_attendees (
  meeting_id uuid not null references meetings(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (meeting_id, member_id)
);

alter table meetings enable row level security;
alter table meeting_attendees enable row level security;

create policy "authenticated_all" on meetings
  for all to authenticated using (true) with check (true);

create policy "authenticated_all" on meeting_attendees
  for all to authenticated using (true) with check (true);

create index if not exists meetings_date_idx on meetings(meeting_date);
create index if not exists meeting_attendees_meeting_id_idx on meeting_attendees(meeting_id);
create index if not exists meeting_attendees_member_id_idx on meeting_attendees(member_id);
