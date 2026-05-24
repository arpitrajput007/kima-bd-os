-- ============================================================
-- Run this in the Supabase SQL Editor to update RLS policies
-- for no-login access (anon key allowed to read/write)
-- ============================================================

-- Drop old authenticated-only policies if they exist
drop policy if exists "authenticated_full_access_leads" on leads;
drop policy if exists "authenticated_full_access_contacts" on contacts;
drop policy if exists "authenticated_full_access_outreach" on outreach_messages;
drop policy if exists "authenticated_full_access_sources" on sources;
drop policy if exists "authenticated_full_access_feedback" on feedback_memory;
drop policy if exists "authenticated_full_access_rules" on agent_rules;
drop policy if exists "authenticated_full_access_reports" on learning_reports;

-- Drop any existing anon policies if they already exist (re-runnable)
drop policy if exists "anon_full_access_leads" on leads;
drop policy if exists "anon_full_access_contacts" on contacts;
drop policy if exists "anon_full_access_outreach" on outreach_messages;
drop policy if exists "anon_full_access_sources" on sources;
drop policy if exists "anon_full_access_feedback" on feedback_memory;
drop policy if exists "anon_full_access_rules" on agent_rules;
drop policy if exists "anon_full_access_reports" on learning_reports;

-- Create new policies allowing anon access (no login required)
create policy "anon_full_access_leads" on leads for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_contacts" on contacts for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_outreach" on outreach_messages for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_sources" on sources for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_feedback" on feedback_memory for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_rules" on agent_rules for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_reports" on learning_reports for all to anon, authenticated using (true) with check (true);
