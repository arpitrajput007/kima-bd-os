// ============================================================================
// AERSeal customer-discovery brain
// ============================================================================
// AERSeal protects the *authority* over a deployed EVM smart contract — who can
// exercise its privileged powers (ownership, proxy upgrade, mint, burn, freeze,
// pause, treasury movement, bridge administration, emergency actions).
//
// The whole point of this module is that we do NOT go looking for "companies
// interested in blockchain security". That query returns auditors, wallets,
// and conference sponsors — not buyers. Instead we monitor EVENTS in which
// smart-contract administrative authority becomes materially important
// (a signer rotation, a governance migration, a mint-authority disclosure, an
// audit centralisation finding, a new mainnet launch, a postmortem), and we
// work backwards from the event to the organisation that owns the authority.
//
// Everything a model produces here is a structured, evidence-bearing
// observation. The SCORE ITSELF IS COMPUTED IN CODE (scoreProspect below), not
// self-reported — the same discipline the main pipeline learned the hard way
// with pain_point_severity and confidence_score, where a model asked to rate
// its own work reliably inflated the number.
// ============================================================================

// ── Privileged powers ───────────────────────────────────────────────────────
// The authority inventory. `weight` is how much a confirmed instance of this
// power moves admin-authority fit: these are the powers whose compromise
// changes token supply, moves funds, or rewrites contract logic outright.
export const PRIVILEGED_POWERS = {
  owner: { label: 'Contract ownership (Ownable / AccessControl admin)', weight: 100 },
  proxy_admin: { label: 'ProxyAdmin / upgrade authority', weight: 100 },
  upgrader: { label: 'Upgrader role (UUPS / transparent proxy)', weight: 100 },
  minter: { label: 'Mint authority', weight: 100 },
  burner: { label: 'Burn authority', weight: 70 },
  freezer: { label: 'Freeze / blocklist authority', weight: 80 },
  pauser: { label: 'Pause / unpause authority', weight: 75 },
  guardian: { label: 'Guardian / Security Council', weight: 85 },
  treasury: { label: 'Treasury movement authority', weight: 95 },
  bridge_admin: { label: 'Bridge administration (config, validator set, message auth)', weight: 100 },
  emergency: { label: 'Emergency action / circuit breaker', weight: 85 },
  oracle_admin: { label: 'Oracle / price-feed configuration', weight: 90 },
  role_admin: { label: 'Role management (can grant itself any other role)', weight: 95 },
} as const

export type PrivilegedPower = keyof typeof PRIVILEGED_POWERS
export const PRIVILEGED_POWER_KEYS = Object.keys(PRIVILEGED_POWERS) as PrivilegedPower[]

// ── Control models ──────────────────────────────────────────────────────────
// How the privileged power appears to be held today. `risk` drives admin-
// authority fit; `lockIn` is the switching friction an incumbent creates.
//
// NOTE ON FAIRNESS: a Safe or an institutional custodian is NOT scored as
// "inadequate". They score as *lower AERSeal urgency* and *higher lock-in*,
// which is a commercial judgement, not a security claim. We never assert that
// Safe or Fireblocks is insufficient — see FAIR_CHARACTERISATION_RULES.
export const CONTROL_MODELS = {
  eoa: { label: 'Single EOA (externally owned account)', risk: 100, lockIn: 0 },
  unknown: { label: 'Not publicly determinable', risk: 70, lockIn: 2 },
  multisig_generic: { label: 'Multisig, no timelock disclosed', risk: 65, lockIn: 3 },
  safe: { label: 'Safe{Wallet} multisig', risk: 55, lockIn: 5 },
  safe_timelock: { label: 'Safe + timelock', risk: 40, lockIn: 7 },
  timelock: { label: 'Timelock only', risk: 50, lockIn: 4 },
  governance: { label: 'On-chain governance (Tally / Governor / Snapshot+exec)', risk: 45, lockIn: 6 },
  security_council: { label: 'Security Council / multi-party council', risk: 42, lockIn: 6 },
  mpc: { label: 'MPC / threshold signing (self-run or vendor)', risk: 32, lockIn: 8 },
  institutional_custodian: { label: 'Institutional custodian (e.g. qualified custody)', risk: 28, lockIn: 10 },
} as const

export type ControlModel = keyof typeof CONTROL_MODELS
export const CONTROL_MODEL_KEYS = Object.keys(CONTROL_MODELS) as ControlModel[]

// ── Target segments ─────────────────────────────────────────────────────────
// The ten categories to monitor. `baseRelevance` nudges admin-authority fit
// where the segment itself implies a standing privileged surface (a stablecoin
// issuer always has mint/freeze; a Snapshot-only DAO may have none on-chain).
export const AERSEAL_SEGMENTS = {
  stablecoin_issuer: { label: 'Stablecoin issuer', baseRelevance: 100 },
  rwa_tokenization: { label: 'RWA / tokenization platform', baseRelevance: 95 },
  new_evm_protocol: { label: 'New EVM protocol or mainnet', baseRelevance: 85 },
  public_admin_key_risk: { label: 'Public admin-key or upgrade risk disclosed', baseRelevance: 100 },
  defi_vault_treasury: { label: 'DeFi vault, payment contract or protocol treasury', baseRelevance: 90 },
  governance_change: { label: 'Changing signers, founders or governance structure', baseRelevance: 95 },
  security_incident: { label: 'Affected by a key or administrative security incident', baseRelevance: 100 },
  safe_user: { label: 'Established Safe user', baseRelevance: 70 },
  dao_multisig_timelock: { label: 'DAO using multisig + timelock', baseRelevance: 75 },
  exchange_custody: { label: 'Exchange or financial platform using institutional custody', baseRelevance: 80 },
} as const

export type AersealSegment = keyof typeof AERSEAL_SEGMENTS
export const AERSEAL_SEGMENT_KEYS = Object.keys(AERSEAL_SEGMENTS) as AersealSegment[]

