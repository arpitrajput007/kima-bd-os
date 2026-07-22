-- ============================================================
-- Lead assignment — hand specific leads to a team member (e.g. an
-- outreach assistant) for reachout + follow-up, without a separate
-- leads table. Run this once in the Supabase SQL Editor.
-- ============================================================

alter table leads add column if not exists assigned_to text;

-- Fast lookups for "my assigned leads" views.
create index if not exists leads_assigned_to_idx on leads (assigned_to) where assigned_to is not null;
