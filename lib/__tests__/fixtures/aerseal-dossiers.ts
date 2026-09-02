// ============================================================================
// AERSeal dossier fixtures — one per trigger class the spec calls out
// (governance proposal, audit finding, security incident, GitHub release),
// plus a few disqualification shapes. These stand in for what
// profileAuthority() (app/api/ai/discover-aerseal/route.ts) would return from
// a live LLM call — the LLM call itself isn't tested here (nondeterministic,
// needs network + API keys); what IS tested against these fixtures is every
// deterministic stage downstream of it: scoreProspect, evaluateGate,
// enforceGapDiscipline, validateHypothesis (lib/aerseal-discovery.ts).
// ============================================================================

import type { AersealDossier } from '@/lib/aerseal-discovery'

const TODAY = new Date('2026-09-02T00:00:00.000Z')

function isoDaysAgo(days: number, from: Date = TODAY): string {
  return new Date(from.getTime() - days * 86400000).toISOString().slice(0, 10)
}

export { TODAY, isoDaysAgo }

function base(overrides: Partial<AersealDossier> = {}): AersealDossier {
  return {
    organization: 'Example Protocol',
    website: 'https://example-protocol.xyz',
    evm_footprint: {
      chains: ['Ethereum'],
      products: ['Lending market'],
      contracts: [
        { name: 'LendingPool', address: '0xABCDEF0000000000000000000000000000AB12', chain: 'Ethereum', explorer_url: 'https://etherscan.io/address/0xabc', verified_on_explorer: true, upgradeable: true },
      ],
      evm_only: true,
      is_non_evm_only: false,
      all_contracts_immutable: false,
    },
    privileged_powers: [
      { power: 'upgrader', where: 'LendingPool proxy', status: 'confirmed', evidence_url: 'https://example-protocol.xyz/docs/security' },
    ],
    authority_control: {
      model: 'multisig_generic',
      detail: '3-of-5 multisig, no disclosed timelock',
      address: '0x1111111111111111111111111111111111111',
      threshold: '3 of 5',
      timelock_delay: null,
      status: 'confirmed',
      evidence_url: 'https://example-protocol.xyz/docs/security',
    },
    trigger: {
      type: 'signer_rotation',
      what_happened: 'The team rotated two of five multisig signers following a governance vote.',
      date: isoDaysAgo(5),
      evidence_url: 'https://forum.example-protocol.xyz/t/signer-rotation/42',
      evidence_tier: 'official',
    },
    structural_fit: {
      segments: ['dao_multisig_timelock'],
      rationale: 'DAO-governed lending protocol operating an upgradeable proxy with a multisig-controlled upgrade path.',
      evidence_url: 'https://example-protocol.xyz/docs/security',
      evidence_tier: 'official',
    },
    control_gap: {
      gap: 'Gap not confirmed',
      status: 'unknown',
      basis: 'Multisig threshold is documented but signer key custody is not.',
    },
    authority_loss_scenario: 'A compromised 3-of-5 threshold could push a malicious implementation to the LendingPool proxy, draining depositor funds.',
    why_now: 'The just-completed signer rotation is exactly when the team is reviewing who holds upgrade authority and how.',
    exposure: {
      value_at_risk_usd: 42_000_000,
      value_basis: 'Protocol TVL per DefiLlama',
      operational: 'Lending market would need to pause if the proxy were compromised',
      reputational: 'DAO-governed protocol with an active community',
      regulatory: null,
    },
    buyer: {
      role: 'Protocol lead / security lead',
      name: null,
      why_this_person: 'Owns the upgrade-key architecture decision',
      governance_owner: 'Example Protocol DAO',
      identifiable: true,
      public_channel: 'https://forum.example-protocol.xyz',
    },
    aerseal_use_case: 'Move the ProxyAdmin/upgrader role to threshold-controlled AERSeal custody with a documented approval policy.',
    incumbent: {
      current_alternative: 'Generic multisig, no timelock disclosed',
      switching_friction: 'low',
      friction_reason: 'No timelock or governance dependency to migrate around',
    },
    facts: ['Multisig rotated 2 of 5 signers on ' + isoDaysAgo(5) + ' (forum post).'],
    inferences: ['Rotation suggests active governance attention to signer custody.'],
    unknowns: ['Signer key generation/custody details are not public.'],
    team_public: true,
    kyc_willing: 'unknown',
    project_active: true,
    rejection_flags: [],
    ...overrides,
  }
}

