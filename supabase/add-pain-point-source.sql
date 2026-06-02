-- Add source URL and reasoning type for pain point evidence.
-- Lets the UI show whether evidence came from a real article or agent analysis.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS pain_point_source_url text,
  ADD COLUMN IF NOT EXISTS pain_point_evidence_type text
    CHECK (pain_point_evidence_type IN ('verified_source', 'agent_analysis', 'inferred'))
    DEFAULT 'agent_analysis';
