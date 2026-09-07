// ============================================================================
// Aerpolice customer-discovery brain — wallet-signing product scope
// ============================================================================
// Replaces the earlier "any action-taking AI agent" framework (2026-09-02)
// per the AERPOLICE CUSTOMER-DISCOVERY APPROACH — CURRENT PRODUCT SCOPE spec
// (2026-09-07), which overrides all previous Aerpolice prospecting
// instructions wherever they conflict.
//
// PRODUCT DEFINITION: Aerpolice prevents an AI agent from signing an
// on-chain transaction outside the mandate its owner approved. It enforces
// policy at the wallet-signing boundary, before execution.
//
// CURRENT LIMITATION: wallet keys only. Broker API keys, exchange API keys,
// bank APIs, cards and fiat-payment credentials are future capabilities and
// are NOT current sales use cases — those companies are routed to
// pipeline_route "later_api_fiat", never scored as a current lead.
//
// THE FINAL RULE, which drives every gate below:
//   No wallet key, no Aerpolice lead.
//   No irreversible on-chain action, no Aerpolice lead.
//   No production evidence, no sales outreach.
// ============================================================================

// ── Gate 1 signals — what counts as agent-controlled wallet-signing ────────
export const WALLET_SIGNAL_TYPES = {
  agent_controlled_eoa: 'Agent-controlled EOA',
  agent_session_key: 'Agent session key',
  agent_smart_account_signer: 'Agent signer for a smart account',
  delegated_wallet_signing_authority: 'Delegated wallet-signing authority',
  mpc_threshold_share: 'MPC or threshold share used by an agent',
  agent_wallet_infra_provided: 'Agent wallet supplied by a wallet-infrastructure provider',
} as const
export type WalletSignalType = keyof typeof WALLET_SIGNAL_TYPES

// ── Gate 2 signals — irreversible on-chain financial actions ───────────────
export const IRREVERSIBLE_ACTION_TYPES = {
  filled_trading_order: { label: 'Filled on-chain trading order', weight: 90 },
  dex_swap: { label: 'DEX swap', weight: 90 },
  perp_position: { label: 'Perpetual position', weight: 95 },
  polymarket_trade: { label: 'Polymarket trade', weight: 85 },
  token_stablecoin_transfer: { label: 'Token or stablecoin transfer', weight: 80 },
  onchain_payout: { label: 'On-chain payout', weight: 85 },
  agent_to_agent_payment: { label: 'Agent-to-agent payment', weight: 80 },
  treasury_movement: { label: 'Treasury movement', weight: 95 },
  vault_deposit_withdrawal_reallocation: { label: 'Vault deposit, withdrawal or reallocation', weight: 90 },
  autonomous_liquidity_deployment: { label: 'Autonomous liquidity deployment', weight: 92 },
} as const
export type IrreversibleActionType = keyof typeof IRREVERSIBLE_ACTION_TYPES
export const IRREVERSIBLE_ACTION_KEYS = Object.keys(IRREVERSIBLE_ACTION_TYPES) as IrreversibleActionType[]

// Actions that FAIL Gate 2 even if wallet-controlled — operational impact
// alone is insufficient; the agent must control an irreversible on-chain
// financial action.
export const IRREVERSIBLE_ACTION_FAILS = [
  'Refund', 'Support action', 'Order edit', 'CRM update', 'Content publication',
  'Code change', 'Infrastructure deployment', 'Security remediation',
  'Recommendation awaiting human execution',
]

