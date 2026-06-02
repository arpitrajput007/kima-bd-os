-- ============================================================
-- Add 'reserved' to leads.status and new source types.
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Drop the old status check constraint and recreate with 'reserved' added.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new', 'researching', 'qualified', 'approved', 'rejected',
    'contacted', 'replied', 'meeting_booked', 'archived',
    'needs_more_research', 'reserved'
  ));

-- 2. Drop old source_type check and add Exa + Apollo types.
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_source_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_source_type_check
  CHECK (source_type IN (
    'website', 'google_search', 'twitter_profile', 'linkedin_company',
    'telegram_group', 'rss_feed', 'defillama_category', 'crunchbase_list',
    'ecosystem_directory', 'hackathon_directory', 'news_source', 'manual_list',
    'apollo_search', 'exa_search', 'exa_similar'
  ));
