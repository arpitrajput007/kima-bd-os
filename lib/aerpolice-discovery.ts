// ============================================================================
// Aerpolice customer-discovery brain
// ============================================================================
// Aerpolice is an independent governance layer for AI agents that take
// consequential actions: it binds every agent to an identity, evaluates a
// policy before the action runs, allows or blocks it, escalates exceptions to
// a human, supports emergency termination, and produces signed, tamper-
// evident audit evidence. It is NOT an LLM content filter, a chatbot
// guardrail, an observability dashboard, an IAM replacement, an agent-
// building framework, or a general cybersecurity product.
//
// The one rule that matters more than any other: NO EXTERNAL ACTION, NO LEAD.
// A company whose agent only answers, searches, drafts or summarizes is not a
// candidate no matter how well-funded or well-known it is. We only go looking
// for organisations whose agent can already reach outside the model and do
// something — issue a refund, move money, change access, ship code, touch
// infrastructure — and we require a primary source that proves it.
//
// SCORE_IS_COMPUTED_IN_CODE, same discipline as lib/aerseal-discovery.ts: the
// research model fills in structured dossier fields, scoreProspect() below
// turns those into the six-dimension total. The model never invents the
// number.
// ============================================================================

// ── The mandatory qualification gate ────────────────────────────────────────
// A company cannot become a lead unless public evidence shows its agent can
// perform at least one of these. `weight` (0-100) is how consequential the
// action is if misused — it drives the action-fit and consequence scores.
export const EXTERNAL_ACTIONS = {
  issue_refund: { label: 'Issue a refund', weight: 55 },
  change_cancel_order: { label: 'Change or cancel an order', weight: 50 },
  make_approve_payment: { label: 'Make or approve a payment', weight: 95 },
  pay_invoice: { label: 'Pay an invoice', weight: 90 },
  provision_revoke_access: { label: 'Provision or revoke access', weight: 85 },
  reset_password: { label: 'Reset a password', weight: 70 },
  modify_account: { label: 'Modify an account', weight: 60 },
  update_system_of_record: { label: 'Update CRM, ERP, EHR or insurance systems', weight: 65 },
  execute_code: { label: 'Execute code or scripts', weight: 90 },
  create_merge_pr: { label: 'Create or merge pull requests', weight: 75 },
  deploy_software: { label: 'Deploy software', weight: 92 },
  modify_cloud_infra: { label: 'Modify cloud infrastructure', weight: 95 },
  contain_endpoint: { label: 'Contain an endpoint', weight: 80 },
  remediate_vulnerability: { label: 'Remediate a vulnerability', weight: 85 },
  submit_insurance_claim: { label: 'Submit an insurance claim or authorization', weight: 80 },
  execute_trade: { label: 'Execute a trade', weight: 98 },
  use_standing_api_credentials: { label: 'Use standing API credentials', weight: 60 },
  call_write_mcp_tool: { label: 'Call a write-capable MCP tool', weight: 70 },
} as const

export type ExternalAction = keyof typeof EXTERNAL_ACTIONS
export const EXTERNAL_ACTION_KEYS = Object.keys(EXTERNAL_ACTIONS) as ExternalAction[]

// ── Target segments ─────────────────────────────────────────────────────────
export const AERPOLICE_SEGMENTS = {
  payments: { label: 'Payments / agentic commerce', baseRelevance: 100 },
  finance: { label: 'Finance / AP-AR / treasury agents', baseRelevance: 95 },
  security: { label: 'Security operations agents', baseRelevance: 90 },
  insurance: { label: 'Insurance claims / underwriting agents', baseRelevance: 90 },
  healthcare: { label: 'Healthcare / clinical-ops agents', baseRelevance: 90 },
  infrastructure: { label: 'Cloud / DevOps / infrastructure agents', baseRelevance: 85 },
  it_ops: { label: 'IT service management agents', baseRelevance: 80 },
  ecommerce: { label: 'Ecommerce / customer-support agents', baseRelevance: 80 },
} as const

export type AerpoliceSegment = keyof typeof AERPOLICE_SEGMENTS
export const AERPOLICE_SEGMENT_KEYS = Object.keys(AERPOLICE_SEGMENTS) as AerpoliceSegment[]

