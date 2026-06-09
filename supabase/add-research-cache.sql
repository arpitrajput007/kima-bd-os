-- Research cache: store every qualify-lead result so we never burn API
-- credits researching the same company twice.
CREATE TABLE IF NOT EXISTS lead_research_cache (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  url             text        NOT NULL,
  domain          text        NOT NULL,           -- normalised domain for dedup
  company_name    text,
  research_data   jsonb       NOT NULL,           -- full QualifyResult JSON
  web_research_used boolean   DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Fast lookup by domain (one company can have many URLs)
CREATE INDEX IF NOT EXISTS lead_research_cache_domain_idx
  ON lead_research_cache (domain);

-- No RLS needed — this is a single-user internal tool
ALTER TABLE lead_research_cache DISABLE ROW LEVEL SECURITY;
