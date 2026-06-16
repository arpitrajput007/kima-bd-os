-- ============================================================
-- Enable RLS on lead_research_cache and add access policy
--
-- The table was originally created with RLS disabled
-- (add-research-cache.sql). Supabase now flags this as a
-- critical security issue. This migration enables RLS and
-- grants the same anon + authenticated access as every other
-- table in this project (see fix-rls-no-auth.sql).
--
-- The backend uses the service_role key which bypasses RLS
-- entirely, so server-side cache reads/writes are unaffected.
-- The anon policy covers any client-side lookups.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- Enable RLS (this is the missing piece flagged by Supabase)
ALTER TABLE lead_research_cache ENABLE ROW LEVEL SECURITY;

-- Drop if a prior attempt left a partial policy
DROP POLICY IF EXISTS "anon_full_access_research_cache" ON lead_research_cache;

-- Allow anon + authenticated (matches pattern in fix-rls-no-auth.sql)
CREATE POLICY "anon_full_access_research_cache"
  ON lead_research_cache
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
