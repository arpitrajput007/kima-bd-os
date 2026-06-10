-- Store AI-generated real use cases per lead (2-3 scenario cards).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS use_cases jsonb;
