CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  due_date date NOT NULL,
  paid_at timestamptz,
  recurrent boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
