-- ============================================================================
-- AERSeal recurring discovery — scheduling, run tracking, source expansion
-- ============================================================================
-- Builds on add-aerseal-discovery.sql (dossier columns + score/tier + the
-- first 14 event-surface sources) and realign-aerseal-*.sql (trigger-first
-- probe rewrite). That migration made discover-aerseal a real pipeline; this
-- one makes it a RECURRING one:
--   - per-source last-success tracking (separate from last-attempt), so a
--     failed scan gets retried on the next cycle instead of looking "fresh"
--   - a run ledger (aerseal_discovery_runs) so incremental / full / backfill
--     runs can't overlap and have an auditable history
--   - state for the hardcoded MONITORING_SURFACES (lib/aerseal-discovery.ts),
--     which live in code, not the sources table, but still need their own
--     last-success cursor
--   - the full Tier 1 / Tier 2 source list from the discovery spec, plus the
--     Tier 3 structural-verification registry (kept in the Source Manager for
--     visibility, but excluded from the scan loop — verification_only=true)
-- ============================================================================

-- ── Per-source scheduling & reliability columns ─────────────────────────────
-- last_run_at (existing) already means "last attempt, success or not". A cron
-- gating on that column would treat a source that errored 10 minutes ago as
-- "just scanned" and skip it for a full day — the opposite of what a
-- recurring, retrying scheduler needs. last_success_at is the real cursor.
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS last_success_at      timestamptz,
  ADD COLUMN IF NOT EXISTS scan_interval_hours  integer,
  ADD COLUMN IF NOT EXISTS verification_only    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error           text,
  ADD COLUMN IF NOT EXISTS parser_strategy      text NOT NULL DEFAULT 'ai_harvest';

COMMENT ON COLUMN sources.scan_interval_hours IS
  'Hour-granularity override for the AERSeal recurring scanner. NULL falls back to AERSEAL_INCREMENTAL_INTERVAL_HOURS. Auto-doubled (capped) by the orchestrator when a source is consistently low-yield — see lib/aerseal-orchestrator.ts.';
COMMENT ON COLUMN sources.verification_only IS
  'Tier 3 structural-verification sources (explorers, Safe, Sourcify, audit databases) are registered for visibility/editing but are never scanned proactively — the spec says to use them only AFTER a dated trigger produces a candidate, which discover-aerseal already does during the profiling stage (readUrl/Firecrawl of the org''s own site + docs).';
COMMENT ON COLUMN sources.parser_strategy IS
  'Documents HOW harvest() will read this source (see app/api/ai/discover-aerseal/route.ts): ai_harvest (default — Jina Reader / Firecrawl / Exa dispatch by probe shape, same as every other source in this table).';