// ── Company-size band ────────────────────────────────────────────────────────
// The spec's priority profile: founder-led, ~10-500 employees, recently
// funded, pilot-to-production. Companies over ~1,000 employees are excluded
// by default unless a highly specific trigger AND a reachable product owner
// justify the exception — see evaluateGate.
export const COMPANY_SIZE_BANDS = {
  micro: { label: 'Under 10 employees', reachabilityBase: 16 },
  startup: { label: '10-500 employees (priority band)', reachabilityBase: 20 },
  mid_market: { label: '501-1000 employees', reachabilityBase: 12 },
  enterprise_large: { label: 'Over 1,000 employees', reachabilityBase: 4 },
  unknown: { label: 'Size not established', reachabilityBase: 10 },
} as const

export type CompanySizeBand = keyof typeof COMPANY_SIZE_BANDS

// ── Evidence authority tiers ────────────────────────────────────────────────
// Social posts, directories and news aggregators can point at a lead but can
// never be the sole evidence when an official source is available.
export const EVIDENCE_TIERS = {
  official: { label: 'Official docs, changelog, blog, newsroom, security/trust center, API reference', score: 95, corroborating: true },
  marketplace: { label: 'Marketplace listing (Atlassian, Zendesk, Shopify, MCP Registry)', score: 85, corroborating: true },
  reputable_press: { label: 'Established trade press (TechCrunch, CRN, FinTech Futures, Healthcare IT News, etc.)', score: 65, corroborating: true },
  aggregator_directory: { label: 'Directory or aggregator (YC company page, Crunchbase, Product Hunt, Show HN, GitHub topic)', score: 35, corroborating: false },
  social: { label: 'Social media post (signal only)', score: 30, corroborating: false },
  none: { label: 'No source', score: 0, corroborating: false },
} as const

export type EvidenceTier = keyof typeof EVIDENCE_TIERS
export const EVIDENCE_TIER_KEYS = Object.keys(EVIDENCE_TIERS) as EvidenceTier[]

// ── Trigger dictionary — "action-expansion events" ─────────────────────────
export const AERPOLICE_TRIGGERS = {
  incident_unintended_actions: { label: 'Incident: unintended actions, excessive permissions, leaked credentials or prompt injection', weight: 100 },
  pilot_to_production: { label: 'Pilot moved into production', weight: 95 },
  agent_ga_launch: { label: 'Agent launched or moved to general availability', weight: 92 },
  enterprise_customer_deployment: { label: 'Enterprise customer deployment announced', weight: 90 },
  security_compliance_governance_launch: { label: 'Security, compliance or governance feature launch', weight: 85 },
  refund_payment_purchasing_capability: { label: 'Refund, payment or purchasing capability added', weight: 85 },
  automated_remediation_capability: { label: 'Automated remediation capability added', weight: 82 },
  new_write_integration: { label: 'New write-capable integration or tool connector', weight: 82 },
  healthcare_insurance_workflow: { label: 'New healthcare or insurance workflow', weight: 82 },
  answering_to_resolving: { label: 'Expansion from answering into resolving', weight: 80 },
  browser_computer_use_capability: { label: 'Browser or computer-use capability added', weight: 78 },
  new_api_credentials_delegated_access: { label: 'New API credentials or delegated access', weight: 78 },
  new_mcp_server_or_tool: { label: 'New MCP server or tool connector', weight: 75 },
  hiring_agent_governance: { label: 'Hiring for agent security, trust, IAM, governance or infrastructure', weight: 65 },
  funding_tied_to_agent_expansion: { label: 'Funding round tied to agent-product expansion', weight: 55 },
} as const

export type AerpoliceTrigger = keyof typeof AERPOLICE_TRIGGERS
export const AERPOLICE_TRIGGER_KEYS = Object.keys(AERPOLICE_TRIGGERS) as AerpoliceTrigger[]

