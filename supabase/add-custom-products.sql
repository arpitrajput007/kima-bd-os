-- Custom products: BD-added products/services researched by the AI agent.
-- The user pastes a URL, uploads a document, or pastes text describing a
-- product; the agent extracts the content and returns a structured
-- go-to-market analysis (see CustomProductAnalysis in lib/types.ts),
-- stored whole in `analysis`.
CREATE TABLE IF NOT EXISTS custom_products (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name              text        NOT NULL,
  source_type       text        NOT NULL CHECK (source_type IN ('url', 'document', 'text')),
  source_url        text,
  source_filename   text,
  analysis          jsonb       NOT NULL,
  status            text        NOT NULL DEFAULT 'active',
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_products_status_idx ON custom_products (status);

-- No RLS needed — this is a single-user internal tool
ALTER TABLE custom_products DISABLE ROW LEVEL SECURITY;
