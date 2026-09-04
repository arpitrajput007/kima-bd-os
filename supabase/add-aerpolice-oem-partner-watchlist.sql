-- ============================================================================
-- OEM / Partner Watchlist — separate pipeline from the direct-customer leads
-- table, per the two-pipeline framework in lib/aerpolice-discovery.ts
-- (PIPELINE_SEPARATION_RULES, isOemOrPartnerCandidate).
-- ============================================================================
-- MCP vendors, agent framework builders, connector providers and tool
-- publishers are not customer leads even when their own agent clears the
-- qualification gate — app/api/ai/discover-aerpolice/route.ts routes anything
-- with recommended_motion in ('oem_integration','partnership'), or flagged
-- 'equivalent_offering', here instead of into `leads`. No outreach happens
-- from the direct-customer pipeline against rows in this table. They are
-- only worth re-checking when a WATCHLIST_REVISIT_TRIGGERS event happens
-- (named production deployment, their customers publicly asking for
-- governance, or a published case study of consequential autonomous ops) —
-- revisit_trigger_type/evidence/date are filled in by hand when that occurs.
-- Run this once in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS aerpolice_oem_partner_watchlist (
  id                  uuid primary key default gen_random_uuid(),
  organization        text not null,
  website             text,
  domain              text,
  entity_signal       text,   -- what they build (MCP server, agent framework, connector, etc.), from the dossier's agent_product field
  recommended_motion  text,   -- 'oem_integration' | 'partnership' at time of discovery
  motion_rationale    text,
  why_not_customer    text not null,
  dossier             jsonb,
  score               integer,
  status              text not null default 'watching' check (status in ('watching', 'reactivated', 'archived')),
  revisit_trigger_type text check (revisit_trigger_type in ('named_production_deployment', 'customers_asking_for_governance', 'case_study_consequential_ops')),
  revisit_evidence_url text,
  revisit_date        text,
  revisit_notes       text,
  source_id           uuid references sources(id) on delete set null,
  seen_count          integer not null default 1,
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aerpolice_watchlist_org_domain
  ON aerpolice_oem_partner_watchlist (lower(organization), coalesce(domain, ''));
CREATE INDEX IF NOT EXISTS idx_aerpolice_watchlist_status ON aerpolice_oem_partner_watchlist (status);
CREATE INDEX IF NOT EXISTS idx_aerpolice_watchlist_last_seen ON aerpolice_oem_partner_watchlist (last_seen_at DESC);

ALTER TABLE aerpolice_oem_partner_watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access_aerpolice_oem_partner_watchlist" ON aerpolice_oem_partner_watchlist;
CREATE POLICY "anon_full_access_aerpolice_oem_partner_watchlist" ON aerpolice_oem_partner_watchlist
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Run-ledger column for the watchlisted count, alongside the existing
-- tier/contact-now/monitor counters on aerpolice_discovery_runs.
ALTER TABLE aerpolice_discovery_runs
  ADD COLUMN IF NOT EXISTS watchlisted_count int default 0;
