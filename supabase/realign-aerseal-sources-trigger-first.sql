-- ============================================================================
-- AERSeal sources — realign to trigger-first probes (2026-08-25)
-- ============================================================================
-- The AERSeal surfaces seeded by add-aerseal-discovery.sql were written as
-- KEYWORD probes: "stablecoin issuer mint authority freeze blocklist contract
-- admin upgrade attestation", "Safe wallet case study protocol treasury
-- multisig signers manage contract admin". Those are product-vocabulary
-- searches. They return auditors, wallet vendors, custody providers, explainer
-- posts and conference write-ups — competitors and content publishers, not
-- organisations with a current buying need — and every one of them costs a full
-- research call to reject.
--
-- Trigger-first discovery works the other way round: search for the DOCUMENT
-- an event produces (a proposal, a launch post, an audit finding, a postmortem,
-- a licence notice), then work backwards to the organisation it names. So every
-- probe below is phrased the way a press release or governance proposal would
-- phrase it, not the way our product page would.
--
-- These mirror MONITORING_SURFACES in lib/aerseal-discovery.ts. Change one,
-- change the other.
--
-- IMPORTANT: add-aerseal-discovery.sql inserts with WHERE NOT EXISTS keyed on
-- source_name, so re-running it will NOT update an existing row's probe. That
-- is why this is an UPDATE file rather than an edit to the original seed.

-- ── Rewrite the probes that were keyword-shaped ─────────────────────────────

UPDATE sources SET source_url_or_query =
  'governance proposal passed to transfer contract ownership rotate upgrade admin role or change timelock delay'
WHERE source_name = 'Tally — Governance Role & Timelock Changes';

UPDATE sources SET source_url_or_query =
  'DAO proposal to rotate multisig signers change signing threshold or appoint new treasury guardian'
WHERE source_name = 'Snapshot — Signer, Guardian & Treasury Proposals';

UPDATE sources SET source_url_or_query =
  'audit report published flags centralization risk owner can upgrade without timelock admin key single EOA finding'
WHERE source_name = 'Audit Reports — Centralisation & Privileged-Role Findings';

UPDATE sources SET
  source_name = 'Stablecoin Launches, Licences & New-Chain Issuance',
  source_url_or_query = 'stablecoin goes live launches natively on new chain issuer receives licence approval begins minting',
  notes = 'AERSeal surface (trigger-first). A stablecoin launching, being licensed, or being issued on a new chain is the moment mint and freeze authority is created or re-created — before it is set, not after.'
WHERE source_name = 'Stablecoin Issuers — Mint, Freeze & Blocklist Authority';

UPDATE sources SET
  source_name = 'RWA & Tokenized Fund Issuance Events',
  source_url_or_query = 'tokenized fund launched treasury product issued onchain asset manager brings fund to blockchain first issuance',
  notes = 'AERSeal surface (trigger-first). An issuance event names the issuer, the transfer-agent role, and usually the regulator watching it.'
WHERE source_name = 'RWA & Tokenization — Issuance and Transfer-Agent Control';

UPDATE sources SET source_url_or_query =
  'protocol launches mainnet contracts now deployed live announcement L2 goes live to public'
WHERE source_name = 'New EVM Mainnets, L2s & Contract Deployments';

UPDATE sources SET source_url_or_query =
  'postmortem deployer private key compromised admin wallet drained attacker gained control of privileged function'
WHERE source_name = 'Security Postmortems — Key & Administrative Compromise';

UPDATE sources SET source_url_or_query =
  'forum discussion proposes moving upgrade key to timelock forming security council reducing admin powers protocol'
WHERE source_name = 'Governance Forums — Signer, Council & Upgrade Debates';

UPDATE sources SET source_url_or_query =
  'founder steps down core contributor leaves protocol hands over control governance transition key holder replaced'
WHERE source_name = 'Founder Departures & Key-Holder Transitions';

UPDATE sources SET source_url_or_query =
  'release notes contracts redeployed ownership transferred access control roles changed proxy admin migration'
WHERE source_name = 'GitHub Releases — Access Control & Deploy Changes';

UPDATE sources SET source_url_or_query =
  'regulator grants licence approves stablecoin issuer tokenization platform authorised supervisory requirement announced'
WHERE source_name = 'Regulator & Supervisory Announcements';

-- The Safe surface was a vendor customer-list search — a company directory, the
-- exact shape trigger-first discovery rejects. The buying moment is not "uses a
-- Safe"; it is "a Safe user has started operating its own contracts".
UPDATE sources SET
  source_name = 'Safe / Custody Users Expanding Into Contract Operations',
  source_url_or_query = 'company using Safe multisig or institutional custody now deploying its own smart contracts expanding onchain operations',
  notes = 'AERSeal surface (trigger-first). Replaces the old Safe customer-list probe, which was a directory search. Treasury custody and contract-authority custody are different problems; the event we want is an org crossing from one to the other.'
WHERE source_name = 'Safe Ecosystem — Established Multisig Operators';

-- ── New event surfaces with no prior source row ─────────────────────────────

INSERT INTO sources (source_name, source_type, source_url_or_query, target_customer_category, target_industry_category, frequency, quality_rating, status, notes)
SELECT v.name, 'exa_search', v.probe,
       'AERseal Contract-Authority Customer',
       'DeFi protocol / DAO / token issuer with a deployed contract',
       'weekly', 'unrated', 'active', v.notes
FROM (VALUES
  ('Testnet Live & Mainnet Launch Preparation',
   'protocol testnet now live incentivized testnet begins mainnet launch scheduled audit completed ahead of deployment',
   'AERSeal surface (trigger-first). Pre-launch is the only window where authority structure is genuinely still open — a deployer key created for testnet becomes a live mint or upgrade role on launch day.'),
  ('Protocols Expanding to an Additional EVM Chain',
   'protocol expands deploys contracts to additional EVM chain now live on Base Arbitrum multichain expansion announcement',
   'AERSeal surface (trigger-first). Every new chain is a fresh set of privileged roles, often deployed under time pressure with the same key as the first chain.'),
  ('New Bridge, Vault, Payment & Treasury Contracts Going Live',
   'launches new vault bridge payment contract onchain treasury goes live deployed contracts announcement',
   'AERSeal surface (trigger-first). A newly deployed contract holding funds has a named admin from day one, and the controller is usually still whoever ran the deploy.'),
  ('Unauthorized Mints & Malicious Contract Upgrades',
   'attacker minted unlimited tokens unauthorized mint malicious upgrade pushed to proxy contract exploit via owner function',
   'AERSeal surface (trigger-first). The most direct evidence that privileged-function control failed. Consultative outreach only — see FAIR_CHARACTERISATION_RULES.'),
  ('Institutions Launching On-Chain Products',
   'bank asset manager fintech launches onchain product tokenized deposit settlement network goes live institutional blockchain',
   'AERSeal surface (trigger-first). A regulated institution''s first on-chain product creates privileged roles under a supervisor who will ask who holds them.'),
  ('Institutional Funding Raised Ahead of Launch',
   'raises funding round to build onchain protocol mainnet planned later this year institutional investors back pre-launch',
   'AERSeal surface (trigger-first). Funding before launch means budget exists and the control structure is not yet built — the rare case where both are true at once.')
) AS v(name, probe, notes)
WHERE NOT EXISTS (SELECT 1 FROM sources s WHERE s.source_name = v.name);
