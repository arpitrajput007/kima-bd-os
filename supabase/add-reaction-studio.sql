-- ============================================================
-- Reaction Content Studio
-- reaction_news_feed: ingested news items from Exa, DeFiLlama, RSS
-- reaction_drafts:    saved LinkedIn reaction posts with full extras
-- ============================================================

create table if not exists reaction_news_feed (
  id           uuid primary key default gen_random_uuid(),
  topic        text not null,
  title        text not null,
  url          text not null unique,
  source       text,
  summary      text,
  published_at timestamptz,
  used         boolean default false,
  created_at   timestamptz default now()
);

create index if not exists reaction_news_feed_published_idx on reaction_news_feed (published_at desc);
create index if not exists reaction_news_feed_topic_idx     on reaction_news_feed (topic);
create index if not exists reaction_news_feed_used_idx      on reaction_news_feed (used);

alter table reaction_news_feed enable row level security;
create policy "anon_full_access_reaction_news_feed"
  on reaction_news_feed for all to anon, authenticated
  using (true) with check (true);

create table if not exists reaction_drafts (
  id            uuid primary key default gen_random_uuid(),
  news_item_id  uuid references reaction_news_feed(id) on delete set null,
  news_title    text,
  news_url      text,
  news_topic    text,
  post_short    text not null,
  post_medium   text not null,
  post_long     text not null,
  hook          text,
  alt_hooks     jsonb  default '[]'::jsonb,
  titles        jsonb  default '[]'::jsonb,
  comment_ideas jsonb  default '[]'::jsonb,
  takeaway      text,
  hashtags      jsonb  default '[]'::jsonb,
  status        text   default 'saved' check (status in ('saved', 'posted')),
  posted_at     timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists reaction_drafts_created_idx on reaction_drafts (created_at desc);
create index if not exists reaction_drafts_status_idx  on reaction_drafts (status);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger reaction_drafts_updated_at
  before update on reaction_drafts
  for each row execute function set_updated_at();

alter table reaction_drafts enable row level security;
create policy "anon_full_access_reaction_drafts"
  on reaction_drafts for all to anon, authenticated
  using (true) with check (true);
