-- Aura Control — Schema inicial
-- Execute este arquivo no Supabase Dashboard > SQL Editor

-- Clientes
CREATE TABLE IF NOT EXISTS clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text,
  phone       text,
  status      text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','encerrado')),
  started_at  date NOT NULL DEFAULT CURRENT_DATE,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- Histórico de mudanças de status
CREATE TABLE IF NOT EXISTS client_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text NOT NULL,
  note        text,
  changed_at  timestamptz DEFAULT now()
);

-- Serviços/contratos por cliente
CREATE TABLE IF NOT EXISTS services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('recorrente','avulso')),
  amount      numeric(12,2) NOT NULL,
  recurrence  text CHECK (recurrence IN ('mensal','trimestral','anual','único')),
  started_at  date NOT NULL DEFAULT CURRENT_DATE,
  ended_at    date,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Cobranças
CREATE TABLE IF NOT EXISTS charges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES services(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  due_date    date NOT NULL,
  paid_at     timestamptz,
  status      text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado')),
  created_at  timestamptz DEFAULT now()
);

-- Metas
CREATE TABLE IF NOT EXISTS goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period       text NOT NULL,
  type         text NOT NULL CHECK (type IN ('mrr','clientes')),
  target_value numeric(12,2) NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- RLS: habilitar em todas as tabelas
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Policies: usuários autenticados têm acesso total
CREATE POLICY "authenticated_all" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON client_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON charges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON goals FOR ALL TO authenticated USING (true) WITH CHECK (true);