// ── Evidence authority tiers ────────────────────────────────────────────────
// Social media is a DISCOVERY surface only. A claim that matters — who holds a
// privileged role, what changed, when — has to land on tier 1 or 2 before the
// prospect can be approved. `corroborating: false` means this tier can start a
// hunt but can never finish one.
export const EVIDENCE_TIERS = {
  onchain: { label: 'On-chain / verified block explorer', score: 100, corroborating: true },
  official: { label: 'Official newsroom, docs, governance forum, GitHub release', score: 95, corroborating: true },
  regulator: { label: 'Regulator or supervisory announcement', score: 100, corroborating: true },
  audit: { label: 'Audit report or formal risk page (L2Beat, auditor PDF)', score: 90, corroborating: true },
  postmortem: { label: 'Incident postmortem (first-party or recognised responder)', score: 88, corroborating: true },
  vendor_page: { label: 'Vendor customer page (Safe, Fireblocks, custodian)', score: 75, corroborating: true },
  reputable_press: { label: 'Established trade press', score: 65, corroborating: true },
  social: { label: 'Social media post (signal only)', score: 30, corroborating: false },
  none: { label: 'No source', score: 0, corroborating: false },
} as const

export type EvidenceTier = keyof typeof EVIDENCE_TIERS
export const EVIDENCE_TIER_KEYS = Object.keys(EVIDENCE_TIERS) as EvidenceTier[]

// ── Trigger dictionary ──────────────────────────────────────────────────────
// The events that make contract authority suddenly matter. `weight` feeds pain
// / consequence; recency is scored separately from the actual date, so a
// high-weight trigger from 2023 still decays properly.
export const AERSEAL_TRIGGERS = {
  admin_key_incident: { label: 'Admin key or signer compromise', weight: 100 },
  upgrade_exploit: { label: 'Malicious upgrade or privileged-function exploit', weight: 100 },
  governance_attack: { label: 'Governance / proposal execution attack', weight: 95 },
  audit_centralisation_finding: { label: 'Audit flagged centralisation or admin-key risk', weight: 85 },
  signer_rotation: { label: 'Signer set or multisig threshold change', weight: 85 },
  governance_migration: { label: 'Migration to council / DAO / timelock', weight: 90 },
  founder_departure: { label: 'Founder or key-holder departure', weight: 88 },
  mainnet_launch: { label: 'New mainnet / L2 / contract deployment', weight: 80 },
  mint_authority_change: { label: 'Mint, freeze or supply-authority change', weight: 92 },
  treasury_mandate: { label: 'Treasury policy or custody mandate change', weight: 78 },
  regulatory_requirement: { label: 'Regulatory approval, licence or supervisory requirement', weight: 90 },
  institutional_partnership: { label: 'Institutional partner / custody integration announced', weight: 72 },
  bridge_upgrade: { label: 'Bridge redeploy, validator-set or config change', weight: 90 },
  security_council_formation: { label: 'Security Council formation or rotation', weight: 85 },
  funding_round: { label: 'Funding round with security/compliance commitments', weight: 60 },
  // ── Added 2026-08-25 to cover the full observable-event list ──────────────
  // The dictionary above skewed toward events where authority CHANGES HANDS on
  // an existing protocol. Half of AERSeal's real openings are the opposite
  // shape: a moment where privileged authority is being CREATED for the first
  // time (a launch, a new chain, a first institutional product) and the control
  // structure is still genuinely open. Those had no trigger key, so they were
  // being forced into 'mainnet_launch' or dropped.
  unauthorized_mint: { label: 'Unauthorized mint or supply manipulation', weight: 100 },
  stablecoin_launch: { label: 'Stablecoin launched, licensed or issued on a new chain', weight: 92 },
  rwa_issuance: { label: 'RWA or tokenized fund issued on-chain', weight: 90 },
  contract_deployment: { label: 'New bridge, vault, payment or treasury contract deployed', weight: 88 },
  chain_expansion: { label: 'Protocol expands to an additional EVM chain', weight: 85 },
  institutional_product_launch: { label: 'Institutional on-chain product launched', weight: 84 },
  pre_launch: { label: 'Testnet live or mainnet launch being prepared', weight: 82 },
  custody_ops_expansion: { label: 'Safe / custody user expanding into smart-contract operations', weight: 78 },
  pre_launch_funding: { label: 'Institutional funding raised ahead of launch', weight: 72 },
} as const

export type AersealTrigger = keyof typeof AERSEAL_TRIGGERS
export const AERSEAL_TRIGGER_KEYS = Object.keys(AERSEAL_TRIGGERS) as AersealTrigger[]

// ── Monitoring surfaces ─────────────────────────────────────────────────────
// The places we actually watch. These are event surfaces, not company
// directories — each one is a stream of moments where contract authority
// changes hands, gets questioned, or gets documented.
export interface MonitoringSurface {
  key: string
  label: string
  kind: 'onchain' | 'official' | 'governance' | 'audit' | 'incident' | 'vendor' | 'regulator' | 'code'
  tier: EvidenceTier
  segments: AersealSegment[]
  // A query or URL. Query strings go to Exa; http(s) URLs get crawled.
  probe: string
}

