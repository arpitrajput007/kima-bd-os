-- ============================================================
-- Track WHEN a lead was assigned to Pluto (not just that it was),
-- so Pluto's Section can group leads into daily assignment batches.
-- Run this once in the Supabase SQL Editor.
-- ============================================================

alter table leads add column if not exists assigned_at timestamptz;
