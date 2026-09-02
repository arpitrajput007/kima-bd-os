// ============================================================================
// Tests for the deterministic core of the AERSeal pipeline: scoring, the
// approval gate, gap discipline, hypothesis validation, and date parsing.
// lib/aerseal-discovery.ts. Deliberately does NOT test the LLM-driven stages
// (harvest/extract/profile in app/api/ai/discover-aerseal/route.ts) — those
// need live network + API keys and are nondeterministic by construction.
// What's tested here is everything downstream of a dossier: the code that
// actually decides tier, approval, and rejection, using representative
// fixtures for each trigger class the discovery spec calls out (governance
// proposal, audit finding, security incident, GitHub release) plus one
// fixture per disqualification rule.
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  scoreProspect,
  evaluateGate,
  enforceGapDiscipline,
  validateHypothesis,
  daysSince,
  TIER_1_MIN,
  TIER_2_MIN,
  TRIGGER_STALE_DAYS,
  type OutreachHypothesis,
} from '@/lib/aerseal-discovery'
import {
  TODAY,
  isoDaysAgo,
  GOVERNANCE_PROPOSAL_DOSSIER,
  AUDIT_FINDING_DOSSIER,
  INCIDENT_DOSSIER,
  GITHUB_RELEASE_DOSSIER,
  NON_EVM_DOSSIER,
  IMMUTABLE_NO_ROLES_DOSSIER,
  NO_TRIGGER_DOSSIER,
  STALE_TRIGGER_DOSSIER,
  SOCIAL_ONLY_TRIGGER_DOSSIER,
  NO_BUYER_ROUTE_DOSSIER,
  OVERCLAIMED_GAP_DOSSIER,
} from './fixtures/aerseal-dossiers'

describe('scoreProspect — tier thresholds', () => {
  it('never returns a total or component outside 0-100', () => {
    for (const d of [GOVERNANCE_PROPOSAL_DOSSIER, AUDIT_FINDING_DOSSIER, INCIDENT_DOSSIER, GITHUB_RELEASE_DOSSIER, NON_EVM_DOSSIER, IMMUTABLE_NO_ROLES_DOSSIER]) {
      const s = scoreProspect(d, TODAY)
      for (const key of ['pain_consequence', 'trigger_recency', 'evm_fit', 'admin_authority_fit', 'reachability', 'evidence_confidence', 'total'] as const) {
        expect(s[key]).toBeGreaterThanOrEqual(0)
        expect(s[key]).toBeLessThanOrEqual(100)
      }
    }
  })

  it('assigns tier consistently with the total score', () => {
    for (const d of [GOVERNANCE_PROPOSAL_DOSSIER, AUDIT_FINDING_DOSSIER, INCIDENT_DOSSIER, GITHUB_RELEASE_DOSSIER, STALE_TRIGGER_DOSSIER]) {
      const s = scoreProspect(d, TODAY)
      if (s.total >= TIER_1_MIN) expect(s.tier).toBe(1)
      else if (s.total >= TIER_2_MIN) expect(s.tier).toBe(2)
      else expect(s.tier).toBe(3)
    }
  })

  it('scores a well-evidenced current governance trigger higher on recency than a year-old one', () => {
    const fresh = scoreProspect(GOVERNANCE_PROPOSAL_DOSSIER, TODAY)
    const stale = scoreProspect(STALE_TRIGGER_DOSSIER, TODAY)
    expect(fresh.trigger_recency).toBeGreaterThan(stale.trigger_recency)
  })

  it('scores 0 EVM fit for a non-EVM-only project', () => {
    const s = scoreProspect(NON_EVM_DOSSIER, TODAY)
    expect(s.evm_fit).toBe(0)
  })

  it('penalizes admin-authority fit hard when all contracts are immutable with no roles', () => {
    const s = scoreProspect(IMMUTABLE_NO_ROLES_DOSSIER, TODAY)
    const baseline = scoreProspect(GOVERNANCE_PROPOSAL_DOSSIER, TODAY)
    expect(s.evm_fit).toBeLessThan(baseline.evm_fit)
    expect(s.admin_authority_fit).toBeLessThan(baseline.admin_authority_fit)
  })

  it('caps evidence confidence at 40 when the trigger is social-only', () => {
    const s = scoreProspect(SOCIAL_ONLY_TRIGGER_DOSSIER, TODAY)
    expect(s.evidence_confidence).toBeLessThanOrEqual(40)
  })

  it('deducts a 0-10 point lock-in penalty and never drives the total negative', () => {
    const highLockIn = scoreProspect(
      { ...GOVERNANCE_PROPOSAL_DOSSIER, authority_control: { ...GOVERNANCE_PROPOSAL_DOSSIER.authority_control, model: 'institutional_custodian' }, incumbent: { current_alternative: 'Fireblocks', switching_friction: 'high', friction_reason: 'Deep custody integration' } },
      TODAY,
    )
    expect(highLockIn.lock_in_penalty).toBeGreaterThanOrEqual(0)
    expect(highLockIn.lock_in_penalty).toBeLessThanOrEqual(10)
    expect(highLockIn.total).toBeGreaterThanOrEqual(0)
  })
})

