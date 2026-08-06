CREATE TABLE IF NOT EXISTS content_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title          text NOT NULL,
  caption        text,
  platform       text NOT NULL DEFAULT 'instagram',
  status         text NOT NULL DEFAULT 'rascunho',
  scheduled_date date,
  published_at   timestamptz,
  responsible    text,
  result         jsonb NOT NULL DEFAULT '{}',
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated full access" ON content_posts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS content_posts_client_id_idx ON content_posts(client_id);
CREATE INDEX IF NOT EXISTS content_posts_scheduled_date_idx ON content_posts(scheduled_date);
