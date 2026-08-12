-- Attribute each saved lead to the source that found it, so Source Manager
-- can show not just a running "N leads generated" counter but the actual
-- list of which leads came from which source.
-- Historical leads saved before this migration will have source_id = null —
-- there's no reliable way to backfill that link retroactively.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_source_id ON leads(source_id);