export const MONITORING_SURFACES: MonitoringSurface[] = [
  // NOTE ON PROBE SHAPE (2026-08-25): every probe below must describe an EVENT,
  // not a product category or a vendor's customer list. A probe like "protocol
  // treasury multisig admin" is keyword prospecting — it returns auditors,
  // wallet vendors, explainer posts and companies with no current buying need,
  // and each one of those costs a full dossier call to reject. A probe like
  // "protocol announces signer rotation" returns dated documents about
  // something that just happened to a specific organisation. If you add a
  // surface, write the sentence a press release or proposal would use, not the
  // nouns our product page uses.
  {
    key: 'l2beat_risk',
    label: 'L2Beat risk pages — upgradeability and Security Council',
    kind: 'audit', tier: 'audit',
    segments: ['new_evm_protocol', 'dao_multisig_timelock', 'public_admin_key_risk'],
    probe: 'https://l2beat.com/scaling/risk',
  },
  {
    key: 'tally_governance',
    label: 'Tally — on-chain governance parameter and role changes',
    kind: 'governance', tier: 'official',
    segments: ['governance_change', 'dao_multisig_timelock'],
    probe: 'governance proposal passed to transfer contract ownership rotate upgrade admin role or change timelock delay',
  },
  {
    key: 'snapshot_governance',
    label: 'Snapshot — signer, guardian and treasury proposals',
    kind: 'governance', tier: 'official',
    segments: ['governance_change', 'defi_vault_treasury', 'dao_multisig_timelock'],
    probe: 'DAO proposal to rotate multisig signers change signing threshold or appoint new treasury guardian',
  },
  {
    key: 'audit_centralisation',
    label: 'Audit reports — centralisation and privileged-role findings',
    kind: 'audit', tier: 'audit',
    segments: ['public_admin_key_risk', 'new_evm_protocol'],
    probe: 'audit report published flags centralization risk owner can upgrade without timelock admin key single EOA finding',
  },
  {
    key: 'stablecoin_launch',
    label: 'Stablecoin launches, licences and new-chain issuance',
    kind: 'official', tier: 'official',
    segments: ['stablecoin_issuer'],
    probe: 'stablecoin goes live launches natively on new chain issuer receives licence approval begins minting',
  },
  {
    key: 'rwa_issuance',
    label: 'RWA and tokenized fund issuance events',
    kind: 'official', tier: 'official',
    segments: ['rwa_tokenization'],
    probe: 'tokenized fund launched treasury product issued onchain asset manager brings fund to blockchain first issuance',
  },
  {
    key: 'mainnet_launch',
    label: 'New EVM mainnets, L2s and contract deployments',
    kind: 'official', tier: 'official',
    segments: ['new_evm_protocol'],
    probe: 'protocol launches mainnet contracts now deployed live announcement L2 goes live to public',
  },
  {
    key: 'pre_launch',
    label: 'Testnet live and mainnet launch preparation',
    kind: 'official', tier: 'official',
    segments: ['new_evm_protocol'],
    probe: 'protocol testnet now live incentivized testnet begins mainnet launch scheduled audit completed ahead of deployment',
  },
  {
    key: 'chain_expansion',
    label: 'Protocols expanding to an additional EVM chain',
    kind: 'official', tier: 'official',
    segments: ['new_evm_protocol', 'defi_vault_treasury'],
    probe: 'protocol expands deploys contracts to additional EVM chain now live on Base Arbitrum multichain expansion announcement',
  },
  {
    key: 'new_contract_deploy',
    label: 'New bridge, vault, payment or treasury contracts going live',
    kind: 'official', tier: 'official',
    segments: ['defi_vault_treasury', 'new_evm_protocol'],
    probe: 'launches new vault bridge payment contract onchain treasury goes live deployed contracts announcement',
  },
  {
    key: 'incident_postmortem',
    label: 'Security postmortems — key and administrative compromise',
    kind: 'incident', tier: 'postmortem',
    segments: ['security_incident', 'public_admin_key_risk'],
    probe: 'postmortem deployer private key compromised admin wallet drained attacker gained control of privileged function',
  },
  {
    key: 'unauthorized_mint',
    label: 'Unauthorized mints and malicious contract upgrades',
    kind: 'incident', tier: 'postmortem',
    segments: ['security_incident', 'public_admin_key_risk'],
    probe: 'attacker minted unlimited tokens unauthorized mint malicious upgrade pushed to proxy contract exploit via owner function',
  },
  {
    key: 'rekt_leaderboard',
    label: 'Rekt — administrative and access-control failures',
    kind: 'incident', tier: 'reputable_press',
    segments: ['security_incident'],
    probe: 'https://rekt.news/leaderboard',
  },
  {
    key: 'governance_forums',
    label: 'Governance forums — signer, council and upgrade debates',
    kind: 'governance', tier: 'official',
    segments: ['governance_change', 'dao_multisig_timelock'],
    probe: 'forum discussion proposes moving upgrade key to timelock forming security council reducing admin powers protocol',
  },
  {
    key: 'custody_ops_expansion',
    label: 'Safe / custody users expanding into contract operations',
    kind: 'vendor', tier: 'vendor_page',
    segments: ['safe_user', 'exchange_custody', 'dao_multisig_timelock'],
    probe: 'company using Safe multisig or institutional custody now deploying its own smart contracts expanding onchain operations',
  },
  {
    key: 'institutional_onchain',
    label: 'Institutions launching on-chain products',
    kind: 'official', tier: 'official',
    segments: ['exchange_custody', 'rwa_tokenization', 'stablecoin_issuer'],
    probe: 'bank asset manager fintech launches onchain product tokenized deposit settlement network goes live institutional blockchain',
  },
  {
    key: 'github_releases',
    label: 'GitHub releases — contract, access-control and deploy changes',
    kind: 'code', tier: 'official',
    segments: ['new_evm_protocol', 'governance_change'],
    probe: 'release notes contracts redeployed ownership transferred access control roles changed proxy admin migration',
  },
  {
    key: 'regulator_announcements',
    label: 'Regulator and supervisory announcements',
    kind: 'regulator', tier: 'regulator',
    segments: ['stablecoin_issuer', 'rwa_tokenization', 'exchange_custody'],
    probe: 'regulator grants licence approves stablecoin issuer tokenization platform authorised supervisory requirement announced',
  },
  {
    key: 'founder_governance_change',
    label: 'Founder departures and key-holder transitions',
    kind: 'official', tier: 'reputable_press',
    segments: ['governance_change'],
    probe: 'founder steps down core contributor leaves protocol hands over control governance transition key holder replaced',
  },
  {
    key: 'pre_launch_funding',
    label: 'Institutional funding raised ahead of launch',
    kind: 'official', tier: 'reputable_press',
    segments: ['new_evm_protocol', 'rwa_tokenization'],
    probe: 'raises funding round to build onchain protocol mainnet planned later this year institutional investors back pre-launch',
  },
]

