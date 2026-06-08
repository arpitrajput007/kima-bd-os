-- ============================================================
-- Add post-meeting pipeline stages to leads.status
-- New stages: proposal_sent, negotiating, integration, won, lost
-- Run in Supabase SQL Editor.
-- ============================================================

-- Drop the existing status constraint and recreate with all new stages added.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'new', 'researching', 'qualified', 'approved', 'rejected',
    'contacted', 'replied', 'meeting_booked', 'archived',
    'needs_more_research', 'reserved',
    -- Post-meeting lifecycle stages
    'proposal_sent', 'negotiating', 'integration', 'won', 'lost'
  ));
