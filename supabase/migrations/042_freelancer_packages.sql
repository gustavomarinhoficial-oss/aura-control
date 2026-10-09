-- Pacotes de freelancer (ex.: editor de video: 15 videos por R$ 1.000).
-- A despesa so e lancada quando o pacote fecha; cada video entregue fica registrado.
create table if not exists freelancer_packages (
  id uuid primary key default gen_random_uuid(),
  freelancer_name text not null,
  total_videos int not null default 15 check (total_videos > 0),
  amount numeric(12,2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  expense_id uuid references expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists freelancer_package_videos (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references freelancer_packages(id) on delete cascade,
  delivered_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists freelancer_package_videos_pkg_idx on freelancer_package_videos(package_id);

alter table freelancer_packages enable row level security;
alter table freelancer_package_videos enable row level security;

drop policy if exists "authenticated_all" on freelancer_packages;
create policy "authenticated_all" on freelancer_packages for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_all" on freelancer_package_videos;
create policy "authenticated_all" on freelancer_package_videos for all to authenticated using (true) with check (true);