// ── Rejection rules ─────────────────────────────────────────────────────────
export const REJECTION_REASONS = {
  non_evm: 'Non-EVM only — AERSeal protects EVM contract authority',
  immutable: 'Contracts are immutable with no privileged roles — nothing to protect',
  insignificant_value: 'Value and usage too small to justify authority infrastructure',
  inactive: 'Project appears inactive or abandoned',
  anon_no_kyc: 'Anonymous team unwilling to complete KYC/KYB',
  no_trigger: 'No genuine, dated current trigger',
} as const

export type RejectionReason = keyof typeof REJECTION_REASONS

// ── The prospect dossier ────────────────────────────────────────────────────
// This is the shape the research model must fill in, and the shape we persist.
// FACT / INFERENCE / UNKNOWN are three separate arrays and never merged.
export interface AersealDossier {
  organization: string
  website: string
  // 1. What EVM contracts or products the organisation operates.
  evm_footprint: {
    chains: string[]
    products: string[]
    contracts: Array<{
      name: string
      address: string | null
      chain: string | null
      explorer_url: string | null
      verified_on_explorer: boolean
      upgradeable: boolean | null
    }>
    evm_only: boolean
    is_non_evm_only: boolean
    all_contracts_immutable: boolean
  }
  // 2. What privileged powers exist.
  privileged_powers: Array<{
    power: PrivilegedPower
    where: string
    status: 'confirmed' | 'inferred' | 'unknown'
    evidence_url: string | null
  }>
  // 3. How those powers appear to be controlled.
  authority_control: {
    model: ControlModel
    detail: string
    address: string | null
    threshold: string | null
    timelock_delay: string | null
    status: 'confirmed' | 'inferred' | 'unknown'
    evidence_url: string | null
  }
  // 4. The current event that makes outreach timely.
  trigger: {
    type: AersealTrigger
    what_happened: string
    date: string | null
    evidence_url: string | null
    evidence_tier: EvidenceTier
  }
  // 5. Structural fit — why this org is shaped like an AERSeal customer at all,
  //    independent of today's news.
  structural_fit: {
    segments: AersealSegment[]
    rationale: string
    evidence_url: string | null
    evidence_tier: EvidenceTier
  }
  // 6. The potential CONTROL GAP — what is architecturally missing between the
  //    privileged power and the way it is controlled today. Deliberately its
  //    own field with its own status: "their proxy is upgradeable" is NOT a
  //    gap, and keeping the gap separate from evm_footprint.upgradeable is
  //    what stops the pipeline sliding back into treating upgradeability as a
  //    finding. 'Gap not confirmed' is the correct answer more often than not.
  control_gap: {
    gap: string
    status: 'confirmed' | 'inferred' | 'unknown'
    basis: string
  }
  // 7. What actually goes wrong if this authority is lost or compromised —
  //    stated as a consequence for THIS organisation, not a generic risk.
  authority_loss_scenario: string
  // 8. Why the trigger event makes this the right moment to review control.
  //    Must connect the dated event to the privileged role — "they launched
  //    and launches are risky" is not an answer.
  why_now: string
  // Exposure — what actually goes wrong if the authority is misused.
  exposure: {
    value_at_risk_usd: number | null
    value_basis: string
    operational: string | null
    reputational: string | null
    regulatory: string | null
  }
  // 9. The likely buyer / governance owner.
  buyer: {
    role: string
    name: string | null
    why_this_person: string
    governance_owner: string | null
    identifiable: boolean
    public_channel: string | null
  }
  // 10. The specific AERSeal use case.
  aerseal_use_case: string
  // 11. The current alternative and likely switching friction.
  incumbent: {
    current_alternative: string
    switching_friction: 'none' | 'low' | 'medium' | 'high'
    friction_reason: string
  }
  // Epistemics — kept strictly separate.
  facts: string[]
  inferences: string[]
  unknowns: string[]
  // Team / diligence posture.
  team_public: boolean
  kyc_willing: 'yes' | 'no' | 'unknown'
  project_active: boolean
  // Disqualifiers the model itself spotted.
  rejection_flags: RejectionReason[]
}

// ── Scoring ─────────────────────────────────────────────────────────────────
// Weights per the AERSeal rubric. Every component is derived from structured
// dossier fields — none of them is a number the model was asked to invent.
// These weights are shared with the curated account workbook in
// lib/aerseal-customers.ts, which stores the same six sub-scores on a 1-5
// scale plus lockIn 0-10. The two are mathematically the same rubric — a
// workbook row scoring 5/5 on pain corresponds to pain_consequence 100 here —
// so a live-discovered prospect and a workbook account are directly
// comparable. Change one, change the other.
export const SCORE_WEIGHTS = {
  pain_consequence: 0.25,
  trigger_recency: 0.20,
  evm_fit: 0.15,
  admin_authority_fit: 0.20,
  reachability: 0.10,
  evidence_confidence: 0.10,
} as const

// A trigger has to be CURRENT, not merely dated. Past this, the event has been
// fully absorbed by the organisation — the signer change happened, the council
// was seated, the postmortem was actioned — and citing it reads as stale
// research rather than timely awareness. Nine months is deliberately generous:
// regulatory and governance work moves slowly, but three quarters is the limit.
export const TRIGGER_STALE_DAYS = 270

export const TIER_1_MIN = 82
export const TIER_2_MIN = 72

export interface ScoreBreakdown {
  pain_consequence: number
  trigger_recency: number
  evm_fit: number
  admin_authority_fit: number
  reachability: number
  evidence_confidence: number
  weighted_subtotal: number
  lock_in_penalty: number
  total: number
  tier: 1 | 2 | 3
  notes: string[]
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n))
}

