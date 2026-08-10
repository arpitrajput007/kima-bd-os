-- AER360-primary BD-agent upgrade (2026-08-11).
-- Adds the fields the discovery/qualification prompts now produce:
-- explicit customer/competitor/partner classification (so a competitor that
-- clears the score bar never gets worked as a lead), a distinct gap field
-- (separate from pain_point — "what's architecturally missing", defaults to
-- "Gap not confirmed" when unsupported by evidence), explicit financial/agent
-- activity facts, trigger dating (needed for freshness scoring — trigger_reason
-- had no date or its own source URL before this), and an outreach hook plus
-- the "unknown" bucket to complete the FACT/INFERENCE/UNKNOWN evidence triad
-- alongside the existing facts/assumptions columns.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS classification text
    CHECK (classification IN ('customer', 'partner', 'competitor', 'integration', 'investor_ecosystem', 'not_relevant', 'unclear')),
  ADD COLUMN IF NOT EXISTS potential_gap text,
  ADD COLUMN IF NOT EXISTS financial_activity text,
  ADD COLUMN IF NOT EXISTS agent_activity text,
  ADD COLUMN IF NOT EXISTS trigger_date text,
  ADD COLUMN IF NOT EXISTS trigger_source_url text,
  ADD COLUMN IF NOT EXISTS outreach_angle text,
  ADD COLUMN IF NOT EXISTS unknowns jsonb DEFAULT '[]';
