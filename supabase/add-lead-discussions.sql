-- ============================================================
-- Per-lead discussion threads for the "Discuss Lead" panel.
-- Each lead can have multiple separate conversations, each with
-- its own message history that can be reviewed later.
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- A conversation thread scoped to one lead.
create table if not exists lead_discussions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  title text not null default 'New conversation',
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The messages inside a thread.
create table if not exists lead_discussion_messages (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references lead_discussions(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Fast lookups: list a lead's threads newest-first, and a thread's messages oldest-first.
create index if not exists lead_discussions_lead_idx on lead_discussions (lead_id, updated_at desc);
create index if not exists lead_discussion_messages_thread_idx on lead_discussion_messages (discussion_id, created_at asc);

-- RLS: match the rest of the app (anon key, no login required).
alter table lead_discussions enable row level security;
alter table lead_discussion_messages enable row level security;

drop policy if exists "anon_full_access_lead_discussions" on lead_discussions;
drop policy if exists "anon_full_access_lead_discussion_messages" on lead_discussion_messages;

create policy "anon_full_access_lead_discussions" on lead_discussions
  for all to anon, authenticated using (true) with check (true);
create policy "anon_full_access_lead_discussion_messages" on lead_discussion_messages
  for all to anon, authenticated using (true) with check (true);
