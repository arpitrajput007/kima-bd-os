-- Per-contact outreach tracking: which channels have been used to reach this person
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contacted_channels jsonb DEFAULT '[]'::jsonb;
