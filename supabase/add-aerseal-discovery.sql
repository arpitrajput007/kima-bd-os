-- ============================================================================
-- AERSeal customer-discovery system (2026-08-24)
-- ============================================================================
-- The dedicated AERSeal pipeline (/api/ai/discover-aerseal) produces a
-- structured authority dossier per prospect, not just a text fit paragraph.
-- The existing aerseal_fit column stays as the human-readable use case; these
-- columns carry the machine-checkable record behind it.
--
-- aerseal_score / aerseal_tier are code-computed (lib/aerseal-discovery.ts
-- scoreProspect) from the dossier's structured fields — deliberately NOT a
-- number the model self-reported, same discipline as confidence_score.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS aerseal_dossier         jsonb,
  ADD COLUMN IF NOT EXISTS aerseal_score           integer,
  ADD COLUMN IF NOT EXISTS aerseal_tier            integer,
  ADD COLUMN IF NOT EXISTS aerseal_score_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS aerseal_hypothesis      jsonb;

-- Tier 1 (82+) first, then by score. This is the ordering the AERSeal desk
-- reads every morning, so it gets its own index rather than a sort-on-read.
CREATE INDEX IF NOT EXISTS idx_leads_aerseal_score
  ON leads (aerseal_score DESC NULLS LAST)
  WHERE aerseal_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_aerseal_tier
  ON leads (aerseal_tier)
  WHERE aerseal_tier IS NOT NULL;

-- ── Monitoring surfaces as discovery sources ────────────────────────────────
-- These mirror MONITORING_SURFACES in lib/aerseal-discovery.ts so the AERSeal
-- surfaces show up in the existing Source Manager too. They are EVENT surfaces
-- (governance changes, audit findings, risk pages, postmortems), not company
-- directories — that distinction is the whole point of the system.
--
-- All tagged 'AERseal Contract-Authority Customer' so the generic pipeline's
-- category cap accounts for them correctly. Previously every AERseal-shaped
-- source sat with a NULL target_customer_category and never counted.
-- source_type must satisfy sources_source_type_check — 'url' is NOT an accepted
-- value (verified against the live table), so URL surfaces use 'website' and
-- query surfaces use 'exa_search'.
--
-- sources.source_name has no unique index, so ON CONFLICT DO NOTHING would
-- never fire and re-running this file would duplicate every row. WHERE NOT
-- EXISTS is what actually makes this idempotent.

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'L2Beat Risk Pages — Upgradeability & Security Council', 'website', 'https://l2beat.com/scaling/risk',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. L2Beat documents, per chain, who can upgrade and who sits on the Security Council — the densest public record of EVM admin authority anywhere.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'L2Beat Risk Pages — Upgradeability & Security Council');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Tally — Governance Role & Timelock Changes', 'exa_search', 'Tally governance proposal upgrade admin role timelock signer change protocol',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. On-chain governance proposals that move or re-scope a privileged role are dated, cited, authority-specific triggers.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Tally — Governance Role & Timelock Changes');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Snapshot — Signer, Guardian & Treasury Proposals', 'exa_search', 'Snapshot proposal multisig signer rotation guardian treasury custody protocol',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. Signer rotations and guardian changes are the clearest ''authority is in play right now'' signal a DAO emits.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Snapshot — Signer, Guardian & Treasury Proposals');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Audit Reports — Centralisation & Privileged-Role Findings', 'exa_search', 'smart contract audit report centralization risk admin key single EOA upgrade privileged role finding',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. An auditor naming a centralisation risk is a third-party-verified admin-authority problem the team already knows about.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Audit Reports — Centralisation & Privileged-Role Findings');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Stablecoin Issuers — Mint, Freeze & Blocklist Authority', 'exa_search', 'stablecoin issuer mint authority freeze blocklist contract admin upgrade attestation',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. Every stablecoin issuer holds mint and freeze authority by construction — the question is only who holds it and under what policy.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Stablecoin Issuers — Mint, Freeze & Blocklist Authority');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'RWA & Tokenization — Issuance and Transfer-Agent Control', 'exa_search', 'tokenization platform RWA issuance smart contract admin transfer agent upgradeable permissioned token',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. Permissioned RWA tokens carry transfer-agent and issuance roles, usually with a regulator watching who holds them.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'RWA & Tokenization — Issuance and Transfer-Agent Control');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'New EVM Mainnets, L2s & Contract Deployments', 'exa_search', 'new EVM mainnet L2 launch contracts deployed proxy admin multisig upgrade key announcement',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. Launch is the one moment authority structure is genuinely still open — before it is set, not after.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'New EVM Mainnets, L2s & Contract Deployments');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Security Postmortems — Key & Administrative Compromise', 'exa_search', 'postmortem incident report private key compromise admin key exploit privileged function protocol',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'daily', 'unrated', 'active',
       'AERSeal surface. Consultative outreach only — see FAIR_CHARACTERISATION_RULES in lib/aerseal-discovery.ts. Never fear-based framing for incident victims.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Security Postmortems — Key & Administrative Compromise');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Governance Forums — Signer, Council & Upgrade Debates', 'exa_search', 'governance forum proposal discussion admin key upgrade multisig security council timelock protocol',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. A forum thread debating admin-key structure is a team telling you, in public, that they are unhappy with it.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Governance Forums — Signer, Council & Upgrade Debates');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Founder Departures & Key-Holder Transitions', 'exa_search', 'protocol founder steps down departure handover multisig signer key holder governance transition',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. When a named key holder leaves, every role they held has to move somewhere — a forced, dated authority decision.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Founder Departures & Key-Holder Transitions');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'GitHub Releases — Access Control & Deploy Changes', 'exa_search', 'github release smart contract deployment access control owner upgrade proxy admin migration',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. Release notes touching Ownable/AccessControl/proxy admin are first-party evidence of an authority change in flight.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'GitHub Releases — Access Control & Deploy Changes');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Regulator & Supervisory Announcements', 'exa_search', 'regulator approval licence stablecoin tokenization custody issuer requirement supervisory announcement',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. A licence condition is the strongest possible forcing function on how contract authority must be held.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Regulator & Supervisory Announcements');

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT 'Safe Ecosystem — Established Multisig Operators', 'exa_search', 'Safe wallet case study protocol treasury multisig signers manage contract admin',
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active',
       'AERSeal surface. Established Safe users are a real segment, but score with HIGH incumbent lock-in by design — Safe is not treated as inadequate, it is treated as a harder sale.'
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE source_name = 'Safe Ecosystem — Established Multisig Operators');

-- ── Retag the three AERSeal-shaped sources that were left uncategorised ─────
-- These were added 2026-08-19 with a NULL target_customer_category, so they
-- never counted toward the AERseal cap and never showed as AERseal surfaces.
UPDATE sources
   SET target_customer_category = 'AERseal Contract-Authority Customer'
 WHERE target_customer_category IS NULL
   AND source_name IN (
     'OpenZeppelin Security Audits — Upgradeable Contract Findings',
     'Code4rena Audit Contest Archive — Upgradeable/Privileged-Role Findings',
     'Staking Rewards Protocol Directory — Protocols with Admin/Operator Keys'
   );

-- RLS: this app has no auth, so every table keeps RLS enabled with an
-- allow-all policy rather than disabling it (see fix-rls-no-auth.sql).
-- No new tables here, so the existing leads/sources policies already apply.
