-- ============================================================
-- Tag each activity with who did it (you vs. Pluto), based on which
-- login passcode was used. Run this once in the Supabase SQL Editor.
-- ============================================================

alter table lead_activities add column if not exists performed_by text;
