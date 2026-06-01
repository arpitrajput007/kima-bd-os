-- Discovery job tracker: lets the UI show run status even after navigation.
create table if not exists discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running','done','failed')),
  sources_total int default 0,
  sources_done int default 0,
  leads_saved int default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table discovery_jobs enable row level security;
drop policy if exists "anon_full_access_discovery_jobs" on discovery_jobs;
create policy "anon_full_access_discovery_jobs" on discovery_jobs
  for all to anon, authenticated using (true) with check (true);
