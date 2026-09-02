-- ============================================================================
-- Aerpolice recurring discovery — dossier columns, run ledger, rejected-
-- candidate memory, source registry
-- ============================================================================
-- Manual trigger only. This pipeline is intentionally NOT wired to any Vercel
-- cron (see vercel.json) — every run starts with the "Run Aerpolice
-- Discovery" button (app/api/aerpolice/run-discovery/route.ts ->
-- lib/aerpolice-orchestrator.ts). Do not add a cron entry for this without
-- asking first — a 6-hourly AERSeal cron once broke every deployment on the
-- Vercel Hobby plan for ~5 hours (see project memory, 2026-09-02).
-- ============================================================================

-- ── Dossier columns on leads, same discipline as AERSeal's aerseal_* set —
-- code-computed score/tier, never self-reported by the model.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS aerpolice_score            integer,
  ADD COLUMN IF NOT EXISTS aerpolice_tier              integer,
  ADD COLUMN IF NOT EXISTS aerpolice_dossier            jsonb,
  ADD COLUMN IF NOT EXISTS aerpolice_score_breakdown    jsonb,
  ADD COLUMN IF NOT EXISTS aerpolice_next_action        text,
  ADD COLUMN IF NOT EXISTS aerpolice_outreach_seed       jsonb;

COMMENT ON COLUMN leads.aerpolice_next_action IS
  'One of Contact now | Validate then send | Monitor — computed by evaluateGate() in lib/aerpolice-discovery.ts. A lead can be saved with no dated trigger (Monitor) per the spec: "No action evidence: reject. No dated trigger: monitor, but do not send."';

-- ── Run ledger — prevents concurrent runs, gives an audit trail. run_type is
-- always 'manual' today (no cron), but kept as a check constraint rather than
-- a fixed literal so a future deliberate scheduling decision doesn't require
-- a migration to unblock it.
CREATE TABLE IF NOT EXISTS aerpolice_discovery_runs (
  id                        uuid primary key default gen_random_uuid(),
  run_type                  text not null default 'manual' check (run_type in ('manual','full')),
  status                    text not null default 'running' check (status in ('running','completed','failed')),
  triggered_by              text,
  sources_scanned           int default 0,
  sources_skipped           int default 0,
  sources_failed            int default 0,
  leads_created             int default 0,
  candidates_found          int default 0,
  tier1_count               int default 0,
  tier2_count               int default 0,
  tier3_count               int default 0,
  contact_now_count         int default 0,
  validate_then_send_count  int default 0,
  monitor_count             int default 0,
  errors                    jsonb default '[]'::jsonb,
  started_at                timestamptz not null default now(),
  finished_at               timestamptz
);

CREATE INDEX IF NOT EXISTS idx_aerpolice_runs_status ON aerpolice_discovery_runs (status);
CREATE INDEX IF NOT EXISTS idx_aerpolice_runs_started ON aerpolice_discovery_runs (started_at DESC);

