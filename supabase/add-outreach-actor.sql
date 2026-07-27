-- ============================================================
-- Tag each outreach message with who sent it (you / pluto / agent
-- for automated cron sends), so Reachout Storage shows which team
-- member reached out to which contact, via what channel.
-- Run this once in the Supabase SQL Editor.
-- ============================================================

alter table outreach_messages add column if not exists performed_by text;
