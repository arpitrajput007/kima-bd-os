-- ============================================================================
-- Per-product BD sections (2026-08-25)
-- ============================================================================
-- Each product (AERpolice, AER360, AERseal, AERKey, Agent) gets its own
-- Customers / Resources / Hunting-Approach trio in the sidebar instead of
-- being flattened into the generic "AI Agents" group. This migration adds:
--
--   1. sources.product_slug — ties a discovery source to one product so the
--      new Resources page can show/manage only that product's sources,
--      without disturbing the existing target_customer_category filtering
--      used by the older pipeline pages.
--   2. product_hunting_approach — one free-text row per product describing
--      the current strategy for finding its customers. Editable, paste-in.
--
-- Run this once in the Supabase SQL editor.

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS product_slug text
    CHECK (product_slug IN ('agent', 'aerpolice', 'aer360', 'aerseal', 'aerkey'));

CREATE INDEX IF NOT EXISTS idx_sources_product_slug ON sources(product_slug);

CREATE TABLE IF NOT EXISTS product_hunting_approach (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null unique
    check (product_slug in ('agent', 'aerpolice', 'aer360', 'aerseal', 'aerkey')),
  approach_text text,
  updated_at timestamptz not null default now()
);

-- RLS: this app has no auth, so every table keeps RLS enabled with an
-- allow-all policy rather than disabling it (see fix-rls-no-auth.sql).
alter table product_hunting_approach enable row level security;

drop policy if exists "anon_full_access_product_hunting_approach" on product_hunting_approach;
create policy "anon_full_access_product_hunting_approach" on product_hunting_approach
  for all to anon, authenticated using (true) with check (true);