ALTER TABLE aerpolice_discovery_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access_aerpolice_discovery_runs" ON aerpolice_discovery_runs;
CREATE POLICY "anon_full_access_aerpolice_discovery_runs" ON aerpolice_discovery_runs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Rejected-candidate memory — same shape as aerseal_rejected_candidates.
-- Without this, a candidate that fails the qualification gate vanishes when
-- the response is discarded, and the same dead-end company gets re-harvested
-- and re-profiled (a full LLM dossier call) every time it reappears on a
-- recurring source. Cooldown, not a permanent block, so a genuinely changed
-- situation (new trigger, new evidence) gets reconsidered.
CREATE TABLE IF NOT EXISTS aerpolice_rejected_candidates (
  id              uuid primary key default gen_random_uuid(),
  organization    text not null,
  domain          text,
  reason          text not null,
  score           integer,
  tier            integer,
  gate_failures   jsonb default '[]'::jsonb,
  rejections      jsonb default '[]'::jsonb,
  source_id       uuid references sources(id) on delete set null,
  seen_count      integer not null default 1,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aerpolice_rejected_org_domain
  ON aerpolice_rejected_candidates (lower(organization), coalesce(domain, ''));
CREATE INDEX IF NOT EXISTS idx_aerpolice_rejected_last_seen
  ON aerpolice_rejected_candidates (last_seen_at DESC);

ALTER TABLE aerpolice_rejected_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access_aerpolice_rejected_candidates" ON aerpolice_rejected_candidates;
CREATE POLICY "anon_full_access_aerpolice_rejected_candidates" ON aerpolice_rejected_candidates
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- Source registry — daily + weekly monitoring sources from the discovery
-- spec. sources.scan_interval_hours/last_success_at/consecutive_failures/
-- last_error already exist on the table (added generically by
-- add-aerseal-recurring-discovery.sql) and are reused as-is; companies_
-- evaluated/leads_generated/total_runs likewise. WHERE NOT EXISTS keeps this
-- file idempotent since source_name has no unique index.
-- ============================================================================
INSERT INTO sources (
  source_name, source_type, source_url_or_query, target_customer_category,
  target_industry_category, product_slug, frequency, quality_rating, status, notes
)
SELECT
  v.source_name, 'website', v.source_url_or_query,
  'Aerpolice Governance Customer',
  'AI agent company with a verified external action',
  'aerpolice', v.frequency, 'unrated', 'active', v.notes
FROM (VALUES
  -- Daily — scanned for material published/updated in the previous 7 days.
  ('Official MCP Registry',        'https://registry.modelcontextprotocol.io/',                  'daily', 'Daily — new/updated write-capable MCP servers.'),
  ('MCP Registry (GitHub)',        'https://github.com/modelcontextprotocol/registry',           'daily', 'Daily — registry source repo, release/PR activity.'),
  ('GitHub Topics: MCP',           'https://github.com/topics/model-context-protocol',           'daily', 'Daily — recently-active MCP projects.'),
  ('Show HN',                      'https://news.ycombinator.com/show',                          'daily', 'Daily — founder-posted launches, often action-taking agents.'),
  ('Product Hunt: AI Agents',      'https://www.producthunt.com/topics/ai-agents',                'daily', 'Daily — new agent product launches.'),
  -- Weekly — scanned for material published/updated in the previous 30 days.
  ('Atlassian Marketplace',        'https://marketplace.atlassian.com/',                          'weekly', 'Weekly — ITSM/DevOps agent apps with write access.'),
  ('Zendesk Marketplace',          'https://www.zendesk.com/marketplace/',                        'weekly', 'Weekly — support-resolution agent apps (refunds, account changes).'),
  ('Shopify App Store',            'https://apps.shopify.com/',                                   'weekly', 'Weekly — commerce agent apps (orders, refunds, inventory).'),
  ('Y Combinator Companies',       'https://www.ycombinator.com/companies',                        'weekly', 'Weekly — founder-led startups, priority customer profile.'),
  ('CRN Security News',            'https://www.crn.com/news/security',                            'weekly', 'Weekly — security-agent product coverage.'),
  ('Crunchbase',                   'https://www.crunchbase.com/',                                  'weekly', 'Weekly — funding tied to agent-product expansion.'),
  ('TechCrunch AI',                'https://techcrunch.com/category/artificial-intelligence/',     'weekly', 'Weekly — agent launches, GA announcements, funding.'),
  ('Business Wire Technology',     'https://www.businesswire.com/portal/site/home/news/industries/technology/', 'weekly', 'Weekly — enterprise deployment / launch press releases.'),
  ('GlobeNewswire Technology',     'https://www.globenewswire.com/Industry/Technology',            'weekly', 'Weekly — enterprise deployment / launch press releases.'),
  ('Mastercard Newsroom',          'https://www.mastercard.com/global/en/news-and-trends/press.html', 'weekly', 'Weekly — agentic-payments capability announcements.'),
  ('Visa Newsroom',                'https://usa.visa.com/about-visa/newsroom.html',                'weekly', 'Weekly — agentic-payments capability announcements.'),
  ('PayPal Newsroom',              'https://newsroom.paypal-corp.com/',                             'weekly', 'Weekly — agentic-payments capability announcements.'),
  ('FinTech Futures',              'https://www.fintechfutures.com/',                               'weekly', 'Weekly — finance/payment agent coverage.'),
  ('The Paypers',                  'https://thepaypers.com/',                                       'weekly', 'Weekly — payments-agent coverage.'),
  ('Finextra',                     'https://www.finextra.com/',                                     'weekly', 'Weekly — finance-agent coverage.'),
  ('Healthcare IT News',           'https://www.healthcareitnews.com/',                             'weekly', 'Weekly — healthcare-agent workflow coverage.'),
  ('Fierce Healthcare',            'https://www.fiercehealthcare.com/',                             'weekly', 'Weekly — healthcare-agent workflow coverage.'),
  ('MedCity News',                 'https://medcitynews.com/',                                      'weekly', 'Weekly — healthcare-agent workflow coverage.'),
  ('InsurTech Insights',           'https://www.insurtechinsights.com/',                            'weekly', 'Weekly — insurance-agent (claims/underwriting) coverage.'),
  ('Digital Insurance',            'https://www.dig-in.com/',                                       'weekly', 'Weekly — insurance-agent (claims/underwriting) coverage.')
) AS v(source_name, source_url_or_query, frequency, notes)
WHERE NOT EXISTS (SELECT 1 FROM sources s WHERE s.source_name = v.source_name);

-- RLS on `sources` and `leads` is already enabled with an allow-all policy
-- (fix-rls-no-auth.sql) — new columns above inherit it, no change needed.
