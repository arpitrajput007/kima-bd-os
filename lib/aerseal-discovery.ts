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
    probe: 'Tally governance proposal upgrade admin role timelock signer change protocol',
  },
  {
    key: 'snapshot_governance',
    label: 'Snapshot — signer, guardian and treasury proposals',
    kind: 'governance', tier: 'official',
    segments: ['governance_change', 'defi_vault_treasury', 'dao_multisig_timelock'],
    probe: 'Snapshot proposal multisig signer rotation guardian treasury custody protocol',
  },
  {
    key: 'audit_centralisation',
    label: 'Audit reports — centralisation and privileged-role findings',
    kind: 'audit', tier: 'audit',
    segments: ['public_admin_key_risk', 'new_evm_protocol'],
    probe: 'smart contract audit report centralization risk admin key single EOA upgrade privileged role finding',
  },
  {
    key: 'stablecoin_authority',
    label: 'Stablecoin issuers — mint, freeze and blocklist authority',
    kind: 'official', tier: 'official',
    segments: ['stablecoin_issuer'],
    probe: 'stablecoin issuer mint authority freeze blocklist contract admin upgrade attestation',
  },
  {
    key: 'rwa_tokenization',
    label: 'RWA and tokenization platforms — issuance and transfer-agent control',
    kind: 'official', tier: 'official',
    segments: ['rwa_tokenization'],
    probe: 'tokenization platform RWA issuance smart contract admin transfer agent upgradeable permissioned token',
  },
  {
    key: 'mainnet_launch',
    label: 'New EVM mainnets, L2s and contract deployments',
    kind: 'official', tier: 'official',
    segments: ['new_evm_protocol'],
    probe: 'new EVM mainnet L2 launch contracts deployed proxy admin multisig upgrade key announcement',
  },
  {
    key: 'incident_postmortem',
    label: 'Security postmortems — key and administrative compromise',
    kind: 'incident', tier: 'postmortem',
    segments: ['security_incident', 'public_admin_key_risk'],
    probe: 'postmortem incident report private key compromise admin key exploit privileged function protocol',
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
    probe: 'governance forum proposal discussion admin key upgrade multisig security council timelock protocol',
  },
  {
    key: 'safe_customers',
    label: 'Safe ecosystem — established multisig operators',
    kind: 'vendor', tier: 'vendor_page',
    segments: ['safe_user', 'dao_multisig_timelock'],
    probe: 'Safe wallet case study protocol treasury multisig signers manage contract admin',
  },
  {
    key: 'fireblocks_customers',
    label: 'Fireblocks customer stories — institutional custody operators',
    kind: 'vendor', tier: 'vendor_page',
    segments: ['exchange_custody', 'rwa_tokenization', 'stablecoin_issuer'],
    probe: 'https://www.fireblocks.com/customer-stories/',
  },
  {
    key: 'github_releases',
    label: 'GitHub releases — contract, access-control and deploy changes',
    kind: 'code', tier: 'official',
    segments: ['new_evm_protocol', 'governance_change'],
    probe: 'github release smart contract deployment access control owner upgrade proxy admin migration',
  },
  {
    key: 'regulator_announcements',
    label: 'Regulator and supervisory announcements',
    kind: 'regulator', tier: 'regulator',
    segments: ['stablecoin_issuer', 'rwa_tokenization', 'exchange_custody'],
    probe: 'regulator approval licence stablecoin tokenization custody issuer requirement supervisory announcement',
  },
  {
    key: 'founder_governance_change',
    label: 'Founder departures and key-holder transitions',
    kind: 'official', tier: 'reputable_press',
    segments: ['governance_change'],
    probe: 'protocol founder steps down departure handover multisig signer key holder governance transition',
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
  // Exposure — what actually goes wrong if the authority is misused.
  exposure: {
    value_at_risk_usd: number | null
    value_basis: string
    operational: string | null
    reputational: string | null
    regulatory: string | null
  }
  // 6. The likely buyer / governance owner.
  buyer: {
    role: string
    name: string | null
    why_this_person: string
    governance_owner: string | null
    identifiable: boolean
    public_channel: string | null
  }
  // 7. The specific AERSeal use case.
  aerseal_use_case: string
  // 8. The current alternative and likely switching friction.
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
        ? `Trigger is ${age} days old — not a current trigger`
        : 'No dated trigger with an evidence URL',
    )
  }

  const structuralTier = EVIDENCE_TIERS[d.structural_fit?.evidence_tier] ?? EVIDENCE_TIERS.none
  if (!d.structural_fit?.evidence_url || !structuralTier.corroborating) {
    failures.push('No structural-fit source from an authoritative surface')
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

export const FAIR_CHARACTERISATION_RULES = `FAIR CHARACTERISATION — non-negotiable:
- An upgradeable contract is NOT automatically insecure. Upgradeability is a deliberate design choice with real benefits. The question AERSeal asks is who controls the upgrade, not whether upgrades exist.
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
