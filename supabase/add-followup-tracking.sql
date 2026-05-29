-- ============================================================
-- Follow-up & touch tracking for leads
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- When the lead was first contacted (set on the initial outreach).
alter table leads add column if not exists contacted_at timestamptz;

-- Most recent touch (initial or any follow-up).
alter table leads add column if not exists last_contacted_at timestamptz;

-- How many FOLLOW-UPS have been sent (0 = only the initial message).
alter table leads add column if not exists follow_up_stage smallint default 0;

-- When the next follow-up becomes due (null = no more follow-ups owed).
alter table leads add column if not exists next_follow_up_at timestamptz;

-- The channel of the last touch (telegram / linkedin / twitter / email).
alter table leads add column if not exists last_channel text;

-- Helps the "follow-ups due" query stay fast.
create index if not exists leads_next_follow_up_idx on leads (next_follow_up_at)
  where status = 'contacted';
