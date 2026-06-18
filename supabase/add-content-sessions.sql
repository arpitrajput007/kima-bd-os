-- ============================================================
-- Content Studio: generation sessions
-- Auto-saved on every "Generate Content" run so users can
-- revisit and restore any past generation without re-running.
-- ============================================================

create table if not exists content_sessions (
  id               uuid primary key default gen_random_uuid(),
  source_url       text,
  news_context     text,
  incident_summary text,
  root_cause       text,
  kima_angle       text,
  tweets           jsonb default '[]'::jsonb,
  thread           jsonb default '[]'::jsonb,
  linkedin         jsonb default '[]'::jsonb,
  created_at       timestamptz default now()
);

create index if not exists content_sessions_created_at_idx on content_sessions (created_at desc);

alter table content_sessions enable row level security;
create policy "anon_full_access_content_sessions"
  on content_sessions for all to anon, authenticated
  using (true) with check (true);
