-- ============================================================
-- CRM: per-lead activity log + follow-up scheduling
-- Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('note','call','email','meeting','follow_up','status_change')),
  content text not null default '',
  scheduled_at timestamptz,          -- for type='follow_up': when to follow up
  completed_at timestamptz,          -- null = pending/open
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on lead_activities (lead_id, created_at desc);
create index if not exists lead_activities_followup_idx on lead_activities (scheduled_at)
  where type = 'follow_up' and completed_at is null;

alter table lead_activities enable row level security;

drop policy if exists "anon_full_access_lead_activities" on lead_activities;
create policy "anon_full_access_lead_activities" on lead_activities
  for all to anon, authenticated using (true) with check (true);
