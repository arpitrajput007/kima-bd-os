-- Add company-level social handles to leads.
-- Safe to run multiple times (IF NOT EXISTS).
alter table leads add column if not exists twitter_url text;
alter table leads add column if not exists telegram_url text;
alter table leads add column if not exists discord_url text;
