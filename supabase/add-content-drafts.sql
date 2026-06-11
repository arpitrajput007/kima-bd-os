-- ============================================================
-- Content Studio: saved drafts
-- Stores tweets, LinkedIn posts and thread tweets that Arpit
-- likes and wants to post later.
-- ============================================================

create table if not exists content_drafts (
  id           uuid primary key default gen_random_uuid(),
  post_type    text not null check (post_type in ('tweet', 'linkedin', 'thread_tweet')),
  text         text not null,
  hook         text,                    -- first paragraph (for preview cards)
  incident_summary text,
  root_cause   text,
  kima_angle   text,
  status       text default 'saved' check (status in ('saved', 'posted')),
  notes        text,
  posted_at    timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists content_drafts_status_idx     on content_drafts (status);
create index if not exists content_drafts_post_type_idx  on content_drafts (post_type);
create index if not exists content_drafts_created_at_idx on content_drafts (created_at desc);

create trigger content_drafts_updated_at
  before update on content_drafts
  for each row execute procedure moddatetime(updated_at);

alter table content_drafts enable row level security;
create policy "anon_full_access_content_drafts"
  on content_drafts for all to anon, authenticated
  using (true) with check (true);
