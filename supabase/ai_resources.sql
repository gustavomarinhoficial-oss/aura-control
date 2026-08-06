CREATE TABLE IF NOT EXISTS ai_resources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'prompt',
  content     text,
  link        text,
  tags        text[] DEFAULT '{}',
  author      text,
  uses_count  int NOT NULL DEFAULT 0,
  featured    boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE ai_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON ai_resources
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ai_resources_category_idx ON ai_resources(category);
CREATE INDEX IF NOT EXISTS ai_resources_featured_idx  ON ai_resources(featured);
CREATE INDEX IF NOT EXISTS ai_resources_created_at_idx ON ai_resources(created_at DESC);