// Days between a (possibly partial) trigger date and now. Accepts
// '2026-08-19', '2026-08', 'August 2026'. Returns null when undatable — an
// undated trigger scores as weak recency rather than silently as "today".
export function daysSince(dateStr: string | null | undefined, now = new Date()): number | null {
  if (!dateStr) return null
  const raw = String(dateStr).trim()
  if (!raw || /^(null|unknown|n\/a|none)$/i.test(raw)) return null
  let d = new Date(raw)
  if (isNaN(d.getTime())) {
    const m = raw.match(/([A-Za-z]{3,9})\s+(\d{4})/)
    if (m) d = new Date(`${m[1]} 1, ${m[2]}`)
  }
  if (isNaN(d.getTime())) return null
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  return days < 0 ? 0 : days
}

// Value-at-risk → consequence band. Deliberately coarse: the difference
// between $40M and $60M TVL does not change the sales motion, but the
// difference between $200k and $200M does.
function valueBand(usd: number | null): number {
  if (usd == null) return 45
  if (usd >= 1_000_000_000) return 100
  if (usd >= 100_000_000) return 92
  if (usd >= 10_000_000) return 80
  if (usd >= 1_000_000) return 62
  if (usd >= 100_000) return 40
  return 20
}

export function scoreProspect(d: AersealDossier, now = new Date()): ScoreBreakdown {
  const notes: string[] = []

  // ── Admin-authority fit (20%) ─────────────────────────────────────────────
  // Strongest confirmed power × how exposed its controller looks. A confirmed
  // mint role behind a single EOA is the archetype; an inferred pause role
  // behind a Safe+timelock is not.
  const powers = d.privileged_powers || []
  const confirmedPowers = powers.filter(p => p.status === 'confirmed')
  const inferredPowers = powers.filter(p => p.status === 'inferred')
  const powerWeight = (p: { power: PrivilegedPower }) => PRIVILEGED_POWERS[p.power]?.weight ?? 0
  const topConfirmed = confirmedPowers.length ? Math.max(...confirmedPowers.map(powerWeight)) : 0
  const topInferred = inferredPowers.length ? Math.max(...inferredPowers.map(powerWeight)) : 0
  const powerSignal = Math.max(topConfirmed, topInferred * 0.7)
  // Breadth matters: an org holding five privileged roles has a wider blast
  // radius than one holding a single pause switch.
  const breadthBonus = Math.min(12, Math.max(0, powers.length - 1) * 3)

  const control = CONTROL_MODELS[d.authority_control?.model] ?? CONTROL_MODELS.unknown
  const controlRisk = control.risk
  const segmentBase = (d.structural_fit?.segments || [])
    .map(s => AERSEAL_SEGMENTS[s]?.baseRelevance ?? 0)
    .reduce((a, b) => Math.max(a, b), 0)

  let admin_authority_fit = clamp(
    powerSignal * 0.5 + controlRisk * 0.35 + segmentBase * 0.15 + breadthBonus
  )
  if (d.authority_control?.status === 'unknown') {
    admin_authority_fit = clamp(admin_authority_fit - 8)
    notes.push('Control model not confirmed — authority fit discounted.')
  }
  if (confirmedPowers.length === 0) {
    admin_authority_fit = clamp(admin_authority_fit - 12)
    notes.push('No privileged power confirmed on an authoritative source — only inferred.')
  }

  // ── EVM fit (15%) ─────────────────────────────────────────────────────────
  const fp = d.evm_footprint
  let evm_fit = 0
  if (fp?.is_non_evm_only) {
    evm_fit = 0
    notes.push('Non-EVM only.')
  } else {
    // EVM fit measures EVM RELEVANCE, not how well-evidenced the footprint is.
    // Proof quality is already its own 10% component (evidence_confidence), and
    // an earlier version awarded 25 points here for verified_on_explorer, which
    // double-counted the same signal and pushed live scores roughly 15 points
    // below the curated workbook in lib/aerseal-customers.ts for equivalent
    // accounts — even though both use this identical weighting. Explorer
    // verification now contributes a small confirmation bonus only.
    const chains = (fp?.chains || []).length
    const contracts = (fp?.contracts || []).length
    const verified = (fp?.contracts || []).filter(c => c.verified_on_explorer).length
    const upgradeable = (fp?.contracts || []).filter(c => c.upgradeable).length
    evm_fit = clamp(
      (chains > 0 ? 40 : 0) +
      (contracts > 0 ? 30 : 0) +
      (upgradeable > 0 ? 15 : 0) +
      (fp?.evm_only ? 10 : 5) +
      (verified > 0 ? 5 : 0)
    )
    if (fp?.all_contracts_immutable) {
      evm_fit = clamp(evm_fit - 45)
      notes.push('Contracts reported immutable — little or no authority surface.')
    }
  }

  // ── Pain / consequence (25%) ──────────────────────────────────────────────
  // What actually goes wrong, weighted by the trigger that surfaced them.
  const exp = d.exposure || { value_at_risk_usd: null, value_basis: '', operational: null, reputational: null, regulatory: null }
  const value = valueBand(exp.value_at_risk_usd)
  const triggerWeight = AERSEAL_TRIGGERS[d.trigger?.type]?.weight ?? 50
  const nonFinancialExposure =
    (exp.operational ? 1 : 0) + (exp.reputational ? 1 : 0) + (exp.regulatory ? 1 : 0)
  // When the figure is genuinely unknown — common, since most protocols do not
  // publish what a privileged role can reach — fall back to the documented
  // non-financial exposure rather than letting a placeholder value band carry
  // more than half the weight.
  const pain_consequence = clamp(
    exp.value_at_risk_usd == null
      ? triggerWeight * 0.45 + nonFinancialExposure * 10
      : value * 0.55 + triggerWeight * 0.30 + nonFinancialExposure * 5,
  )

  // ── Trigger recency (20%) ─────────────────────────────────────────────────
  const age = daysSince(d.trigger?.date, now)
  let trigger_recency: number
  if (age == null) {
    trigger_recency = 25
    notes.push('Trigger has no verifiable date — recency scored as weak.')
  } else if (age <= 14) trigger_recency = 100
  else if (age <= 30) trigger_recency = 90
  else if (age <= 60) trigger_recency = 75
  else if (age <= 90) trigger_recency = 58
  else if (age <= 180) trigger_recency = 38
  else if (age <= 365) trigger_recency = 18
  else {
    trigger_recency = 5
    notes.push('Trigger is over a year old — effectively stale.')
  }

  // ── Reachability (10%) ────────────────────────────────────────────────────
  // Measures whether a ROUTE TO A BUYER EXISTS, not whether we already hold a
  // name and an inbox. That distinction is load-bearing: enrichment (Apollo /
  // Hunter) deliberately runs only AFTER an account qualifies, so scoring
  // "do we have the person" here would reject exactly the accounts enrichment
  // was going to resolve — which is what an early live run did, failing two
  // strong protocols on 'No identifiable buyer' before Apollo was ever called.
  // So the signals that count are the ones enrichment can act on: a public
  // decision surface, a named governance owner, a public team, a corporate
  // domain. A known name is a bonus on top, not the requirement.
  const buyer = d.buyer
  let reachability = 15
  if (buyer?.public_channel) reachability += 30
  if (buyer?.governance_owner) reachability += 20
  if (d.team_public) reachability += 20
  if (buyer?.identifiable) reachability += 15
  if (buyer?.name) reachability += 15
  if (d.website) reachability += 5
  reachability = clamp(reachability)

  // ── Evidence confidence (10%) ─────────────────────────────────────────────
  // Social-only evidence is capped hard: it can start a hunt, never close one.
  const triggerTier = EVIDENCE_TIERS[d.trigger?.evidence_tier] ?? EVIDENCE_TIERS.none
  const structuralTier = EVIDENCE_TIERS[d.structural_fit?.evidence_tier] ?? EVIDENCE_TIERS.none
  const facts = (d.facts || []).length
  const inferences = (d.inferences || []).length
  const unknowns = (d.unknowns || []).length
  const factRatio = facts + inferences === 0 ? 0 : facts / (facts + inferences)
  let evidence_confidence = clamp(
    triggerTier.score * 0.40 +
    structuralTier.score * 0.30 +
    factRatio * 100 * 0.20 +
    (d.trigger?.evidence_url ? 10 : 0) -
    Math.min(12, unknowns * 2)
  )
  if (!triggerTier.corroborating) {
    evidence_confidence = Math.min(evidence_confidence, 40)
    notes.push('Trigger rests on a non-corroborating source — needs an official confirmation.')
  }

  // ── Weighted subtotal ─────────────────────────────────────────────────────
  const weighted_subtotal =
    pain_consequence * SCORE_WEIGHTS.pain_consequence +
    trigger_recency * SCORE_WEIGHTS.trigger_recency +
    evm_fit * SCORE_WEIGHTS.evm_fit +
    admin_authority_fit * SCORE_WEIGHTS.admin_authority_fit +
    reachability * SCORE_WEIGHTS.reachability +
    evidence_confidence * SCORE_WEIGHTS.evidence_confidence

  // ── Lock-in penalty (0–10 absolute points) ────────────────────────────────
  // Incumbent depth plus how hard the switch looks. This is commercial, not a
  // security judgement about the incumbent.
  const frictionPts: Record<string, number> = { none: 0, low: 2, medium: 4, high: 6 }
  const lock_in_penalty = Math.min(
    10,
    Math.round(control.lockIn * 0.5 + (frictionPts[d.incumbent?.switching_friction] ?? 2))
  )
  if (lock_in_penalty >= 7) {
    notes.push(`Meaningful incumbent lock-in (${d.incumbent?.current_alternative || control.label}) — ${lock_in_penalty} pts deducted.`)
  }

  const total = clamp(Math.round(weighted_subtotal - lock_in_penalty))
  const tier: 1 | 2 | 3 = total >= TIER_1_MIN ? 1 : total >= TIER_2_MIN ? 2 : 3

  return {
    pain_consequence: Math.round(pain_consequence),
    trigger_recency: Math.round(trigger_recency),
    evm_fit: Math.round(evm_fit),
    admin_authority_fit: Math.round(admin_authority_fit),
    reachability: Math.round(reachability),
    evidence_confidence: Math.round(evidence_confidence),
    weighted_subtotal: Math.round(weighted_subtotal),
    lock_in_penalty,
    total,
    tier,
    notes,
  }
}