// ── Approved segments ────────────────────────────────────────────────────────
export const AERPOLICE_SEGMENTS = {
  s1_trading: {
    label: 'S1 Trading',
    description: 'On-chain trading agents (primary segment) — Hyperliquid agents/vault operators, Polymarket trading agents, DEX/on-chain perpetual-trading agents, autonomous DeFi strategy agents, AI-controlled liquidity-management, on-chain market-making, agents managing funded smart accounts. Excludes centralized-exchange bots operating through API keys.',
  },
  s2_treasury_fund: {
    label: 'S2 Treasury',
    description: 'Crypto-native treasury and fund agents — autonomous protocol-treasury agents, AI-curated vaults, DeFi portfolio-management agents, fund-rebalancing agents, stablecoin treasury agents, agent-owned wallets, autonomous yield/liquidity strategies. The agent must EXECUTE transactions — a dashboard, recommendation engine or human-operated treasury does not qualify.',
  },
  s3_wallet_infra: {
    label: 'S3 Wallet Infra',
    description: 'Agent-wallet infrastructure — companies that create, custody or provide signing infrastructure for AI-agent wallets. NOT automatically direct customers; many already provide a policy engine. Classify as: learning interview, integration opportunity, OEM opportunity, possible customer with a verified residual gap, or competitor. Never pitch a replacement unless evidence establishes a capability Aerpolice provides that their existing system does not.',
  },
} as const
export type AerpoliceSegmentKey = keyof typeof AERPOLICE_SEGMENTS
export const AERPOLICE_SEGMENT_KEYS = Object.keys(AERPOLICE_SEGMENTS) as AerpoliceSegmentKey[]
/** The literal segment label strings used in lib/aerpolice-customers.ts, kept identical so a discovered lead and a curated row are directly comparable. */
export type AerpoliceSegmentLabel = 'S1 Trading' | 'S2 Treasury' | 'S3 Wallet Infra'

// ── Timing triggers ──────────────────────────────────────────────────────────
// A dated reason for outreach, preferably from the past 30 days, no older
// than 90. Funding alone is not sufficient — it must connect to wallet-
// signing or irreversible execution.
export const AERPOLICE_TRIGGERS = {
  production_or_mainnet_launch: { label: 'Production or mainnet launch', weight: 90 },
  agent_wallets_added: { label: 'Addition of agent wallets', weight: 92 },
  new_dex_hyperliquid_polymarket_integration: { label: 'New DEX, Hyperliquid or Polymarket integration', weight: 85 },
  autonomous_trading_launch: { label: 'Launch of autonomous trading', weight: 90 },
  new_stablecoin_agent_payment_capability: { label: 'New stablecoin or agent-payment capability', weight: 82 },
  treasury_management_expansion: { label: 'Expansion into treasury management', weight: 85 },
  funding_tied_to_agent_execution: { label: 'Funding tied to agent execution', weight: 60 },
  wallet_or_signer_migration: { label: 'Wallet or signer migration', weight: 85 },
  key_leak_drained_wallet_unintended_tx: { label: 'Key leak, drained wallet or unintended transaction', weight: 100 },
  paused_delayed_wallet_architecture: { label: 'Paused or delayed initiative caused by wallet architecture', weight: 90 },
  spending_limit_signing_policy_change: { label: 'Meaningful change to spending limits or signing policies', weight: 78 },
} as const
export type AerpoliceTrigger = keyof typeof AERPOLICE_TRIGGERS
export const AERPOLICE_TRIGGER_KEYS = Object.keys(AERPOLICE_TRIGGERS) as AerpoliceTrigger[]
export const TRIGGER_PREFERRED_FRESH_DAYS = 30
export const TRIGGER_STALE_DAYS = 90

// ── Evidence tiers ────────────────────────────────────────────────────────────
export const EVIDENCE_TIERS = {
  onchain_verified: { label: 'Verified on-chain transaction history / block explorer', score: 100, corroborating: true },
  official_docs: { label: "Product documentation, SDK, wallet/signer docs, GitHub release, changelog, or the company's own Terms of Service", score: 90, corroborating: true },
  founder_technical_post: { label: 'Founder technical post (blog, forum, published architecture writeup)', score: 80, corroborating: true },
  reputable_press: { label: 'Established trade/crypto press or funding announcement tied to production expansion', score: 65, corroborating: true },
  aggregator_directory: { label: 'Directory, dashboard listing or aggregator', score: 35, corroborating: false },
  social: { label: 'Social media post (signal only)', score: 30, corroborating: false },
  none: { label: 'No source', score: 0, corroborating: false },
} as const
export type EvidenceTier = keyof typeof EVIDENCE_TIERS
export const EVIDENCE_TIER_KEYS = Object.keys(EVIDENCE_TIERS) as EvidenceTier[]

