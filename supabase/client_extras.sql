CREATE TABLE client_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE UNIQUE NOT NULL,
  responsavel text,
  objectives text,
  social_media jsonb DEFAULT '[]',
  links jsonb DEFAULT '[]',
  passwords jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON client_extras FOR ALL TO authenticated USING (true) WITH CHECK (true);