// ── Gap discipline ──────────────────────────────────────────────────────────
// The one claim AERSeal must never make loosely: that an organisation HAS a
// control gap. FAIR_CHARACTERISATION_RULES tells the model not to derive one
// from upgradeability alone, but a prompt rule is not an enforcement mechanism.
// This is.
//
// Deliberately a DOWNGRADE, not a rejection. A prospect can have a confirmed
// privileged role, a dated official trigger and both evidence URLs, and still
// have one sloppily-worded gap sentence — failing the whole account for that
// would repeat the mistake the severity and urgency gates both had to unwind
// (2026-08-19), where an evidence rule aimed at a bad claim ended up rejecting
// good leads. So the claim gets corrected to 'inferred' and the correction is
// reported; the account is judged on everything else.
//
// Mutates the dossier so the persisted record carries the corrected status —
// the downgraded value is what we want stored, not the model's original.
export function enforceGapDiscipline(d: AersealDossier): string[] {
  const downgrades: string[] = []
  const gap = d?.control_gap
  if (!gap || gap.status !== 'confirmed') return downgrades

  // A gap cannot be confirmed when the controller was never confirmed: knowing
  // a ProxyAdmin exists says nothing about who holds it.
  if (d.authority_control?.status !== 'confirmed') {
    gap.status = 'inferred'
    downgrades.push('Gap was claimed as confirmed while the controller itself is unconfirmed — recorded as inference.')
    return downgrades
  }

  // Upgradeability, proxies and the mere existence of a privileged role are
  // design facts, not findings. A confirmed gap has to say something about the
  // CONTROLLER — a single key, a threshold, a missing delay or approval step.
  const basis = `${gap.gap || ''} ${gap.basis || ''}`.toLowerCase()
  const mentionsDesign = /upgrade(?:able|ability)|proxy|uups|implementation slot/.test(basis)
  const mentionsController =
    /eoa|single (?:key|signer|address|account)|threshold|signer|multisig|timelock|delay|custodian|approval|unilateral|\b\d+ ?(?:of|-of-) ?\d+\b|council|governance/.test(basis)
  if (mentionsDesign && !mentionsController) {
    gap.status = 'inferred'
    downgrades.push('Gap rested on upgradeability alone — that is a design choice, not a finding. Recorded as inference.')
  }

  return downgrades
}