// ── 1. Governance proposal fixture ──────────────────────────────────────────
// A Tally/Snapshot-shaped proposal that transfers upgrade authority to a new
// timelock — the densest Tier-1 trigger class per the spec.
export const GOVERNANCE_PROPOSAL_DOSSIER: AersealDossier = base({
  organization: 'Aurora Lending DAO',
  trigger: {
    type: 'governance_migration',
    what_happened: 'Proposal AIP-118 passed, migrating ProxyAdmin ownership from a 3-of-5 multisig to a 48h timelock controlled by the same signer set.',
    date: isoDaysAgo(3),
    evidence_url: 'https://gov.aurora-lending.xyz/t/aip-118-proxyadmin-timelock/118',
    evidence_tier: 'official',
  },
  authority_control: {
    model: 'multisig_generic',
    detail: 'Pre-migration state: 3-of-5 multisig holds ProxyAdmin directly, no delay',
    address: '0x2222222222222222222222222222222222222',
    threshold: '3 of 5',
    timelock_delay: null,
    status: 'confirmed',
    evidence_url: 'https://docs.aurora-lending.xyz/security/proxy-admin',
  },
})

// ── 2. Audit finding fixture ────────────────────────────────────────────────
// A centralisation finding from an audit report — Tier 1 "audit_centralisation_finding".
export const AUDIT_FINDING_DOSSIER: AersealDossier = base({
  organization: 'Meridian Vault',
  trigger: {
    type: 'audit_centralisation_finding',
    what_happened: 'Code4rena report flags that the vault owner can call upgradeTo() with no timelock and no second signer.',
    date: isoDaysAgo(12),
    evidence_url: 'https://code4rena.com/reports/2026-08-meridian-vault',
    evidence_tier: 'audit',
  },
  authority_control: {
    model: 'eoa',
    detail: 'Single EOA holds Ownable owner() role per the audit report',
    address: '0x3333333333333333333333333333333333333',
    threshold: null,
    timelock_delay: null,
    status: 'confirmed',
    evidence_url: 'https://code4rena.com/reports/2026-08-meridian-vault',
  },
  privileged_powers: [
    { power: 'owner', where: 'Vault.sol', status: 'confirmed', evidence_url: 'https://code4rena.com/reports/2026-08-meridian-vault' },
    { power: 'upgrader', where: 'Vault.sol (UUPS)', status: 'confirmed', evidence_url: 'https://code4rena.com/reports/2026-08-meridian-vault' },
  ],
  control_gap: {
    gap: 'upgradeTo() is callable by a single EOA with no timelock and no second approver',
    status: 'confirmed',
    basis: 'Code4rena finding C-02, cites the exact function and the absence of a delay or multisig check.',
  },
})

// ── 3. Security incident fixture ────────────────────────────────────────────
// A postmortem-shaped incident — Tier 2 "admin_key_incident". Must trigger
// FAIR_CHARACTERISATION_RULES consultative posture in the outreach hypothesis
// stage, and must NOT be penalized by evaluateGate merely for being a victim.
export const INCIDENT_DOSSIER: AersealDossier = base({
  organization: 'Solstice Bridge',
  trigger: {
    type: 'admin_key_incident',
    what_happened: 'A compromised deployer key was used to call a privileged mint function on the bridge, minting 4.2M unbacked wrapped tokens before the team paused the contract.',
    date: isoDaysAgo(6),
    evidence_url: 'https://solstice-bridge.xyz/blog/incident-postmortem-2026-08-27',
    evidence_tier: 'postmortem',
  },
  privileged_powers: [
    { power: 'minter', where: 'BridgeToken.sol', status: 'confirmed', evidence_url: 'https://solstice-bridge.xyz/blog/incident-postmortem-2026-08-27' },
    { power: 'pauser', where: 'Bridge.sol', status: 'confirmed', evidence_url: 'https://solstice-bridge.xyz/blog/incident-postmortem-2026-08-27' },
  ],
  authority_control: {
    model: 'eoa',
    detail: 'Deployer EOA retained mint authority post-launch; compromised via a phishing attack per the postmortem',
    address: '0x4444444444444444444444444444444444444',
    threshold: null,
    timelock_delay: null,
    status: 'confirmed',
    evidence_url: 'https://solstice-bridge.xyz/blog/incident-postmortem-2026-08-27',
  },
  structural_fit: {
    segments: ['security_incident', 'public_admin_key_risk'],
    rationale: 'Cross-chain bridge with a standing mint role that was reachable by a single compromised key.',
    evidence_url: 'https://solstice-bridge.xyz/blog/incident-postmortem-2026-08-27',
    evidence_tier: 'postmortem',
  },
  control_gap: {
    gap: 'Mint authority sat on a single deployer EOA with no threshold or delay',
    status: 'confirmed',
    basis: 'First-party postmortem states the compromised key held unilateral mint rights.',
  },
  exposure: {
    value_at_risk_usd: 4_200_000,
    value_basis: 'Value of unauthorized mint per the postmortem',
    operational: 'Bridge paused, redemptions frozen pending remediation',
    reputational: 'Public postmortem, community trust actively being rebuilt',
    regulatory: null,
  },
})