-- ── Run ledger — prevents concurrent/duplicate runs, gives an audit trail ───
CREATE TABLE IF NOT EXISTS aerseal_discovery_runs (
  id                 uuid primary key default gen_random_uuid(),
  run_type           text not null check (run_type in ('backfill','incremental','full','manual')),
  status             text not null default 'running' check (status in ('running','completed','failed')),
  triggered_by       text,                 -- 'cron' | 'user'
  lookback_days      numeric,
  sources_scanned    int default 0,
  sources_skipped    int default 0,        -- not due yet this cycle
  sources_failed     int default 0,
  leads_created      int default 0,
  candidates_found   int default 0,
  tier1_count        int default 0,
  tier2_count        int default 0,
  tier3_count        int default 0,
  errors             jsonb default '[]'::jsonb,
  started_at         timestamptz not null default now(),
  finished_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_aerseal_runs_status ON aerseal_discovery_runs (status);
CREATE INDEX IF NOT EXISTS idx_aerseal_runs_type_started ON aerseal_discovery_runs (run_type, started_at DESC);

ALTER TABLE aerseal_discovery_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access_aerseal_discovery_runs" ON aerseal_discovery_runs;
CREATE POLICY "anon_full_access_aerseal_discovery_runs" ON aerseal_discovery_runs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── State for the hardcoded MONITORING_SURFACES ─────────────────────────────
-- MONITORING_SURFACES (lib/aerseal-discovery.ts) are event-surface probes
-- defined in code, not rows in `sources` — they were designed once, reviewed,
-- and shouldn't drift via ad-hoc DB edits the way user-added sources can. But
-- the recurring scheduler still needs a per-surface last-success cursor and
-- yield counters, so this is a thin "shadow row" keyed by surface_key rather
-- than a duplicate of the probe/config itself (single source of truth stays
-- in code; only scheduling STATE lives here).
CREATE TABLE IF NOT EXISTS aerseal_surface_state (
  surface_key           text primary key,
  last_run_at           timestamptz,
  last_success_at       timestamptz,
  consecutive_failures  int default 0,
  total_runs            int default 0,
  companies_evaluated   int default 0,
  leads_generated       int default 0,
  scan_interval_hours   int,
  last_error            text,
  updated_at            timestamptz default now()
);

ALTER TABLE aerseal_surface_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access_aerseal_surface_state" ON aerseal_surface_state;
CREATE POLICY "anon_full_access_aerseal_surface_state" ON aerseal_surface_state
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- Source registry expansion — Tier 1 (governance/audit/GitHub) + Tier 2
-- (security) event surfaces, scanned by the recurring orchestrator.
-- ============================================================================
-- Same idempotency pattern as add-aerseal-discovery.sql: sources.source_name
-- has no unique index, so ON CONFLICT DO NOTHING would never fire — WHERE NOT
-- EXISTS is what makes re-running this file safe. product_slug='aerseal' is
-- what makes these show up as `db:<id>` surfaces in discover-aerseal's GET
-- handler AND makes them scannable by the orchestrator
-- (lib/aerseal-orchestrator.ts filters product_slug='aerseal' AND
-- verification_only=false AND status='active').

INSERT INTO sources (
  source_name, source_type, source_url_or_query, target_customer_category,
  target_industry_category, product_slug, frequency, quality_rating, status,
  scan_interval_hours, verification_only, parser_strategy, notes
)
SELECT
  v.source_name, v.source_type, v.source_url_or_query,
  'AERseal Contract-Authority Customer',
  'DeFi protocol / DAO / token issuer with a deployed contract',
  'aerseal', v.frequency, 'unrated', 'active',
  v.scan_interval_hours, false, 'ai_harvest', v.notes
FROM (VALUES
  -- Tier 1 — governance & proposals (dated proposals that move ownership,
  -- upgrade, mint, or timelock authority are the single densest trigger
  -- source AERSeal has — scan every 6h).
  ('Aave Governance Forum',        'website', 'https://governance.aave.com/',       'daily', 6,  'Tier 1 governance surface.'),
  ('Uniswap Governance Forum',     'website', 'https://gov.uniswap.org/',           'daily', 6,  'Tier 1 governance surface.'),
  ('Optimism Governance Forum',    'website', 'https://gov.optimism.io/',           'daily', 6,  'Tier 1 governance surface.'),
  ('Arbitrum DAO Forum',           'website', 'https://forum.arbitrum.foundation/', 'daily', 6,  'Tier 1 governance surface.'),
  ('ENS Governance Forum',         'website', 'https://discuss.ens.domains/',       'daily', 6,  'Tier 1 governance surface.'),
  ('Compound Governance (comp.xyz)','website','https://www.comp.xyz/',              'daily', 6,  'Tier 1 governance surface.'),
  ('Tally.xyz Governance',         'website', 'https://www.tally.xyz/',             'daily', 6,  'Tier 1 on-chain governance aggregator — proposal text often states the exact role/threshold being changed.'),
  ('Snapshot.box Proposals',       'website', 'https://snapshot.box/',              'daily', 6,  'Tier 1 governance surface — off-chain signalling that frequently precedes an on-chain execution.'),
  -- Tier 1 — rollup risk & permissions (slower-moving reference pages, not a
  -- dated-event feed — 24h is enough).
  ('L2Beat Layer2s Summary',       'website', 'https://l2beat.com/layer2s/summary', 'daily', 24, 'Tier 1 structural surface — who can upgrade, per rollup.'),
  ('L2Beat Layer2s Risk',          'website', 'https://l2beat.com/layer2s/risk',    'daily', 24, 'Tier 1 structural surface — Security Council / upgrade-key risk, per rollup.'),
  -- Tier 1 — audit competitions & new projects (a live contest or a fresh
  -- report both mean a team is actively touching contracts and control
  -- structure right now).
  ('Code4rena Audits',             'website', 'https://code4rena.com/audits',       'daily', 6,  'Tier 1 audit-competition surface — live contests name the org and the contracts in scope.'),
  ('Code4rena Reports',            'website', 'https://code4rena.com/reports',      'daily', 6,  'Tier 1 audit-report surface — findings frequently name centralisation/admin-key risk directly.'),
  ('Sherlock Audit Contests',      'website', 'https://audits.sherlock.xyz/contests','daily', 6, 'Tier 1 audit-competition surface.'),
  ('Cantina Audit Competitions',   'website', 'https://cantina.xyz/opportunities/competitions', 'daily', 6, 'Tier 1 audit-competition surface.'),
  -- Tier 1 — GitHub discovery (rate-limit-friendly interval — GitHub's
  -- unauthenticated search API is the tightest budget of any surface here).
  ('GitHub Topics: Solidity (updated)', 'website', 'https://github.com/topics/solidity?o=desc&s=updated', 'daily', 12, 'Tier 1 code-discovery surface — recently-active Solidity repos.'),
  ('GitHub Search: ProxyAdmin',    'website', 'https://github.com/search?q=ProxyAdmin+language%3ASolidity&type=code', 'daily', 12, 'Tier 1 code-discovery surface — direct grep for the exact privileged-role symbol.'),
  ('GitHub Search: UPGRADER_ROLE', 'website', 'https://github.com/search?q=UPGRADER_ROLE+language%3ASolidity&type=code', 'daily', 12, 'Tier 1 code-discovery surface — direct grep for the exact privileged-role symbol.'),
  -- Tier 2 — security & exploit sources. Dated triggers with the highest pain/
  -- consequence weight (see AERSEAL_TRIGGERS in lib/aerseal-discovery.ts), so
  -- most of these scan every 6h; a couple of reference/statistics pages that
  -- update slower are set to 12/24h.
  ('Rekt News',                    'website', 'https://rekt.news/',                          'daily', 6,  'Tier 2 incident surface. Consultative outreach only for incident victims — see FAIR_CHARACTERISATION_RULES.'),
  ('DefiLlama Hacks',              'website', 'https://defillama.com/hacks',                  'daily', 6,  'Tier 2 incident surface.'),
  ('SlowMist Hacked',              'website', 'https://hacked.slowmist.io/',                  'daily', 6,  'Tier 2 incident surface.'),
  ('SlowMist Hacked Statistics',   'website', 'https://hacked.slowmist.io/statistics/?c=all&d=all', 'daily', 24, 'Tier 2 incident surface — aggregate statistics page, slower-moving.'),
  ('BlockSec Blog',                'website', 'https://blocksec.com/blog',                    'daily', 6,  'Tier 2 incident/research surface.'),
  ('BlockSec Research',            'website', 'https://blocksec.com/research',                'daily', 12, 'Tier 2 research surface.'),
  ('Security Alliance',            'website', 'https://securityalliance.org/',                'daily', 12, 'Tier 2 responder-network surface.'),
  ('SEAL 911',                     'website', 'https://securityalliance.org/our-work/seal-911', 'daily', 6, 'Tier 2 incident-response surface — active 911 cases are live administrative-authority emergencies.'),
  ('SEAL 911 GitHub',              'website', 'https://github.com/security-alliance/seal-911', 'daily', 12, 'Tier 2 incident-response surface (source repo).'),
  ('Forta Network',                'website', 'https://forta.org/',                           'daily', 12, 'Tier 2 monitoring-network surface.'),
  ('Forta Subscribing Docs',       'website', 'https://docs.forta.network/en/latest/subscribing/', 'daily', 24, 'Tier 2 reference — slower-moving docs page.'),
  ('Immunefi Bug Bounties',        'website', 'https://immunefi.com/bug-bounty/',              'daily', 6,  'Tier 2 bounty-listing surface — scope pages name contracts and privileged roles directly.'),
  ('Immunefi Reports',             'website', 'https://reports.immunefi.com/',                 'daily', 6,  'Tier 2 disclosed-report surface.')
) AS v(source_name, source_type, source_url_or_query, frequency, scan_interval_hours, notes)
WHERE NOT EXISTS (SELECT 1 FROM sources s WHERE s.source_name = v.source_name);

-- ============================================================================
-- Tier 3 — structural verification registry (NOT scanned proactively).
-- ============================================================================
-- The spec is explicit: "Use these only after a dated trigger produces a
-- candidate." That's the profiling stage discover-aerseal already runs
-- (readUrl/Firecrawl of the qualifying org's own docs/security/governance
-- pages). These rows exist so the registry is complete and editable in the
-- Source Manager, but verification_only=true excludes them from the
-- orchestrator's scan loop — proactively crawling every explorer/audit
-- database on a schedule would burn the run budget on pages with no
-- organisation-specific trigger to extract.
INSERT INTO sources (
  source_name, source_type, source_url_or_query, target_customer_category,
  target_industry_category, product_slug, frequency, quality_rating, status,
  scan_interval_hours, verification_only, parser_strategy, notes
)
SELECT
  v.source_name, 'website', v.source_url_or_query,
  'AERseal Contract-Authority Customer',
  'DeFi protocol / DAO / token issuer with a deployed contract',
  'aerseal', 'manual', 'unrated', 'active',
  NULL, true, 'reference_only', v.notes
FROM (VALUES
  -- Explorers
  ('Etherscan',                          'https://etherscan.io/',                                            'Tier 3 explorer — verified contract source, owner/role reads.'),
  ('Etherscan Verified Contracts',       'https://etherscan.io/contractsverified',                           'Tier 3 explorer.'),
  ('Etherscan Search Contract',          'https://etherscan.io/searchcontract',                              'Tier 3 explorer.'),
  ('Arbiscan',                           'https://arbiscan.io/',                                             'Tier 3 explorer.'),
  ('Basescan',                           'https://basescan.org/',                                            'Tier 3 explorer.'),
  ('Optimistic Etherscan',               'https://optimistic.etherscan.io/',                                 'Tier 3 explorer.'),
  ('Polygonscan',                        'https://polygonscan.com/',                                         'Tier 3 explorer.'),
  ('BscScan',                            'https://bscscan.com/',                                             'Tier 3 explorer.'),
  ('Snowtrace',                          'https://snowtrace.io/',                                            'Tier 3 explorer.'),
  ('Blockscout',                         'https://www.blockscout.com/',                                      'Tier 3 explorer (multi-chain, open-source).'),
  -- Safe verification
  ('Safe Global App',                    'https://app.safe.global/',                                         'Tier 3 — Safe signer/threshold verification.'),
  ('Safe Core API — Transaction Service Overview', 'https://docs.safe.global/core-api/transaction-service-overview', 'Tier 3 reference.'),
  ('Safe Core API — Transaction Service', 'https://docs.safe.global/core-api/api-safe-transaction-service',  'Tier 3 reference.'),
  ('Safe Transaction Service (GitHub)',  'https://github.com/safe-global/safe-transaction-service',          'Tier 3 reference (source repo).'),
  -- Verified source & official address registries
  ('Sourcify',                           'https://sourcify.dev/',                                            'Tier 3 — verified source + metadata, no API key required.'),
  ('Sourcify Repo',                      'https://repo.sourcify.dev/',                                       'Tier 3 — Sourcify verified-contract repository.'),
  ('Aave Address Book (GitHub)',         'https://github.com/aave-dao/aave-address-book',                    'Tier 3 official address registry.'),
  ('Safe Deployments (GitHub)',          'https://github.com/safe-global/safe-deployments',                  'Tier 3 official address registry.'),
  ('Uniswap V3 Deployments Docs',        'https://developers.uniswap.org/docs/protocols/v3/deployments',     'Tier 3 official address registry.'),
  -- Audit databases
  ('Solodit',                            'https://solodit.cyfrin.io/',                                       'Tier 3 audit-finding database.'),
  ('Sigp Public Audits (GitHub)',        'https://github.com/sigp/public-audits',                            'Tier 3 audit database.'),
  ('Spearbit Portfolio (GitHub)',        'https://github.com/spearbit/portfolio',                            'Tier 3 audit database.'),
  ('Trail of Bits Publications (GitHub)','https://github.com/trailofbits/publications',                      'Tier 3 audit database.')
) AS v(source_name, source_url_or_query, notes)
WHERE NOT EXISTS (SELECT 1 FROM sources s WHERE s.source_name = v.source_name);

-- ── Rejected-candidate memory ────────────────────────────────────────────
-- Without this, a candidate that fails the gate or hits a rejection rule
-- (see evaluateGate in lib/aerseal-discovery.ts) simply vanishes when the API
-- response is discarded — nothing records that we already looked at it. On a
-- recurring scanner that revisits the same event surfaces every 6 hours, that
-- means the same dead-end organisation gets re-harvested, re-extracted and
-- re-profiled (a full LLM dossier call) on every single cycle it keeps
-- appearing on a surface, forever. This table is the fix: a lightweight
-- memory of "we already qualified this and it didn't clear the gate," keyed
-- the same way lead dedup already works (name + domain — see toDomain in
-- lib/apollo.ts), with a cooldown rather than a permanent block so a
-- genuinely changed situation (new trigger, new evidence) gets reconsidered.
CREATE TABLE IF NOT EXISTS aerseal_rejected_candidates (
  id              uuid primary key default gen_random_uuid(),
  organization    text not null,
  domain          text,                 -- toDomain(website) — '' when no website was found
  reason          text not null,        -- REJECTION_REASONS key, or 'gate_failed' when score/tier missed a requirement without a hard rejection rule
  score           integer,
  tier            integer,
  gate_failures   jsonb default '[]'::jsonb,
  rejections      jsonb default '[]'::jsonb,
  surface_key     text,                 -- where it was last seen
  seen_count      integer not null default 1,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aerseal_rejected_org_domain
  ON aerseal_rejected_candidates (lower(organization), coalesce(domain, ''));
CREATE INDEX IF NOT EXISTS idx_aerseal_rejected_last_seen
  ON aerseal_rejected_candidates (last_seen_at DESC);

ALTER TABLE aerseal_rejected_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access_aerseal_rejected_candidates" ON aerseal_rejected_candidates;
CREATE POLICY "anon_full_access_aerseal_rejected_candidates" ON aerseal_rejected_candidates
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS on `sources` is already enabled with an allow-all policy from
-- fix-rls-no-auth.sql; the new columns above inherit it, no change needed.
