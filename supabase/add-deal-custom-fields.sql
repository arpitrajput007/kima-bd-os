-- Adds storage for user-defined custom questions on deals.
-- Field definitions (label/type/visibility) live in the browser's
-- localStorage — only the per-deal answers need to live in the DB.
alter table monthly_deals add column if not exists custom_fields jsonb default '{}';