// ── Recommended sales motion ────────────────────────────────────────────────
// Aerpolice does not assume it must replace a prospect's existing controls —
// see REPLACEMENT_VS_COMPLEMENT_RULES below.
export const RECOMMENDED_MOTIONS = {
  direct_design_partner_pilot: 'Direct design-partner pilot',
  customer_deployment: 'Customer deployment',
  oem_integration: 'OEM integration',
  complementary_governance_layer: 'Complementary governance layer',
  architecture_discovery: 'Architecture discovery',
  partnership: 'Partnership',
  monitor: 'Monitor',
  reject: 'Reject',
} as const

export type RecommendedMotion = keyof typeof RECOMMENDED_MOTIONS

// ── Rejection rules ──────────────────────────────────────────────────────────
export const REJECTION_REASONS = {
  no_action_evidence: 'No verified external action — agent is read-only (chatbot, search, content, analytics copilot)',
  too_large_no_trigger: 'Over ~1,000 employees with no highly specific current trigger and reachable product owner',
  inactive: 'Company or agent product appears inactive or discontinued',
  equivalent_offering: 'Already offers substantially equivalent identity/policy/audit functionality — classify as partner or competitor, not customer',
} as const

export type RejectionReason = keyof typeof REJECTION_REASONS

// ── OEM / Partner Watchlist — separate pipeline, separate motion ───────────
// MCP vendors, agent framework builders, connector providers and tool
// publishers are not customer leads even when their own agent passes the
// qualification gate — they get routed here instead of into `leads`, with no
// outreach from the direct-customer pipeline. They are revisited only on one
// of the events in WATCHLIST_REVISIT_TRIGGERS below; a fit-but-quiet OEM/
// partner otherwise just sits in the watchlist.
export const OEM_PARTNER_MOTIONS: readonly RecommendedMotion[] = ['oem_integration', 'partnership']

export function isOemOrPartnerCandidate(d: Pick<AerpoliceDossier, 'recommended_motion' | 'rejection_flags'>): boolean {
  return OEM_PARTNER_MOTIONS.includes(d.recommended_motion) || (d.rejection_flags || []).includes('equivalent_offering')
}

export const WATCHLIST_REVISIT_TRIGGERS = {
  named_production_deployment: 'Announces a named production deployment with autonomous agent actions',
  customers_asking_for_governance: 'Their customers start asking them for governance controls publicly',
  case_study_consequential_ops: 'Publishes a case study showing consequential autonomous operations',
} as const

export type WatchlistRevisitTrigger = keyof typeof WATCHLIST_REVISIT_TRIGGERS
export const WATCHLIST_REVISIT_TRIGGER_KEYS = Object.keys(WATCHLIST_REVISIT_TRIGGERS) as WatchlistRevisitTrigger[]

// ── The prospect dossier ────────────────────────────────────────────────────
// The shape the research model fills in and the shape we persist. FACT /
// INFERENCE / UNKNOWN are three separate arrays and never merged.
export interface AerpoliceDossier {
  organization: string
  website: string
  agent_product: string
  company_size_band: CompanySizeBand
  company_size_basis: string
  // 1. What the agent verifiably does outside the model.
  verified_action: {
    action_type: ExternalAction | null
    description: string
    status: 'confirmed' | 'inferred' | 'unknown'
    evidence_url: string | null
    evidence_tier: EvidenceTier
    additional_actions: ExternalAction[]
  }
  // 2. The dated event that makes outreach timely.
  trigger: {
    type: AerpoliceTrigger | null
    what_happened: string
    date: string | null
    evidence_url: string | null
    evidence_tier: EvidenceTier
  }
  // 3. Structural fit — segments this org operates in, independent of today's news.
  structural_fit: {
    segments: AerpoliceSegment[]
    rationale: string
  }
  // 4. Current controls publicly stated — answers to the control-gap checklist.
  current_controls: {
    has_own_identity: 'confirmed' | 'inferred' | 'unknown'
    shared_service_account: 'confirmed' | 'inferred' | 'unknown'
    credentials_or_oauth_scope: string
    authorization_external_to_runtime: 'confirmed' | 'inferred' | 'unknown'
    limits_supported: string
    human_escalation: 'confirmed' | 'inferred' | 'unknown'
    independent_kill_switch: 'confirmed' | 'inferred' | 'unknown'
    audit_log_explains_why: 'confirmed' | 'inferred' | 'unknown'
    audit_verifiable_by_customer: 'confirmed' | 'inferred' | 'unknown'
    stated_summary: string
  }
  // 5. The control gap — deliberately its own field with its own status. The
  //    mere existence of an action-taking agent is NOT a gap; a gap requires
  //    evidence about what the CONTROL LAYER is missing.
  control_gap: {
    gap: string
    status: 'confirmed' | 'inferred' | 'unknown'
    basis: string
  }
  // 6. Consequence — what actually goes wrong if this action is misused.
  consequence: {
    financial: string | null
    operational: string | null
    regulatory: string | null
    reputational: string | null
  }
  // 7. Recommended motion + rationale (replace vs complement judgment).
  recommended_motion: RecommendedMotion
  motion_rationale: string
  // 8. The likely buyer.
  buyer: {
    role: string
    name: string | null
    identifiable: boolean
    public_channel: string | null
  }
  first_qualification_question: string
  // Epistemics — kept strictly separate.
  facts: string[]
  inferences: string[]
  unknowns: string[]
  team_public: boolean
  project_active: boolean
  rejection_flags: RejectionReason[]
}