// ── 4. GitHub release fixture ───────────────────────────────────────────────
// Release notes documenting a ProxyAdmin migration — Tier 1 "contract_deployment"/"github_releases".
export const GITHUB_RELEASE_DOSSIER: AersealDossier = base({
  organization: 'Fenwick Protocol',
  trigger: {
    type: 'contract_deployment',
    what_happened: 'v3.2.0 release notes: "ProxyAdmin migrated from deployer EOA to a new 4-of-7 Safe; UPGRADER_ROLE granted to the Safe."',
    date: isoDaysAgo(2),
    evidence_url: 'https://github.com/fenwick-protocol/contracts/releases/tag/v3.2.0',
    evidence_tier: 'official',
  },
  authority_control: {
    model: 'safe',
    detail: '4-of-7 Safe now holds ProxyAdmin per the v3.2.0 release notes',
    address: '0x5555555555555555555555555555555555555',
    threshold: '4 of 7',
    timelock_delay: null,
    status: 'confirmed',
    evidence_url: 'https://github.com/fenwick-protocol/contracts/releases/tag/v3.2.0',
  },
  incumbent: {
    current_alternative: 'Safe{Wallet} multisig',
    switching_friction: 'medium',
    friction_reason: 'Team just finished migrating to a Safe, so there is fresh institutional commitment to the current setup',
  },
})

// ── Disqualification fixtures ───────────────────────────────────────────────
// Each should FAIL evaluateGate for exactly the stated reason.

export const NON_EVM_DOSSIER: AersealDossier = base({
  organization: 'Solana-Only Protocol',
  evm_footprint: {
    chains: [],
    products: ['Solana AMM'],
    contracts: [],
    evm_only: false,
    is_non_evm_only: true,
    all_contracts_immutable: false,
  },
})

export const IMMUTABLE_NO_ROLES_DOSSIER: AersealDossier = base({
  organization: 'Immutable Finance',
  evm_footprint: {
    chains: ['Ethereum'],
    products: ['Fixed-supply token'],
    contracts: [
      { name: 'Token', address: '0x666666666666666666666666666666666666666', chain: 'Ethereum', explorer_url: 'https://etherscan.io/address/0x666', verified_on_explorer: true, upgradeable: false },
    ],
    evm_only: true,
    is_non_evm_only: false,
    all_contracts_immutable: true,
  },
  privileged_powers: [],
})

export const NO_TRIGGER_DOSSIER: AersealDossier = base({
  organization: 'Quiet Protocol',
  trigger: {
    type: 'mainnet_launch',
    what_happened: '',
    date: null,
    evidence_url: null,
    evidence_tier: 'none',
  },
})

export const STALE_TRIGGER_DOSSIER: AersealDossier = base({
  organization: 'Old News Protocol',
  trigger: {
    type: 'mainnet_launch',
    what_happened: 'Mainnet launched over a year ago with a documented multisig upgrade path.',
    date: isoDaysAgo(400),
    evidence_url: 'https://old-news-protocol.xyz/blog/mainnet-live',
    evidence_tier: 'official',
  },
})

export const SOCIAL_ONLY_TRIGGER_DOSSIER: AersealDossier = base({
  organization: 'Rumor Protocol',
  trigger: {
    type: 'signer_rotation',
    what_happened: 'A tweet claims the team rotated multisig signers this week.',
    date: isoDaysAgo(1),
    evidence_url: 'https://x.com/rumorprotocol/status/12345',
    evidence_tier: 'social',
  },
})

export const NO_BUYER_ROUTE_DOSSIER: AersealDossier = base({
  organization: 'Anonymous Yield Farm',
  team_public: false,
  kyc_willing: 'no',
  buyer: {
    role: 'Unknown',
    name: null,
    why_this_person: 'No public decision surface found',
    governance_owner: null,
    identifiable: false,
    public_channel: null,
  },
})

// A gap the model over-claimed as "confirmed" purely from upgradeability —
// enforceGapDiscipline must downgrade this to 'inferred'.
export const OVERCLAIMED_GAP_DOSSIER: AersealDossier = base({
  organization: 'Overclaiming Protocol',
  authority_control: {
    model: 'safe_timelock',
    detail: '4-of-7 Safe with a 48h timelock',
    address: '0x7777777777777777777777777777777777777',
    threshold: '4 of 7',
    timelock_delay: '48h',
    status: 'confirmed',
    evidence_url: 'https://overclaiming-protocol.xyz/docs/security',
  },
  control_gap: {
    gap: 'The proxy is upgradeable, which is a control gap',
    status: 'confirmed',
    basis: 'Contracts use the UUPS pattern and are upgradeable.',
  },
})
