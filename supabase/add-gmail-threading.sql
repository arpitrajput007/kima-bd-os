-- ============================================================
-- Gmail thread tracking — lets us detect replies automatically.
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- Gmail's internal thread id — used to check the thread for new messages.
alter table outreach_messages add column if not exists gmail_thread_id text;

-- Gmail's internal message id for the message we sent.
alter table outreach_messages add column if not exists gmail_message_id text;

-- The RFC822 Message-ID header we generated, needed for In-Reply-To/References
-- on the next follow-up so it threads correctly in the recipient's inbox too.
alter table outreach_messages add column if not exists gmail_message_id_header text;

create index if not exists outreach_messages_gmail_thread_idx on outreach_messages (gmail_thread_id)
  where gmail_thread_id is not null;