describe('evaluateGate — approvals for well-formed trigger-class fixtures', () => {
  it.each([
    ['governance proposal', GOVERNANCE_PROPOSAL_DOSSIER],
    ['audit finding', AUDIT_FINDING_DOSSIER],
    ['security incident', INCIDENT_DOSSIER],
    ['github release', GITHUB_RELEASE_DOSSIER],
  ])('approves a well-evidenced %s dossier', (_label, dossier) => {
    const score = scoreProspect(dossier, TODAY)
    const gate = evaluateGate(dossier, score, TODAY)
    expect(gate.approved).toBe(true)
    expect(gate.failures).toEqual([])
    expect(gate.rejections).toEqual([])
  })
})

describe('evaluateGate — mandatory rejection rules', () => {
  it('rejects a non-EVM-only project', () => {
    const score = scoreProspect(NON_EVM_DOSSIER, TODAY)
    const gate = evaluateGate(NON_EVM_DOSSIER, score, TODAY)
    expect(gate.approved).toBe(false)
    expect(gate.rejections).toContain('non_evm')
  })

  it('rejects immutable contracts with no privileged roles', () => {
    const score = scoreProspect(IMMUTABLE_NO_ROLES_DOSSIER, TODAY)
    const gate = evaluateGate(IMMUTABLE_NO_ROLES_DOSSIER, score, TODAY)
    expect(gate.approved).toBe(false)
    expect(gate.rejections).toContain('immutable')
  })

  it('rejects a candidate with no dated trigger at all', () => {
    const score = scoreProspect(NO_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(NO_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.approved).toBe(false)
    expect(gate.rejections).toContain('no_trigger')
  })

  it(`rejects a trigger older than TRIGGER_STALE_DAYS (${TRIGGER_STALE_DAYS} days)`, () => {
    const score = scoreProspect(STALE_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(STALE_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.approved).toBe(false)
    expect(gate.rejections).toContain('no_trigger')
  })

  it('rejects an anonymous, KYC-unwilling team', () => {
    const score = scoreProspect(NO_BUYER_ROUTE_DOSSIER, TODAY)
    const gate = evaluateGate(NO_BUYER_ROUTE_DOSSIER, score, TODAY)
    expect(gate.approved).toBe(false)
    expect(gate.rejections).toContain('anon_no_kyc')
  })
})

describe('evaluateGate — the two-evidence requirement', () => {
  it('fails (not rejects) a trigger corroborated only by social media, without a dated-trigger rejection', () => {
    const score = scoreProspect(SOCIAL_ONLY_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(SOCIAL_ONLY_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.approved).toBe(false)
    expect(gate.rejections).not.toContain('no_trigger')
    expect(gate.failures.some(f => f.toLowerCase().includes('social media'))).toBe(true)
  })

  it('fails when structural evidence is missing entirely', () => {
    const d = { ...GOVERNANCE_PROPOSAL_DOSSIER, structural_fit: { ...GOVERNANCE_PROPOSAL_DOSSIER.structural_fit, evidence_url: null } }
    const score = scoreProspect(d, TODAY)
    const gate = evaluateGate(d, score, TODAY)
    expect(gate.approved).toBe(false)
    expect(gate.failures.some(f => f.includes('Evidence 1 of 2'))).toBe(true)
  })

  it('fails when there is no identifiable buyer or governance owner', () => {
    const d = {
      ...GOVERNANCE_PROPOSAL_DOSSIER,
      buyer: { role: 'Unknown', name: null, why_this_person: '', governance_owner: null, identifiable: false, public_channel: null },
      team_public: false,
    }
    const score = scoreProspect(d, TODAY)
    const gate = evaluateGate(d, score, TODAY)
    expect(gate.approved).toBe(false)
    expect(gate.failures).toContain('No identifiable buyer or governance owner')
  })
})

describe('enforceGapDiscipline', () => {
  it('downgrades a gap claimed confirmed from upgradeability alone, with no controller evidence in the basis', () => {
    const d = { ...OVERCLAIMED_GAP_DOSSIER, control_gap: { ...OVERCLAIMED_GAP_DOSSIER.control_gap } }
    const downgrades = enforceGapDiscipline(d)
    expect(downgrades.length).toBeGreaterThan(0)
    expect(d.control_gap.status).toBe('inferred')
  })

  it('downgrades a gap claimed confirmed while the controller itself is unconfirmed', () => {
    const d = {
      ...OVERCLAIMED_GAP_DOSSIER,
      authority_control: { ...OVERCLAIMED_GAP_DOSSIER.authority_control, status: 'unknown' as const },
      control_gap: { ...OVERCLAIMED_GAP_DOSSIER.control_gap },
    }
    const downgrades = enforceGapDiscipline(d)
    expect(downgrades.length).toBeGreaterThan(0)
    expect(d.control_gap.status).toBe('inferred')
  })

  it('leaves a properly-evidenced confirmed gap alone', () => {
    const d = {
      ...GOVERNANCE_PROPOSAL_DOSSIER,
      control_gap: {
        gap: 'Upgrade authority sits on a single 3-of-5 multisig with no timelock delay before execution',
        status: 'confirmed' as const,
        basis: 'Docs confirm the 3-of-5 multisig can execute an upgrade with no delay or additional approval step.',
      },
    }
    const downgrades = enforceGapDiscipline(d)
    expect(downgrades).toEqual([])
    expect(d.control_gap.status).toBe('confirmed')
  })

  it('is a no-op when the gap is not claimed as confirmed', () => {
    const downgrades = enforceGapDiscipline(GOVERNANCE_PROPOSAL_DOSSIER)
    expect(downgrades).toEqual([])
  })
})

describe('validateHypothesis — no trigger, no send', () => {
  const valid: OutreachHypothesis = {
    verified_trigger: 'The team rotated two of five multisig signers on 2026-08-27, per their governance forum.',
    authority_implication: 'The ProxyAdmin upgrade role now sits behind the newly-rotated signer set, with no disclosed timelock.',
    intelligent_question: 'How are the new signer keys generated, recovered, and kept from concentrating on one device?',
    evidence_url: 'https://forum.example-protocol.xyz/t/signer-rotation/42',
  }

  it('accepts a well-formed hypothesis', () => {
    expect(validateHypothesis(valid)).toEqual([])
  })

  it('rejects a hypothesis with no evidence URL', () => {
    const problems = validateHypothesis({ ...valid, evidence_url: '' })
    expect(problems.some(p => p.includes('no trigger, no send'))).toBe(true)
  })

  it('rejects a hypothesis missing a question mark', () => {
    const problems = validateHypothesis({ ...valid, intelligent_question: 'Please tell us about your signer setup.' })
    expect(problems).toContain('Missing intelligent question')
  })

  it('rejects fear-based language', () => {
    const problems = validateHypothesis({ ...valid, authority_implication: 'You could be next if this signer set is compromised.' })
    expect(problems.some(p => p.includes('Fear-based language'))).toBe(true)
  })

  it('rejects a null/undefined hypothesis outright', () => {
    expect(validateHypothesis(null)).toEqual(['No outreach hypothesis produced'])
    expect(validateHypothesis(undefined)).toEqual(['No outreach hypothesis produced'])
  })
})

describe('daysSince — trigger date parsing', () => {
  it('parses a full ISO date', () => {
    expect(daysSince(isoDaysAgo(10), TODAY)).toBe(10)
  })

  it('parses a "Month YYYY" partial date', () => {
    // TODAY is 2026-09-02; "August 2026" resolves to 2026-08-01.
    expect(daysSince('August 2026', TODAY)).toBe(32)
  })

  it('returns null for missing, unknown, or unparseable dates', () => {
    expect(daysSince(null, TODAY)).toBeNull()
    expect(daysSince(undefined, TODAY)).toBeNull()
    expect(daysSince('unknown', TODAY)).toBeNull()
    expect(daysSince('not a date', TODAY)).toBeNull()
  })

  it('never returns a negative day count for a future-looking date', () => {
    expect(daysSince('2099-01-01', TODAY)).toBe(0)
  })
})
