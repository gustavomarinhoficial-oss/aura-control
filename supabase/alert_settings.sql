-- Tabela de configurações de alertas
CREATE TABLE IF NOT EXISTS alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_enabled boolean DEFAULT false,
  email_addresses text[] DEFAULT '{}',
  whatsapp_enabled boolean DEFAULT false,
  whatsapp_numbers jsonb DEFAULT '[]',
  frequency_hours integer DEFAULT 2,
  days_ahead integer DEFAULT 1,
  time_start integer DEFAULT 8,
  time_end integer DEFAULT 20,
  last_sent_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Garante que só existe uma linha de config
INSERT INTO alert_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON alert_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