// ── Approval gate ───────────────────────────────────────────────────────────
// Six hard requirements. These are not score thresholds — a 95-point prospect
// missing an identifiable buyer is still not approved.
export interface GateResult {
  approved: boolean
  failures: string[]
  rejections: RejectionReason[]
}

export function evaluateGate(d: AersealDossier, score: ScoreBreakdown, now = new Date()): GateResult {
  const failures: string[] = []
  const rejections: RejectionReason[] = []

  // Rejection rules first — these are disqualifiers, not deductions.
  const fp = d.evm_footprint
  if (fp?.is_non_evm_only || score.evm_fit < 25) rejections.push('non_evm')
  if (fp?.all_contracts_immutable && (d.privileged_powers || []).length === 0) rejections.push('immutable')
  if ((d.exposure?.value_at_risk_usd ?? null) !== null && (d.exposure.value_at_risk_usd as number) < 100_000
      && !d.exposure.regulatory) {
    rejections.push('insignificant_value')
  }
  if (d.project_active === false) rejections.push('inactive')
  if (d.team_public === false && d.kyc_willing === 'no') rejections.push('anon_no_kyc')

  const age = daysSince(d.trigger?.date, now)
  const isCurrent = age !== null && age <= TRIGGER_STALE_DAYS
  const hasRealTrigger =
    !!d.trigger?.what_happened &&
    d.trigger.what_happened.trim().length > 20 &&
    !!d.trigger.evidence_url &&
    isCurrent
  if (!hasRealTrigger) rejections.push('no_trigger')

  for (const r of d.rejection_flags || []) {
    if (!rejections.includes(r)) rejections.push(r)
  }

  // Six approval requirements.
  if (score.evm_fit < 40) failures.push('No meaningful EVM relevance')
  if ((d.privileged_powers || []).length === 0) failures.push('No plausible privileged smart-contract authority')
  if (score.pain_consequence < 40) failures.push('No material value, operational or reputational exposure')
  if (!hasRealTrigger) {
    failures.push(
      age !== null && age > TRIGGER_STALE_DAYS
        ? `Evidence 2 of 2 stale — trigger is ${age} days old, not a current buying trigger`
        : 'Evidence 2 of 2 missing — no dated trigger event with an evidence URL',
    )
  }

  // ── The two-evidence requirement ────────────────────────────────────────
  // Both pieces are mandatory and they prove different things. STRUCTURAL
  // evidence proves the relevant EVM contracts / administrative authority
  // actually exist. DATED TRIGGER evidence (checked above) proves why outreach
  // makes sense now. A prospect with only structural evidence is a company we
  // could theoretically sell to some day; one with only a trigger is a news
  // story. Neither is a lead.
  const structuralTier = EVIDENCE_TIERS[d.structural_fit?.evidence_tier] ?? EVIDENCE_TIERS.none
  if (!d.structural_fit?.evidence_url || !structuralTier.corroborating) {
    failures.push('Evidence 1 of 2 missing — no structural proof, from an authoritative source, that the EVM contracts or administrative authority exist')
  }

  // "Identifiable" means a route in exists that enrichment can act on — a
  // public decision surface, a named governance body, or a public team at a
  // real domain. It does NOT mean we already have the person; finding them is
  // what the post-qualification Apollo/Hunter step is for.
  const hasRouteToBuyer =
    !!d.buyer?.identifiable ||
    !!d.buyer?.governance_owner ||
    !!d.buyer?.public_channel ||
    (d.team_public === true && !!d.website)
  if (!hasRouteToBuyer) failures.push('No identifiable buyer or governance owner')

  // Corroboration rule: social discovers, authority confirms.
  const triggerTier = EVIDENCE_TIERS[d.trigger?.evidence_tier] ?? EVIDENCE_TIERS.none
  if (!triggerTier.corroborating) {
    failures.push('Trigger is corroborated only by social media — needs an official or authoritative source')
  }

  return { approved: failures.length === 0 && rejections.length === 0, failures, rejections }
}

// ── Outreach hypothesis ─────────────────────────────────────────────────────
// Exactly three parts: one verified trigger, one concrete authority
// implication, one intelligent question. No trigger, no send.
export interface OutreachHypothesis {
  verified_trigger: string
  authority_implication: string
  intelligent_question: string
  evidence_url: string
}

