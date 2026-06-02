-- Add channel tracking to lead_activities so we know WHERE each outreach happened.
ALTER TABLE lead_activities
  ADD COLUMN IF NOT EXISTS channel text
    CHECK (channel IN ('telegram', 'twitter', 'linkedin', 'email', 'discord', 'call', 'other')),
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;