// ── Pipeline routing ─────────────────────────────────────────────────────────
export const PIPELINE_ROUTES = {
  direct_sales: 'Direct sales',
  design_partner: 'Design partner',
  learning_oem: 'Learning/OEM',
  later_api_fiat: 'Later — API keys and fiat rails',
  monitoring: 'Monitoring',
  rejected: 'Rejected',
} as const
export type PipelineRoute = keyof typeof PIPELINE_ROUTES

export const REJECTION_REASONS = {
  no_wallet_key: 'No wallet key — the agent does not use or control an on-chain private key, key share, session key or smart-account signer',
  no_irreversible_action: 'No irreversible on-chain financial action — operational impact alone is insufficient',
  no_production_evidence: 'No production evidence — testnet-only, hackathon, demo, roadmap or abandoned',
  inactive: 'Company or product appears inactive or abandoned',
} as const
export type RejectionReason = keyof typeof REJECTION_REASONS

// ── Later — API keys & fiat rails ────────────────────────────────────────────
// Agents using broker APIs, exchange APIs, cards, banking APIs or fiat-
// payment systems are a FUTURE Aerpolice capability, not a current sales use
// case. Routed separately, never scored as a current lead.
export function isApiOrFiatRailCandidate(d: Pick<AerpoliceDossier, 'api_fiat_rail_only'>): boolean {
  return d.api_fiat_rail_only === true
}

// ── The prospect dossier ────────────────────────────────────────────────────
export interface AerpoliceDossier {
  organization: string
  website: string
  segment: AerpoliceSegmentLabel
  agent_product: string
  // Gate 1 — wallet key.
  wallet_key: {
    status: 'Yes' | 'No' | 'Unknown'
    evidence: string
    evidence_url: string | null
    evidence_tier: EvidenceTier
    signal_type: WalletSignalType | null
  }
  // Gate 2 — irreversible action.
  irreversible: {
    status: 'Yes' | 'No' | 'Unknown'
    action_type: IrreversibleActionType | null
    action: string
    evidence_url: string | null
    evidence_tier: EvidenceTier
  }
  // Gate 3 — live production.
  production_confirmed: boolean
  production_evidence: string
  // True when the agent's real-world execution rail is a broker/exchange
  // API key, card, bank API or fiat rail rather than a wallet — routes to
  // "later_api_fiat" regardless of how the other gates read.
  api_fiat_rail_only: boolean
  // Dated reason for outreach.
  trigger: {
    type: AerpoliceTrigger | null
    what_happened: string
    date: string | null
    evidence_url: string | null
    evidence_tier: EvidenceTier
  }
  // Past loss, near-miss or stalled initiative — a dedicated field per the
  // spec. Literally "No public evidence found." when nothing is documented;
  // never invent an incident.
  past_loss: {
    description: string
    evidence_url: string | null
  }
  // What's publicly documented about controls today.
  current_controls: string
  // The unknown or residual gap to investigate — NOT a claim that a gap is
  // confirmed. For S3 wallet-infra companies this is what decides whether
  // there's a genuine possible-customer angle versus pure learning/OEM.
  gap_to_investigate: string
  // Aerpolice integration fit rationale (feeds the score, doesn't self-score).
  integration_fit_rationale: string
  buyer: {
    target: string
    contact_path: string
    reachable: boolean
  }
  first_question: string
  // Recommended pipeline route — the model's classification judgment, sanity-
  // checked and possibly overridden by evaluateGate() based on the hard gates.
  recommended_route: PipelineRoute
  route_rationale: string
  // Epistemics — kept strictly separate.
  facts: string[]
  inferences: string[]
  unknowns: string[]
  project_active: boolean
  team_public: boolean
  rejection_flags: RejectionReason[]
}