// ── Scoring ──────────────────────────────────────────────────────────────────
// Six dimensions, each already in its native point range per the spec —
// Action-fit 0-25, Trigger 0-20, Reachability 0-20, Consequence 0-15,
// Complementarity 0-10, Evidence 0-10 — summing to 0-100. Nothing here is a
// number the model was asked to invent; every input is a structured dossier
// field.
export const TIER_1_MIN = 82
export const TIER_2_MIN = 72
// A trigger past this many days has been fully absorbed — citing it reads as
// stale awareness, not timely outreach.
export const TRIGGER_STALE_DAYS = 270
// "Preferably within 30 days" from the spec's Contact-now criteria.
export const CONTACT_NOW_FRESH_DAYS = 30

export interface ScoreBreakdown {
  actionFitScore: number
  triggerScore: number
  reachabilityScore: number
  consequenceScore: number
  complementarityScore: number
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

export function scoreProspect(d: AerpoliceDossier, now = new Date()): ScoreBreakdown {
  const notes: string[] = []

  // ── Action fit (0-25) ──────────────────────────────────────────────────
  const va = d.verified_action
  const actionWeight = va?.action_type ? EXTERNAL_ACTIONS[va.action_type]?.weight ?? 40 : 0
  let actionFitScore = 0
  if (va?.status === 'confirmed') {
    actionFitScore = 25 * (actionWeight / 100)
  } else if (va?.status === 'inferred') {
    actionFitScore = 12 * (actionWeight / 100)
    notes.push('Verified action is inferred, not confirmed on a corroborating source.')
  } else {
    notes.push('No confirmed or inferred external action — this dossier should not clear the gate.')
  }
  const breadth = (va?.additional_actions || []).length
  if (breadth > 0 && va?.status === 'confirmed') actionFitScore += Math.min(3, breadth)
  actionFitScore = clamp(Math.round(actionFitScore), 0, 25)

  // ── Trigger (0-20) ──────────────────────────────────────────────────────
  const age = daysSince(d.trigger?.date, now)
  let triggerBase: number
  if (age == null) {
    triggerBase = 4
    notes.push('Trigger has no verifiable date — recency scored as weak.')
  } else if (age <= 14) triggerBase = 20
  else if (age <= 30) triggerBase = 18
  else if (age <= 60) triggerBase = 15
  else if (age <= 90) triggerBase = 12
  else if (age <= 180) triggerBase = 8
  else if (age <= TRIGGER_STALE_DAYS) triggerBase = 4
  else { triggerBase = 1; notes.push('Trigger is stale (past the review window).') }
  const triggerWeight = d.trigger?.type ? AERPOLICE_TRIGGERS[d.trigger.type]?.weight ?? 60 : 50
  const triggerScore = clamp(Math.round(triggerBase * (0.7 + 0.3 * (triggerWeight / 100))), 0, 20)

  // ── Reachability (0-20) ───────────────────────────────────────────────
  const sizeBand = COMPANY_SIZE_BANDS[d.company_size_band] ?? COMPANY_SIZE_BANDS.unknown
  let reachabilityScore: number = sizeBand.reachabilityBase
  if (d.buyer?.public_channel) reachabilityScore += 6
  if (d.buyer?.identifiable) reachabilityScore += 4
  if (d.team_public) reachabilityScore += 2
  if (d.website) reachabilityScore += 2
  reachabilityScore = clamp(Math.round(reachabilityScore), 0, 20)
  if (d.company_size_band === 'enterprise_large') {
    notes.push('Over ~1,000 employees — outside the priority band; needs an unusually specific trigger and reachable owner to justify.')
  }

  // ── Consequence (0-15) ────────────────────────────────────────────────
  let consequenceScore = 15 * (actionWeight / 100)
  const consequenceFieldsDocumented =
    (d.consequence?.financial ? 1 : 0) + (d.consequence?.operational ? 1 : 0) +
    (d.consequence?.regulatory ? 1 : 0) + (d.consequence?.reputational ? 1 : 0)
  consequenceScore += Math.min(3, consequenceFieldsDocumented)
  consequenceScore = clamp(Math.round(consequenceScore), 0, 15)

  // ── Complementarity (0-10) ────────────────────────────────────────────
  let complementarityScore: number
  if ((d.rejection_flags || []).includes('equivalent_offering') || d.recommended_motion === 'reject') {
    complementarityScore = 2
    notes.push('Already offers substantially equivalent functionality — weak complementary entry point.')
  } else if (d.control_gap?.status === 'confirmed') {
    complementarityScore = 10
  } else if (d.control_gap?.status === 'inferred') {
    complementarityScore = 7
  } else {
    complementarityScore = 5
  }

  // ── Evidence (0-10) ────────────────────────────────────────────────────
  const actionTier = EVIDENCE_TIERS[va?.evidence_tier] ?? EVIDENCE_TIERS.none
  const triggerTier = EVIDENCE_TIERS[d.trigger?.evidence_tier] ?? EVIDENCE_TIERS.none
  const facts = (d.facts || []).length
  const inferences = (d.inferences || []).length
  const unknowns = (d.unknowns || []).length
  const factRatio = facts + inferences === 0 ? 0 : facts / (facts + inferences)
  let evidenceScore = (actionTier.score * 0.5 + triggerTier.score * 0.3 + factRatio * 100 * 0.2) / 10
  evidenceScore -= Math.min(2, unknowns * 0.3)
  if (!actionTier.corroborating) {
    evidenceScore = Math.min(evidenceScore, 4)
    notes.push('Action evidence rests on a non-corroborating source (social/directory/aggregator only).')
  }
  evidenceScore = clamp(Math.round(evidenceScore), 0, 10)

  const totalScore = clamp(
    actionFitScore + triggerScore + reachabilityScore + consequenceScore + complementarityScore + evidenceScore,
    0, 100,
  )
  const tier: 1 | 2 | 3 = totalScore >= TIER_1_MIN ? 1 : totalScore >= TIER_2_MIN ? 2 : 3

  return { actionFitScore, triggerScore, reachabilityScore, consequenceScore, complementarityScore, evidenceScore, totalScore, tier, notes }
}

// ── Gap discipline ───────────────────────────────────────────────────────────
// The one claim Aerpolice must never make loosely: that an organisation HAS a
// control gap. "Their agent can act" is not itself a gap — a confirmed gap
// requires evidence about what the control layer is missing (identity,
// authorization enforcement, limits, escalation, kill control, or audit
// integrity). Mutates the dossier so the persisted record carries the
// corrected status, same pattern as lib/aerseal-discovery.ts.
export function enforceGapDiscipline(d: AerpoliceDossier): string[] {
  const downgrades: string[] = []
  const gap = d?.control_gap
  if (!gap || gap.status !== 'confirmed') return downgrades

  const basis = `${gap.gap || ''} ${gap.basis || ''}`.toLowerCase()
  const mentionsControlLayer =
    /identity|shared (?:service )?account|credential|oauth|authoriz|limit|threshold|escalat|approval|kill.switch|audit|tamper|framework|runtime/.test(basis)
  const onlyDescribesCapability =
    /can (?:act|take action|execute|perform|write|modify)|action.taking|able to/.test(basis) && !mentionsControlLayer
  if (onlyDescribesCapability || !mentionsControlLayer) {
    gap.status = 'inferred'
    downgrades.push('Gap rested on the agent being action-taking alone, not on evidence about the control layer — recorded as inference.')
  }
  return downgrades
}

// ── Approval / save gate ─────────────────────────────────────────────────────
// Unlike a hard pass/fail gate, this returns a NEXT ACTION with four rungs,
// because the spec is explicit that a missing trigger downgrades a lead
// rather than discarding it: "No action evidence: reject. No dated trigger:
// monitor, but do not send." Only a missing/unconfirmed external action (or a
// hard rejection rule) means the candidate is never saved as a lead at all.
export type NextAction = 'Contact now' | 'Validate then send' | 'Monitor' | 'Reject'

export interface GateResult {
  saved: boolean
  nextAction: NextAction
  failures: string[]
  rejections: RejectionReason[]
}

export function evaluateGate(d: AerpoliceDossier, score: ScoreBreakdown, now = new Date()): GateResult {
  const failures: string[] = []
  const rejections: RejectionReason[] = []

  const age = daysSince(d.trigger?.date, now)
  const hasRealTrigger =
    !!d.trigger?.what_happened && d.trigger.what_happened.trim().length > 15 &&
    !!d.trigger.evidence_url && age !== null && age <= TRIGGER_STALE_DAYS
  const triggerTier = EVIDENCE_TIERS[d.trigger?.evidence_tier] ?? EVIDENCE_TIERS.none

  const va = d.verified_action
  const actionTier = EVIDENCE_TIERS[va?.evidence_tier] ?? EVIDENCE_TIERS.none
  const hasVerifiedAction =
    va?.status === 'confirmed' && !!va.action_type && !!va.evidence_url && actionTier.corroborating

  const hasRouteToBuyer = !!d.buyer?.identifiable || !!d.buyer?.public_channel || (d.team_public === true && !!d.website)

  // ── Hard rejections — never saved ─────────────────────────────────────
  if (!hasVerifiedAction) rejections.push('no_action_evidence')
  if (d.project_active === false) rejections.push('inactive')
  if ((d.rejection_flags || []).includes('equivalent_offering')) rejections.push('equivalent_offering')
  if (d.company_size_band === 'enterprise_large' && !(hasRealTrigger && triggerTier.corroborating && hasRouteToBuyer)) {
    rejections.push('too_large_no_trigger')
  }
  for (const r of d.rejection_flags || []) {
    if (r !== 'equivalent_offering' && !rejections.includes(r)) rejections.push(r)
  }

  if (rejections.length > 0) {
    if (!hasVerifiedAction) failures.push('No verified external action confirmed on a corroborating source')
    return { saved: false, nextAction: 'Reject', failures, rejections }
  }

  // ── Saved, but which rung? ────────────────────────────────────────────
  const hasFreshTrigger = hasRealTrigger && triggerTier.corroborating
  const hasIntelligentQuestion = !!d.first_qualification_question && d.first_qualification_question.trim().includes('?')
  const motionAllowsOutreach = d.recommended_motion !== 'monitor' && d.recommended_motion !== 'reject'
  // Gate criterion #3 of the four-part direct-customer framework: a confirmed
  // or strongly evidenced governance gap. "unknown" means the control layer
  // was never investigated — that's research required, not an outreach-ready
  // lead, even if the action, trigger and buyer all check out.
  const hasGovernanceGapEvidence = d.control_gap?.status === 'confirmed' || d.control_gap?.status === 'inferred'

  if (!hasFreshTrigger) {
    return { saved: true, nextAction: 'Monitor', failures: ['No current dated trigger — monitored, not sent'], rejections: [] }
  }
  if (!hasRouteToBuyer || !hasIntelligentQuestion || !motionAllowsOutreach || !hasGovernanceGapEvidence) {
    const why: string[] = []
    if (!hasRouteToBuyer) why.push('No identifiable buyer or public channel yet')
    if (!hasGovernanceGapEvidence) why.push('Control-gap status is unknown — the governance gap has not been investigated, only the agent\'s capability')
    if (!hasIntelligentQuestion) why.push('No intelligent unanswered question drafted')
    if (!motionAllowsOutreach) why.push(`Recommended motion is "${RECOMMENDED_MOTIONS[d.recommended_motion]}" — not an outreach motion`)
    return { saved: true, nextAction: 'Validate then send', failures: why, rejections: [] }
  }
  if (age !== null && age > CONTACT_NOW_FRESH_DAYS) {
    return { saved: true, nextAction: 'Validate then send', failures: [`Trigger is ${age} days old — spec prefers Contact-now triggers within ${CONTACT_NOW_FRESH_DAYS} days`], rejections: [] }
  }
  return { saved: true, nextAction: 'Contact now', failures: [], rejections: [] }
}

// ── Outreach seed ─────────────────────────────────────────────────────────
// Only produced for "Contact now" prospects. Exactly four parts per the spec.
export interface OutreachSeed {
  trigger_sentence: string
  action_control_implication: string
  intelligent_question: string
  linkedin_note: string
}

export function validateOutreachSeed(s: Partial<OutreachSeed> | null | undefined): string[] {
  const problems: string[] = []
  if (!s) return ['No outreach seed produced']
  if (!s.trigger_sentence || s.trigger_sentence.trim().length < 15) problems.push('Missing trigger sentence')
  if (!s.action_control_implication || s.action_control_implication.trim().length < 20) problems.push('Missing action-control implication')
  if (!s.intelligent_question || !s.intelligent_question.includes('?')) problems.push('Missing intelligent question')
  if (!s.linkedin_note || s.linkedin_note.length > 280) problems.push('LinkedIn note missing or over 280 characters')
  const text = `${s.trigger_sentence} ${s.action_control_implication} ${s.intelligent_question} ${s.linkedin_note}`.toLowerCase()
  for (const phrase of GENERIC_OPENERS) {
    if (text.includes(phrase)) problems.push(`Generic opener/compliment: "${phrase}"`)
  }
  return problems
}

export const GENERIC_OPENERS = [
  "i'm impressed by what you're building",
  'your innovative platform',
  'we revolutionize ai security',
  'aerpolice is the future of agent governance',
  'i hope this finds you well',
  'i wanted to reach out',
]

// ── Discovery discipline (injected into research prompts) ──────────────────
export const QUALIFICATION_GATE_RULES = `MANDATORY QUALIFICATION GATE — a company cannot become a qualified lead unless public evidence confirms its agent can perform at least one of these EXTERNAL actions:
${EXTERNAL_ACTION_KEYS.map(k => `- ${k}: ${EXTERNAL_ACTIONS[k].label}`).join('\n')}

Reject chatbots, search assistants, content generators, analytics copilots and read-only agents UNLESS a recent event shows they are adding real action capability right now. Do not approve a company based only on the discovery article — every candidate needs its own website, docs, changelog, security/trust center, blog, marketplace listing and current job openings checked before it counts as evidence.

NO EXTERNAL ACTION, NO LEAD.`

export const REPLACEMENT_VS_COMPLEMENT_RULES = `REPLACEMENT VS COMPLEMENT — do not assume Aerpolice must replace the prospect's existing controls. Classify recommended_motion as one of: ${Object.values(RECOMMENDED_MOTIONS).join(', ')}. A company already offering policies, approvals, identity or auditability may still qualify if Aerpolice adds something they don't have: framework-independent enforcement, cross-cloud/cross-tool policy, cryptographically signed decisions, external human escalation, independent kill control, a customer-controlled evidence layer, or governance spanning both financial and non-financial actions. If the prospect already offers substantially equivalent functionality, classify it as a possible partner or competitor — set rejection_flags to include "equivalent_offering" rather than treating it as a customer.`

export const CONTROL_GAP_RULES = `CONTROL-GAP INVESTIGATION — never claim a confirmed gap merely because an agent can act. A confirmed gap needs evidence about the CONTROL LAYER specifically: does the agent have its own identity or a shared service account? What credentials/OAuth scope does it hold? Is authorization enforced before the tool executes, and is that enforcement external to the agent runtime? Can the agent modify its own limits? Are amount/destination/resource/action limits enforced per-action, per-session and cumulatively? Are exceptional actions escalated to a human, bound to the exact action and parameters? Can one agent be stopped independently? Does the audit log record only what happened, or also why it was allowed, and can the customer verify it was not altered? Are controls consistent across frameworks? If the answer to any of these is not public, record UNKNOWN and turn it into the first_qualification_question rather than guessing.`

export const EPISTEMIC_RULES = `FACT / INFERENCE / UNKNOWN — keep these three strictly separate:
- FACT: stated on an authoritative source you can cite with a URL — the company's own docs, changelog, blog, newsroom, security/trust center, a marketplace listing, or a named job posting.
- INFERENCE: a reasoned conclusion drawn from facts, explicitly labelled as such.
- UNKNOWN: something that genuinely matters and could not be established. An honest unknown beats a confident guess.
Social posts, directories (Crunchbase, YC, Product Hunt, Show HN, GitHub topic listings) and news aggregators may identify a lead, but can never be the SOLE evidence for a claim when an official source is available. Never claim a prospect has inadequate security, is unhappy with its provider, has weak controls, has suffered an incident, lacks human approval, or cannot audit its agent's actions — unless a reliable source directly establishes that claim.`

export const OUTREACH_TONE_RULES = `The outreach seed should sound like an informed technical peer opening an architecture conversation — never a generic compliment, never an accusation of vulnerability. Banned openers: ${GENERIC_OPENERS.map(p => `"${p}"`).join(', ')}. Never claim the prospect's controls are inadequate; state what is publicly documented and ask about what genuinely isn't.`

export const PIPELINE_SEPARATION_RULES = `TWO SEPARATE PIPELINES — never blend them.

DIRECT CUSTOMER PIPELINE requires ALL FOUR of the following before a company enters it:
1. A live agent taking real consequential actions in production TODAY — not a roadmap item, not a stated capability.
2. An identifiable person who owns the authorization risk and can purchase.
3. A confirmed or strongly evidenced gap in how that agent's actions are governed.
4. A dated trigger (funding, launch, enterprise deal, security hire, incident, audit).
If any one of these is unknown, this is RESEARCH REQUIRED — do not treat it as a scored, outreach-ready lead. A company with a live agent and a governance gap but NO dated trigger event belongs in a monitoring queue, not the active outreach pipeline — the trigger is what makes the timing feel earned rather than random, and it is non-negotiable.

OEM/PARTNER WATCHLIST is a separate pipeline, separate motion, for MCP vendors, agent framework builders, connector providers and tool publishers. Set recommended_motion to "oem_integration" or "partnership" for these — they are NOT customer leads and receive no outreach from the direct-customer pipeline. Different team, different conversation, different timeline. They are only worth revisiting when one of these happens:
${WATCHLIST_REVISIT_TRIGGER_KEYS.map(k => `- ${k}: ${WATCHLIST_REVISIT_TRIGGERS[k]}`).join('\n')}`

export function externalActionsReference(): string {
  return EXTERNAL_ACTION_KEYS.map(k => `- ${k}: ${EXTERNAL_ACTIONS[k].label}`).join('\n')
}
export function segmentsReference(): string {
  return AERPOLICE_SEGMENT_KEYS.map(k => `- ${k}: ${AERPOLICE_SEGMENTS[k].label}`).join('\n')
}
export function triggersReference(): string {
  return AERPOLICE_TRIGGER_KEYS.map(k => `- ${k}: ${AERPOLICE_TRIGGERS[k].label}`).join('\n')
}
export function evidenceTiersReference(): string {
  return EVIDENCE_TIER_KEYS.map(k => `- ${k}: ${EVIDENCE_TIERS[k].label}${EVIDENCE_TIERS[k].corroborating ? '' : '  [DISCOVERY ONLY — cannot corroborate]'}`).join('\n')
}
export function motionsReference(): string {
  return Object.entries(RECOMMENDED_MOTIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')
}
export function tierLabel(tier: 1 | 2 | 3): string {
  return tier === 1 ? 'Tier 1' : tier === 2 ? 'Tier 2' : 'Tier 3'
}
