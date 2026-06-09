-- Add suggestion_reason to agent_rules so pending-approval suggestions
-- can explain WHY the agent is recommending this rule change.
ALTER TABLE agent_rules ADD COLUMN IF NOT EXISTS suggestion_reason text;
