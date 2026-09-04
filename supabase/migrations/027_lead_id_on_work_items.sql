-- Permite vincular tarefas, reuniões e projetos a um lead (antes de virar
-- cliente), sem misturar leads na base de clientes de verdade.
alter table tasks    add column if not exists lead_id uuid references leads(id) on delete set null;
alter table meetings add column if not exists lead_id uuid references leads(id) on delete set null;
alter table projects add column if not exists lead_id uuid references leads(id) on delete set null;

create index if not exists tasks_lead_id_idx    on tasks(lead_id);
create index if not exists meetings_lead_id_idx on meetings(lead_id);
create index if not exists projects_lead_id_idx on projects(lead_id);
