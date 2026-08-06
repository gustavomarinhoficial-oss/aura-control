CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  estimated_value numeric(12,2),
  stage text NOT NULL DEFAULT 'prospecto',
  notes text,
  last_contact_at date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
