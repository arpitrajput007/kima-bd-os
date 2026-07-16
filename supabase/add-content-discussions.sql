-- ============================================================
-- Content Studio: discussion threads for the "Discuss Content" panel.
-- Each generated content session can have multiple separate chats,
-- each with its own custom title and message history that can be
-- reviewed later. Mirrors lead_discussions / lead_discussion_messages.
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- A conversation thread scoped to one generated content session.
create table if not exists content_discussions (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references content_sessions(id) on delete cascade,
  title      text not null default 'New conversation',
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The messages inside a thread.
create table if not exists content_discussion_messages (
  id            uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references content_discussions(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  created_at    timestamptz not null default now()
);

-- Fast lookups: list a session's threads newest-first, and a thread's messages oldest-first.
create index if not exists content_discussions_session_idx on content_discussions (session_id, updated_at desc);
create index if not exists content_discussion_messages_thread_idx on content_discussion_messages (discussion_id, created_at asc);

-- RLS: match the rest of the app (anon key, no login required).
alter table content_discussions enable row level security;
alter table content_discussion_messages enable row level security;

drop policy if exists "anon_full_access_content_discussions" on content_discussions;
drop policy if exists "anon_full_access_content_discussion_messages" on content_discussion_messages;

create policy "anon_full_access_content_discussions" on content_discussions
  for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_content_discussion_messages" on content_discussion_messages
  for all to anon, authenticated using (true) with check (true);
