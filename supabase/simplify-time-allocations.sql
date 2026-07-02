-- ============================================================
-- Simplify time_allocations: drop the company field and track
-- time as a % of your time instead of exact hours.
-- Run this in the Supabase SQL editor (only needed if you already
-- ran supabase/add-time-tracking-and-overrides.sql before this change).
-- ============================================================

ALTER TABLE time_allocations DROP COLUMN IF EXISTS company_name;

ALTER TABLE time_allocations DROP CONSTRAINT IF EXISTS time_allocations_hours_check;
ALTER TABLE time_allocations RENAME COLUMN hours TO percentage;
ALTER TABLE time_allocations ALTER COLUMN percentage SET DEFAULT 0;
ALTER TABLE time_allocations ADD CONSTRAINT time_allocations_percentage_check
  CHECK (percentage >= 0 AND percentage <= 100);
