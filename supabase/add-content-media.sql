-- ============================================================
-- Content Studio: generated media gallery
-- Auto-saved whenever a graphic is generated. Images stored
-- in Supabase Storage bucket 'content-media' (public).
-- ============================================================

create table if not exists content_media (
  id               uuid primary key default gen_random_uuid(),
  storage_path     text not null,
  public_url       text not null,
  visual_prompt    text,
  incident_summary text,
  hook             text,
  post_type        text,
  content_id       text,
  size             text,
  created_at       timestamptz default now()
);

create index if not exists content_media_created_at_idx on content_media (created_at desc);

alter table content_media enable row level security;
create policy "anon_full_access_content_media"
  on content_media for all to anon, authenticated
  using (true) with check (true);

-- NOTE: also create a public Storage bucket called 'content-media'
-- in your Supabase dashboard under Storage → New bucket → name: content-media → Public: on
