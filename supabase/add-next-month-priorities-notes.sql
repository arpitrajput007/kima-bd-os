-- ============================================================
-- Freeform "Next Month Priorities" notes for the Monthly BD
-- Performance report. Run this in the Supabase SQL editor.
-- Requires supabase/add-time-tracking-and-overrides.sql to have
-- been run first (adds the monthly_report_overrides table).
-- ============================================================

ALTER TABLE monthly_report_overrides
  ADD COLUMN IF NOT EXISTS next_month_priorities_notes text;