export function validateHypothesis(h: Partial<OutreachHypothesis> | null | undefined): string[] {
  const problems: string[] = []
  if (!h) return ['No outreach hypothesis produced']
  if (!h.verified_trigger || h.verified_trigger.trim().length < 15) problems.push('Missing verified trigger')
  if (!h.evidence_url || !/^https?:\/\//.test(h.evidence_url)) problems.push('Trigger has no evidence URL — no trigger, no send')
  if (!h.authority_implication || h.authority_implication.trim().length < 20) problems.push('Missing concrete authority implication')
  if (!h.intelligent_question || !h.intelligent_question.includes('?')) problems.push('Missing intelligent question')
  const text = `${h.verified_trigger} ${h.authority_implication} ${h.intelligent_question}`.toLowerCase()
  for (const phrase of FEAR_PHRASES) {
    if (text.includes(phrase)) problems.push(`Fear-based language: "${phrase}"`)
  }
  return problems
}

// Consultative tone enforcement — especially for incident victims, who are
// being written to on what is probably the worst week of their year.
export const FEAR_PHRASES = [
  'you could be next',
  'before it happens to you',
  'hackers are targeting',
  'your funds are at risk',
  'catastrophic',
  'devastating',
  'you are vulnerable',
  "you're vulnerable",
  'disaster waiting',
  'ticking time bomb',
  'wake-up call',
  'act now before',
]

// ── Trigger-first discovery discipline ──────────────────────────────────────
// The single rule that separates this pipeline from keyword prospecting. Kept
// as a shared constant so the harvest, extraction and profiling stages all
// state it identically — the failure mode it prevents (a model quietly
// "helping" by returning a well-known security-adjacent company with no event
// behind it) shows up at whichever stage forgets to say it.
export const TRIGGER_FIRST_RULES = `TRIGGER-FIRST REVERSE DISCOVERY — this is the method, not a preference:

Work BACKWARDS from an observable event to the organisation it affected. Never forwards from a product keyword to a company.

NEVER qualify an organisation because it mentions, sells, or is associated with: "smart-contract security", "MPC", "multisig", "threshold signing", "key management", "wallet infrastructure", "audits", or any other term from our own product vocabulary. Those searches return competitors, security vendors, content publishers, conference sponsors and companies with no current buying need. A keyword match is not a signal.

The ONLY valid entry point is an observable, dated event. The event classes that matter:
- A stablecoin launched, licensed, or expanded to another EVM chain
- An RWA or tokenized fund issued on-chain
- A protocol preparing for testnet or mainnet
- A company raising institutional funding before launch
- A new bridge, vault, payment contract or treasury deployed
- An audit identifying centralized admin, upgrade or ownership risk
- A contract that can be upgraded without a timelock
- A DAO rotating signers or changing its Security Council
- A founder, contributor or governance team transition
- A compromised deployer, admin, treasury or private key
- An unauthorized mint or malicious contract upgrade
- A protocol adding another EVM chain
- A company launching an institutional on-chain product
- A Safe, Fireblocks or custody user expanding into smart-contract operations

From the event, and only from the event, work through: affected organisation -> the privileged EVM authority it operates -> the potential control gap -> why this event makes control a live question now -> who owns that decision internally -> evidence-backed outreach.

NO OBSERVABLE TRIGGER, NO OUTREACH. An organisation that is a perfect structural fit with nothing happening is not a prospect today. Say so and move on.`

export const FAIR_CHARACTERISATION_RULES = `FAIR CHARACTERISATION — non-negotiable:
- An upgradeable contract is NOT automatically insecure. Upgradeability is a deliberate design choice with real benefits. The question AERSeal asks is who controls the upgrade, not whether upgrades exist.
- NEVER infer that an organisation has a control gap merely because its contracts are upgradeable, or because it holds a privileged role at all. A gap requires evidence about the CONTROLLER — who holds the role, under what threshold, with what delay. If you only know the role exists, control_gap.gap is exactly "Gap not confirmed" and control_gap.status is "unknown". That is a correct, useful answer.
- Safe{Wallet} is NOT inadequate. Do not claim or imply it is. A Safe is a well-engineered multisig; AERSeal's relevance next to one is about threshold policy, key material custody, and provable control, and it must be argued on evidence about THIS organisation's setup.
- Fireblocks and other institutional custodians are NOT inadequate. Do not claim or imply it. If an organisation uses one, treat that as high incumbent lock-in and a harder sale, not as a security deficiency.
- Never state that an organisation IS compromised, insecure, or negligent. State what is publicly documented about their control structure and what that structure implies, and mark everything else as inference or unknown.
- For organisations recovering from a security incident: consultative language only. No fear framing, no "this could happen again", no implied blame. Reference the public postmortem, acknowledge what they already did, and ask a question that respects their expertise.`

export const EPISTEMIC_RULES = `FACT / INFERENCE / UNKNOWN — keep these three strictly separate and never let one drift into another:
- FACT: something stated on an authoritative source you can cite with a URL — an official post, docs page, governance proposal, GitHub release, audit report, L2Beat risk page, verified block-explorer contract, regulator notice, or first-party postmortem. A fact carries its URL.
- INFERENCE: a reasoned conclusion drawn from facts. "The docs describe a ProxyAdmin and the team is three people, so the upgrade key is likely held by a founder" is an inference, not a fact. Label it as such.
- UNKNOWN: something that genuinely matters and you could not establish. An honest unknown is more valuable than a confident guess — write it down rather than papering over it.
Social media (X, Farcaster, Telegram, Discord, Reddit) is a DISCOVERY surface only. A post there can tell you where to look; it can never be the source that establishes who controls a privileged role. If the only evidence for a claim is social, that claim is at best an INFERENCE and the prospect cannot be approved on it.`

// Compact reference blocks injected into the research prompts.
export function powersReference(): string {
  return PRIVILEGED_POWER_KEYS.map(k => `- ${k}: ${PRIVILEGED_POWERS[k].label}`).join('\n')
}

export function controlModelsReference(): string {
  return CONTROL_MODEL_KEYS.map(k => `- ${k}: ${CONTROL_MODELS[k].label}`).join('\n')
}

export function segmentsReference(): string {
  return AERSEAL_SEGMENT_KEYS.map(k => `- ${k}: ${AERSEAL_SEGMENTS[k].label}`).join('\n')
}

export function triggersReference(): string {
  return AERSEAL_TRIGGER_KEYS.map(k => `- ${k}: ${AERSEAL_TRIGGERS[k].label}`).join('\n')
}

export function evidenceTiersReference(): string {
  return EVIDENCE_TIER_KEYS.map(k => `- ${k}: ${EVIDENCE_TIERS[k].label}${EVIDENCE_TIERS[k].corroborating ? '' : '  [DISCOVERY ONLY — cannot corroborate]'}`).join('\n')
}

export function tierLabel(tier: 1 | 2 | 3): string {
  return tier === 1 ? 'Tier 1' : tier === 2 ? 'Tier 2' : 'Tier 3'
}
