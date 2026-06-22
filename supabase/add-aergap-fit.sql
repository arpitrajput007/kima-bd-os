-- Add a first-class Aergap fit field for AI-agent leads.
-- enrich-lead already evaluates Aergap (agent governance) fit but had nowhere
-- to store it, so the result was discarded. These columns persist it alongside
-- kima_fit / aeredium_fit so the lead page and BD brief can surface it.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS aergap_fit text,
  ADD COLUMN IF NOT EXISTS agent_control_angle text;
