-- ============================================================================
-- AERSeal orphan sources — close the gap the first realignment missed
-- (2026-08-25, follow-up)
-- ============================================================================
-- realign-aerseal-sources-trigger-first.sql only touched sources that exist in
-- MONITORING_SURFACES (lib/aerseal-discovery.ts). Three AERSeal-tagged sources
-- were added directly to the DB on 2026-08-19 (see add-aerseal-discovery.sql's
-- "retag" step) and were never part of that constant, so the first pass never
-- saw them:
--
--   - 'OpenZeppelin Security Audits — Upgradeable Contract Findings'
--   - 'Code4rena Audit Contest Archive — Upgradeable/Privileged-Role Findings'
--   - 'Staking Rewards Protocol Directory — Protocols with Admin/Operator Keys'
--
-- The OpenZeppelin and Code4rena probes search for audit write-ups that NAME a
-- specific protocol and its centralization/admin-key finding — that is a
-- legitimate event ("An audit identifying centralized admin, upgrade or
-- ownership risk" is explicitly on the approved trigger list), just phrased as
-- a keyword search rather than an event sentence. Tightened, not replaced.
--
-- The Staking Rewards source is the real violation: it points exa_similar at
-- https://www.stakingrewards.com/protocols — a company DIRECTORY ranked by
-- TVL, the exact anti-pattern the trigger-first spec bans ("work backwards
-- from an observable event, never forward from a category"). It returns
-- protocols that exist, not protocols where anything just happened. Replaced
-- with an event probe for the moment staking/restaking protocols actually
-- create or touch admin/operator-key exposure: launch, chain expansion, or a
-- slashing/pause-authority change.
--
-- None of these three are wired into MONITORING_SURFACES / the dedicated
-- /api/ai/discover-aerseal pipeline — they only run through the general
-- pipeline (/api/ai/discover), which is why they were invisible to the first
-- realignment despite carrying the AERSeal category tag.

UPDATE sources SET
  source_url_or_query = 'site:blog.openzeppelin.com audit finds centralization risk single owner can upgrade without timelock protocol names contract',
  notes = 'AERSeal surface (trigger-first, tightened 2026-08-25). Searches for OpenZeppelin write-ups that NAME a specific protocol and finding — an audit flagging centralization risk is an approved event, not a keyword match.'
WHERE source_name = 'OpenZeppelin Security Audits — Upgradeable Contract Findings';

UPDATE sources SET
  source_url_or_query = 'site:code4rena.com finding centralization risk admin key single point of failure names protocol contract owner',
  notes = 'AERSeal surface (trigger-first, tightened 2026-08-25). Same event class as the OpenZeppelin surface — a published contest finding that names the protocol and the privileged role at issue.'
WHERE source_name = 'Code4rena Audit Contest Archive — Upgradeable/Privileged-Role Findings';

UPDATE sources SET
  source_type = 'exa_search',
  source_url_or_query = 'staking or restaking protocol launches on new chain adds slashing pause or operator-key authority admin role announcement',
  notes = 'AERSeal surface (trigger-first, replaced 2026-08-25). The prior probe pointed at stakingrewards.com/protocols via exa_similar — a company directory ranked by TVL, not an event. Replaced with the actual moment a staking/restaking protocol creates or changes admin/operator-key exposure: a launch, a chain expansion, or a slashing/pause-authority change.'
WHERE source_name = 'Staking Rewards Protocol Directory — Protocols with Admin/Operator Keys';