// ── Scoring ──────────────────────────────────────────────────────────────────
// Calculated ONLY after all three gates pass — Wallet Key = Yes, Irreversible
// = Yes, production activity supported. Six dimensions in their native point
// range, matching lib/aerpolice-customers.ts's curated-workbook fields
// exactly so a live-discovered lead and a curated row are directly
// comparable: Wallet 25, Irreversible 20, Trigger 20, Integration fit 15,
// Reachability 15, Evidence 5 = 100.
export const TIER_1_MIN = 85
export const TIER_2_MIN = 70

export interface ScoreBreakdown {
  walletScore: number
  irreversibleScore: number
  triggerScore: number
  integrationScore: number
  reachabilityScore: number
  evidenceScore: number
  totalScore: number
  tier: 1 | 2 | 3
  notes: string[]
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

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

/**
 * scoreProspect is only meaningful when both gates read "Yes" and production
 * is confirmed — callers should check that via evaluateGate first. Called on
 * an ungated dossier it still returns a well-formed breakdown (0s where the
 * gates fail) so it's safe to call unconditionally.
 */
export function scoreProspect(d: AerpoliceDossier, now = new Date()): ScoreBreakdown {
  const notes: string[] = []
  const gatesPass = d.wallet_key?.status === 'Yes' && d.irreversible?.status === 'Yes' && d.production_confirmed === true

  if (!gatesPass) {
    notes.push('Not scored — Wallet Key, Irreversible and production-confirmed gates must all pass first.')
    return { walletScore: 0, irreversibleScore: 0, triggerScore: 0, integrationScore: 0, reachabilityScore: 0, evidenceScore: 0, totalScore: 0, tier: 3, notes }
  }

  // ── Wallet-signing authority (0-25) ───────────────────────────────────
  const walletTier = EVIDENCE_TIERS[d.wallet_key.evidence_tier] ?? EVIDENCE_TIERS.none
  let walletScore = walletTier.corroborating ? 25 : 15
  if (!d.wallet_key.evidence_url) walletScore -= 5
  walletScore = clamp(walletScore, 0, 25)

  // ── Irreversibility and capital exposure (0-20) ───────────────────────
  const actionWeight = d.irreversible.action_type ? IRREVERSIBLE_ACTION_TYPES[d.irreversible.action_type]?.weight ?? 70 : 60
  const irreversibleTier = EVIDENCE_TIERS[d.irreversible.evidence_tier] ?? EVIDENCE_TIERS.none
  let irreversibleScore = 20 * (actionWeight / 100)
  if (!irreversibleTier.corroborating) irreversibleScore -= 5
  irreversibleScore = clamp(Math.round(irreversibleScore), 0, 20)

  // ── Trigger or demonstrated pain (0-20) ───────────────────────────────
  const age = daysSince(d.trigger?.date, now)
  let triggerBase: number
  if (age == null) {
    triggerBase = 3
    notes.push('Trigger has no verifiable date — recency scored as weak.')
  } else if (age <= TRIGGER_PREFERRED_FRESH_DAYS) triggerBase = 20
  else if (age <= TRIGGER_STALE_DAYS) triggerBase = 12
  else if (age <= 270) triggerBase = 5
  else { triggerBase = 2; notes.push('Trigger is well past the preferred 30/90-day window.') }
  // A dedicated, evidenced past loss/near-miss is itself "demonstrated pain"
  // per the spec's Timing Triggers section, and can substitute for a fresh
  // dated event.
  const hasPastLoss = !!d.past_loss?.evidence_url && !/no public evidence/i.test(d.past_loss.description || '')
  const triggerWeight = d.trigger?.type ? AERPOLICE_TRIGGERS[d.trigger.type]?.weight ?? 60 : 50
  let triggerScore = triggerBase * (0.7 + 0.3 * (triggerWeight / 100))
  if (hasPastLoss) triggerScore += 3
  triggerScore = clamp(Math.round(triggerScore), 0, 20)

  // ── Aerpolice integration fit (0-15) ──────────────────────────────────
  let integrationScore = 8
  if (d.gap_to_investigate && d.gap_to_investigate.trim().length > 15 && !/^gap not confirmed$/i.test(d.gap_to_investigate.trim())) {
    integrationScore += 5
  }
  if (d.integration_fit_rationale && d.integration_fit_rationale.trim().length > 15) integrationScore += 2
  if (d.segment === 's3_wallet_infra' as unknown as AerpoliceSegmentLabel) {
    // S3 rows are structurally not automatically customers — see
    // isWalletInfraLearningOnly below, which the gate applies on top.
  }
  integrationScore = clamp(integrationScore, 0, 15)

  // ── Founder/CTO reachability (0-15) ───────────────────────────────────
  let reachabilityScore = 5
  if (d.buyer?.reachable) reachabilityScore += 6
  if (d.buyer?.contact_path && d.buyer.contact_path.trim().length > 5) reachabilityScore += 4
  if (d.team_public) reachabilityScore += 3
  reachabilityScore = clamp(reachabilityScore, 0, 15)

  // ── Evidence quality (0-5) ────────────────────────────────────────────
  const facts = (d.facts || []).length
  const inferences = (d.inferences || []).length
  const factRatio = facts + inferences === 0 ? 0 : facts / (facts + inferences)
  let evidenceScore = walletTier.score * 0.02 + irreversibleTier.score * 0.02 + factRatio * 1
  evidenceScore = clamp(Math.round(evidenceScore), 0, 5)

  const totalScore = clamp(
    walletScore + irreversibleScore + triggerScore + integrationScore + reachabilityScore + evidenceScore,
    0, 100,
  )
  const tier: 1 | 2 | 3 = totalScore >= TIER_1_MIN ? 1 : totalScore >= TIER_2_MIN ? 2 : 3

  return { walletScore, irreversibleScore, triggerScore, integrationScore, reachabilityScore, evidenceScore, totalScore, tier, notes }
}

// ── Gate ──────────────────────────────────────────────────────────────────────
// No wallet key, no lead. No irreversible action, no lead. No production
// evidence, no sales outreach — but unlike a hard reject, "no production yet"
// and "gate status Unknown" both route to Monitoring/research-hold rather
// than being discarded, matching how lib/aerpolice-customers.ts treats its
// two "Research needed" rows (unscored, tier "Research hold", not rejected).
export type AerpoliceNextAction =
  | 'Contact now; request a 20-minute architecture interview.'
  | 'Interview first; do not pitch until a residual gap is confirmed.'
  | 'Learning interview only; not a near-term replacement lead.'
  | 'Revisit later — API keys / fiat rails not yet supported.'
  | 'Do not pitch; verify wallet-key and irreversibility gates first.'
  | 'Do not send.'

export interface GateResult {
  route: PipelineRoute
  scored: boolean
  tierLabel: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Research hold' | 'Rejected'
  nextAction: AerpoliceNextAction
  rejections: RejectionReason[]
  notes: string[]
}

export function evaluateGate(d: AerpoliceDossier, score: ScoreBreakdown, now = new Date()): GateResult {
  const notes: string[] = []
  const rejections: RejectionReason[] = []

  if (d.project_active === false) {
    rejections.push('inactive')
    return { route: 'rejected', scored: false, tierLabel: 'Rejected', nextAction: 'Do not send.', rejections, notes: ['Company or product is inactive.'] }
  }

  // "Later — API keys & fiat rails" — a future capability, never a current lead.
  if (isApiOrFiatRailCandidate(d) && d.wallet_key?.status !== 'Yes') {
    return {
      route: 'later_api_fiat', scored: false, tierLabel: 'Rejected',
      nextAction: 'Revisit later — API keys / fiat rails not yet supported.',
      rejections: ['no_wallet_key'], notes: ['Execution rail is a broker/exchange API key, card or fiat rail, not a wallet — Aerpolice does not support this today.'],
    }
  }

  if (d.wallet_key?.status === 'No') {
    rejections.push('no_wallet_key')
    return { route: 'rejected', scored: false, tierLabel: 'Rejected', nextAction: 'Do not send.', rejections, notes: ['No wallet key: the agent does not sign on-chain transactions.'] }
  }
  if (d.wallet_key?.status === 'Yes' && d.irreversible?.status === 'No') {
    rejections.push('no_irreversible_action')
    return { route: 'rejected', scored: false, tierLabel: 'Rejected', nextAction: 'Do not send.', rejections, notes: ['Wallet key confirmed, but the agent cannot execute an irreversible on-chain action.'] }
  }

  // Either gate genuinely unknown — a research hold, not a rejection. Do not
  // convert an assumption into Yes; do not score or pitch until confirmed.
  if (d.wallet_key?.status === 'Unknown' || d.irreversible?.status === 'Unknown') {
    return {
      route: 'monitoring', scored: false, tierLabel: 'Research hold',
      nextAction: 'Do not pitch; verify wallet-key and irreversibility gates first.',
      rejections: [], notes: ['Wallet-key or irreversible-action status is Unknown — cannot score or route until confirmed.'],
    }
  }

  // Both gates are Yes past this point. Production confirmation gates
  // scoring specifically, per "A prospect can be scored only when Wallet Key
  // = Yes, Irreversible = Yes and production activity is supported."
  if (!d.production_confirmed) {
    return {
      route: 'monitoring', scored: false, tierLabel: 'Research hold',
      nextAction: 'Do not pitch; verify wallet-key and irreversibility gates first.',
      rejections: [], notes: ['Both gates pass, but production/live-fund usage is not yet confirmed (testnet, hackathon, demo, roadmap, or no usage evidence).'],
    }
  }

  // S3 Wallet Infra is not automatically a direct customer — route to
  // Learning/OEM unless the dossier itself asserts a verified residual gap
  // AND an outreach-eligible route (direct_sales or design_partner).
  const isWalletInfra = d.segment === 'S3 Wallet Infra'
  const modelWantsOutreach = d.recommended_route === 'direct_sales' || d.recommended_route === 'design_partner'
  const hasVerifiedResidualGap =
    !!d.gap_to_investigate && d.gap_to_investigate.trim().length > 15 && !/^gap not confirmed$/i.test(d.gap_to_investigate.trim())

  if (isWalletInfra && !(modelWantsOutreach && hasVerifiedResidualGap)) {
    notes.push('Agent-wallet infrastructure provider — routed to Learning/OEM rather than a direct customer lead per segment rules.')
    return { route: 'learning_oem', scored: true, tierLabel: scoreProspect(d, now).tier === 1 ? 'Tier 1' : 'Tier 2', nextAction: 'Learning interview only; not a near-term replacement lead.', rejections: [], notes }
  }

  const age = daysSince(d.trigger?.date, now)
  const hasCurrentTrigger =
    !!d.trigger?.what_happened && d.trigger.what_happened.trim().length > 10 &&
    !!d.trigger.evidence_url && age !== null && age <= TRIGGER_STALE_DAYS
  const triggerTier = EVIDENCE_TIERS[d.trigger?.evidence_tier] ?? EVIDENCE_TIERS.none

  const tierNum = score.tier
  const tierLabelStr: 'Tier 1' | 'Tier 2' | 'Tier 3' = tierNum === 1 ? 'Tier 1' : tierNum === 2 ? 'Tier 2' : 'Tier 3'

  if (d.recommended_route === 'design_partner' || (!hasCurrentTrigger && !d.buyer?.reachable)) {
    return {
      route: 'design_partner', scored: true, tierLabel: tierLabelStr,
      nextAction: 'Interview first; do not pitch until a residual gap is confirmed.',
      rejections: [], notes: [...notes, hasCurrentTrigger ? 'Design-partner motion per profiling.' : 'Product/buyer still early — design-partner motion, not direct sales.'],
    }
  }

  if (hasCurrentTrigger && triggerTier.corroborating && d.buyer?.reachable) {
    const contactNow = age !== null && age <= TRIGGER_PREFERRED_FRESH_DAYS
    return {
      route: 'direct_sales', scored: true, tierLabel: tierLabelStr,
      nextAction: contactNow
        ? 'Contact now; request a 20-minute architecture interview.'
        : 'Interview first; do not pitch until a residual gap is confirmed.',
      rejections: [], notes,
    }
  }

  return {
    route: 'design_partner', scored: true, tierLabel: tierLabelStr,
    nextAction: 'Interview first; do not pitch until a residual gap is confirmed.',
    rejections: [], notes: [...notes, 'No corroborated current trigger or reachable buyer yet — treat as a design-partner interview target.'],
  }
}

// ── Outreach seed — Direct-sales "contact now" prospects only ───────────────
// The first contact must seek their experience, not pitch Aerpolice.
export interface OutreachSeed {
  story_seeking_question: string
  linkedin_note: string
}

export function validateOutreachSeed(s: Partial<OutreachSeed> | null | undefined): string[] {
  const problems: string[] = []
  if (!s) return ['No outreach seed produced']
  if (!s.story_seeking_question || !s.story_seeking_question.includes('?')) problems.push('Missing story-seeking question')
  if (!s.linkedin_note || s.linkedin_note.trim().length === 0) problems.push('Missing LinkedIn connection note')
  else if (s.linkedin_note.length > 200) problems.push('LinkedIn note over ~180 characters (spec: stay below approximately 180)')
  const text = `${s.story_seeking_question} ${s.linkedin_note}`.toLowerCase()
  for (const phrase of BANNED_OUTREACH_PHRASES) {
    if (text.includes(phrase)) problems.push(`Banned phrase: "${phrase}"`)
  }
  return problems
}

export const BANNED_OUTREACH_PHRASES = [
  'i\'m impressed by what you\'re building',
  'your innovative platform',
  'we revolutionize',
  'aerpolice is the future',
  'i hope this finds you well',
  'i wanted to reach out',
  'book a demo',
  'schedule a demo',
  'vulnerable',
  'exploit',
]

// ── Discovery discipline (injected into research prompts) ──────────────────
export const QUALIFICATION_GATE_RULES = `MANDATORY QUALIFICATION GATES — apply before researching contacts, calculating a score or drafting outreach.

GATE 1 — WALLET KEY: does the AI agent itself use or control an on-chain private key, key share, session key, smart-account signer or wallet-signing system Aerpolice could govern? Mark Yes only when reliable evidence shows the agent can sign blockchain transactions.
Examples that PASS: ${Object.values(WALLET_SIGNAL_TYPES).join('; ')}.
Examples that FAIL: broker or centralized-exchange API key; banking or payment API; card credential; fiat account; human manually signs every transaction; "connect wallet" with no evidence of agent signing; wallet infrastructure with no AI-agent use case.
Unknown stays Unknown. Never convert an assumption into Yes.

GATE 2 — IRREVERSIBLE ACTION: can the agent use that wallet authority to execute a completed action that cannot practically be reversed?
Actions that PASS: ${IRREVERSIBLE_ACTION_KEYS.map(k => IRREVERSIBLE_ACTION_TYPES[k].label).join('; ')}.
Actions that FAIL: ${IRREVERSIBLE_ACTION_FAILS.join('; ')}. Operational impact alone is insufficient — the agent must control an irreversible on-chain financial action.

GATE 3 — LIVE PRODUCTION: confirm the product uses real wallets or funds in production. Reject or hold: testnet-only systems, hackathon projects, demos and tutorials, roadmap announcements, abandoned projects, agents that only recommend transactions, products with no evidence of current usage.

A prospect can be scored only when Wallet Key = Yes, Irreversible = Yes and production activity is supported. NO WALLET KEY, NO AERPOLICE LEAD. NO IRREVERSIBLE ON-CHAIN ACTION, NO AERPOLICE LEAD. NO PRODUCTION EVIDENCE, NO SALES OUTREACH.`

export const SEGMENT_RULES = `APPROVED SEGMENTS:
${AERPOLICE_SEGMENT_KEYS.map(k => `- ${k} (${AERPOLICE_SEGMENTS[k].label}): ${AERPOLICE_SEGMENTS[k].description}`).join('\n')}

Do not present a wallet-infrastructure provider (S3) as an automatic direct customer even when its own agent passes both gates — classify it as a learning interview, integration opportunity, OEM opportunity, possible customer with a verified residual gap, or competitor.`

export const RESEARCH_METHOD_RULES = `RESEARCH METHOD — action-first reverse discovery: Recent event → company → live agent → wallet signer → irreversible action → current controls → unknown or gap → responsible buyer.

Do not qualify a company from a news article alone. Find primary evidence for the wallet-signing flow AND the irreversible action — product documentation/SDKs, wallet/signer documentation, GitHub releases/changelogs, Hyperliquid/Polymarket agent ecosystems, DEX/DeFi integration announcements, on-chain agent dashboards, agent-wallet and x402 documentation, security incidents/postmortems, funding announcements tied to production expansion, founder technical posts, Terms of Service describing signing authority, and verified on-chain transaction history.`

export const PAST_LOSS_RULES = `PAST LOSS OR STALLED INITIATIVE — a dedicated field. Capture documented examples: drained agent wallet, leaked key, agent manipulated into transferring funds, unexpected trade or position, wallet migration that paused a product, strategy stopped because permissions were too broad, incident that forced transactions to be disabled. Include the evidence URL. If nothing is publicly documented, write exactly "No public evidence found." Never invent an incident.`

export const EPISTEMIC_RULES = `FACT / INFERENCE / UNKNOWN — keep these three strictly separate:
- FACT: stated on an authoritative source you can cite with a URL.
- INFERENCE: a reasoned conclusion drawn from facts, explicitly labelled as such.
- UNKNOWN: something that genuinely matters and could not be established. An honest unknown beats a confident guess. Unknown remains Unknown — never convert an assumption into Yes on either gate.`

export const OUTREACH_TONE_RULES = `OUTREACH APPROACH — the objective is a 20-minute discovery interview with a founder, CTO, wallet lead or protocol-security owner. The first contact must SEEK their experience, not pitch Aerpolice.

LinkedIn connection notes: stay below approximately 180 characters; mention one verified recent event; avoid feature lists and demo requests; avoid claiming their system is vulnerable; avoid asking complicated technical questions.

After acceptance, ask what has already happened or almost happened — story first, Aerpolice only after they describe a relevant signing-control problem. Preferred question style: "What is the largest thing your agent can do with funds before a human notices?" / "Has an agent ever opened a position that surprised the operator after execution?" / "Which real transaction caused you to tighten an agent's wallet permissions?" / "What failure scenario has been hardest to contain without stopping the agent?" / "During your wallet migration, what control problem consumed the most time?"

Banned: ${BANNED_OUTREACH_PHRASES.map(p => `"${p}"`).join(', ')}.`

export function walletSignalReference(): string {
  return Object.entries(WALLET_SIGNAL_TYPES).map(([k, v]) => `- ${k}: ${v}`).join('\n')
}
export function irreversibleActionReference(): string {
  return IRREVERSIBLE_ACTION_KEYS.map(k => `- ${k}: ${IRREVERSIBLE_ACTION_TYPES[k].label}`).join('\n')
}
export function segmentsReference(): string {
  return AERPOLICE_SEGMENT_KEYS.map(k => `- ${k}: ${AERPOLICE_SEGMENTS[k].label} — ${AERPOLICE_SEGMENTS[k].description}`).join('\n')
}
export function triggersReference(): string {
  return AERPOLICE_TRIGGER_KEYS.map(k => `- ${k}: ${AERPOLICE_TRIGGERS[k].label}`).join('\n')
}
export function evidenceTiersReference(): string {
  return EVIDENCE_TIER_KEYS.map(k => `- ${k}: ${EVIDENCE_TIERS[k].label}${EVIDENCE_TIERS[k].corroborating ? '' : '  [DISCOVERY ONLY — cannot corroborate]'}`).join('\n')
}
export function routesReference(): string {
  return Object.entries(PIPELINE_ROUTES).map(([k, v]) => `- ${k}: ${v}`).join('\n')
}
export function tierLabel(tier: 1 | 2 | 3): string {
  return tier === 1 ? 'Tier 1' : tier === 2 ? 'Tier 2' : 'Tier 3'
}
