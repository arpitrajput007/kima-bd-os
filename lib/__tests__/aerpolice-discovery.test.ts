// ============================================================================
// Tests for the deterministic core of the Aerpolice pipeline: scoring, the
// evaluateGate() next-action ladder, gap discipline, and outreach-seed
// validation. Deliberately does NOT test the LLM-driven stages (harvest/
// extract/profile in app/api/ai/discover-aerpolice/route.ts) — those need
// live network + API keys and are nondeterministic by construction.
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  scoreProspect,
  evaluateGate,
  enforceGapDiscipline,
  validateOutreachSeed,
  isOemOrPartnerCandidate,
  daysSince,
  TIER_1_MIN,
  TIER_2_MIN,
  CONTACT_NOW_FRESH_DAYS,
  type OutreachSeed,
} from '@/lib/aerpolice-discovery'
import {
  TODAY,
  isoDaysAgo,
  CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER,
  NO_TRIGGER_DOSSIER,
  STALE_TRIGGER_DOSSIER,
  NO_BUYER_ROUTE_DOSSIER,
  NO_ACTION_EVIDENCE_DOSSIER,
  SOCIAL_ONLY_ACTION_DOSSIER,
  EQUIVALENT_OFFERING_DOSSIER,
  ENTERPRISE_NO_STRONG_TRIGGER_DOSSIER,
  ENTERPRISE_STRONG_TRIGGER_DOSSIER,
  INACTIVE_DOSSIER,
  OVERCLAIMED_GAP_DOSSIER,
  GENUINE_GAP_DOSSIER,
  UNCONFIRMED_GAP_DOSSIER,
  OEM_INTEGRATION_DOSSIER,
  PARTNERSHIP_DOSSIER,
} from './fixtures/aerpolice-dossiers'

describe('scoreProspect — bounds and tiers', () => {
  it('keeps every component within its native point range', () => {
    for (const d of [CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER, NO_TRIGGER_DOSSIER, STALE_TRIGGER_DOSSIER, NO_ACTION_EVIDENCE_DOSSIER]) {
      const s = scoreProspect(d, TODAY)
      expect(s.actionFitScore).toBeGreaterThanOrEqual(0); expect(s.actionFitScore).toBeLessThanOrEqual(25)
      expect(s.triggerScore).toBeGreaterThanOrEqual(0); expect(s.triggerScore).toBeLessThanOrEqual(20)
      expect(s.reachabilityScore).toBeGreaterThanOrEqual(0); expect(s.reachabilityScore).toBeLessThanOrEqual(20)
      expect(s.consequenceScore).toBeGreaterThanOrEqual(0); expect(s.consequenceScore).toBeLessThanOrEqual(15)
      expect(s.complementarityScore).toBeGreaterThanOrEqual(0); expect(s.complementarityScore).toBeLessThanOrEqual(10)
      expect(s.evidenceScore).toBeGreaterThanOrEqual(0); expect(s.evidenceScore).toBeLessThanOrEqual(10)
      expect(s.totalScore).toBeGreaterThanOrEqual(0); expect(s.totalScore).toBeLessThanOrEqual(100)
    }
  })

  it('assigns tier consistently with the total score', () => {
    for (const d of [CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER, NO_TRIGGER_DOSSIER, STALE_TRIGGER_DOSSIER, NO_ACTION_EVIDENCE_DOSSIER]) {
      const s = scoreProspect(d, TODAY)
      if (s.totalScore >= TIER_1_MIN) expect(s.tier).toBe(1)
      else if (s.totalScore >= TIER_2_MIN) expect(s.tier).toBe(2)
      else expect(s.tier).toBe(3)
    }
  })

  it('scores a fresh trigger higher than the same dossier with a stale one', () => {
    const fresh = scoreProspect(CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER, TODAY)
    const stale = scoreProspect(STALE_TRIGGER_DOSSIER, TODAY)
    expect(fresh.triggerScore).toBeGreaterThan(stale.triggerScore)
  })

  it('scores 0 action fit when no verified action is confirmed or inferred', () => {
    const s = scoreProspect(NO_ACTION_EVIDENCE_DOSSIER, TODAY)
    expect(s.actionFitScore).toBe(0)
  })

  it('caps evidence score when action evidence is non-corroborating (social only)', () => {
    const s = scoreProspect(SOCIAL_ONLY_ACTION_DOSSIER, TODAY)
    expect(s.evidenceScore).toBeLessThanOrEqual(4)
  })

  it('scores low complementarity for a company already offering equivalent functionality', () => {
    const s = scoreProspect(EQUIVALENT_OFFERING_DOSSIER, TODAY)
    expect(s.complementarityScore).toBeLessThanOrEqual(3)
  })

  it('scores higher complementarity for a genuinely confirmed control gap than an unconfirmed one', () => {
    const confirmed = scoreProspect(GENUINE_GAP_DOSSIER, TODAY)
    const unconfirmed = scoreProspect(UNCONFIRMED_GAP_DOSSIER, TODAY)
    expect(confirmed.complementarityScore).toBeGreaterThan(unconfirmed.complementarityScore)
  })
})

describe('daysSince', () => {
  it('returns null for missing/unparseable dates', () => {
    expect(daysSince(null, TODAY)).toBeNull()
    expect(daysSince(undefined, TODAY)).toBeNull()
    expect(daysSince('unknown', TODAY)).toBeNull()
    expect(daysSince('not a date', TODAY)).toBeNull()
  })

  it('parses ISO dates and partial "Month YYYY" dates', () => {
    expect(daysSince(isoDaysAgo(10), TODAY)).toBe(10)
    expect(daysSince('June 2026', TODAY)).toBeGreaterThan(0)
  })
})

describe('enforceGapDiscipline', () => {
  it('downgrades a confirmed gap that only restates the agent can act', () => {
    const downgrades = enforceGapDiscipline(OVERCLAIMED_GAP_DOSSIER)
    expect(downgrades.length).toBeGreaterThan(0)
    expect(OVERCLAIMED_GAP_DOSSIER.control_gap.status).toBe('inferred')
  })

  it('leaves a genuinely evidenced control-layer gap as confirmed', () => {
    const dossier = structuredClone(GENUINE_GAP_DOSSIER)
    const downgrades = enforceGapDiscipline(dossier)
    expect(downgrades).toHaveLength(0)
    expect(dossier.control_gap.status).toBe('confirmed')
  })

  it('is a no-op when the gap is not claimed as confirmed', () => {
    const dossier = structuredClone(UNCONFIRMED_GAP_DOSSIER) // control_gap.status === 'unknown'
    expect(enforceGapDiscipline(dossier)).toHaveLength(0)
  })
})

describe('evaluateGate — no external action, no lead', () => {
  it('rejects (not saved) when no verified action is confirmed', () => {
    const score = scoreProspect(NO_ACTION_EVIDENCE_DOSSIER, TODAY)
    const gate = evaluateGate(NO_ACTION_EVIDENCE_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(false)
    expect(gate.nextAction).toBe('Reject')
    expect(gate.rejections).toContain('no_action_evidence')
  })

  it('rejects an inactive project', () => {
    const score = scoreProspect(INACTIVE_DOSSIER, TODAY)
    const gate = evaluateGate(INACTIVE_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(false)
    expect(gate.rejections).toContain('inactive')
  })

  it('rejects a company already offering equivalent functionality', () => {
    const score = scoreProspect(EQUIVALENT_OFFERING_DOSSIER, TODAY)
    const gate = evaluateGate(EQUIVALENT_OFFERING_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(false)
    expect(gate.rejections).toContain('equivalent_offering')
  })

  it('rejects an enterprise-scale company with no strong trigger or reachable buyer', () => {
    const score = scoreProspect(ENTERPRISE_NO_STRONG_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(ENTERPRISE_NO_STRONG_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(false)
    expect(gate.rejections).toContain('too_large_no_trigger')
  })

  it('does NOT reject an enterprise-scale company that has a strong current trigger and a reachable buyer', () => {
    const score = scoreProspect(ENTERPRISE_STRONG_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(ENTERPRISE_STRONG_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.rejections).not.toContain('too_large_no_trigger')
  })
})

describe('evaluateGate — "no dated trigger: monitor, but do not send"', () => {
  it('SAVES a confirmed action-taking agent even with no dated trigger, as Monitor', () => {
    const score = scoreProspect(NO_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(NO_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(true)
    expect(gate.nextAction).toBe('Monitor')
  })

  it('downgrades a stale trigger to Monitor rather than rejecting outright', () => {
    const score = scoreProspect(STALE_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(STALE_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(true)
    expect(gate.nextAction).toBe('Monitor')
  })
})

describe('evaluateGate — Validate then send vs Contact now', () => {
  it('downgrades to "Validate then send" when there is no identifiable buyer yet', () => {
    const score = scoreProspect(NO_BUYER_ROUTE_DOSSIER, TODAY)
    const gate = evaluateGate(NO_BUYER_ROUTE_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(true)
    expect(gate.nextAction).toBe('Validate then send')
  })

  it('reaches "Contact now" for a confirmed action, fresh trigger, reachable buyer and a real question', () => {
    const score = scoreProspect(CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(true)
    expect(gate.nextAction).toBe('Contact now')
  })

  it('downgrades an otherwise-qualified prospect to "Validate then send" when the trigger is older than the preferred window', () => {
    const dossier = structuredClone(CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER)
    dossier.trigger.date = isoDaysAgo(CONTACT_NOW_FRESH_DAYS + 15)
    const score = scoreProspect(dossier, TODAY)
    const gate = evaluateGate(dossier, score, TODAY)
    expect(gate.saved).toBe(true)
    expect(gate.nextAction).toBe('Validate then send')
  })
})

describe('evaluateGate — governance-gap is a hard gate criterion, not just a score input', () => {
  it('downgrades to "Validate then send" when the control gap has never been investigated, even with action+trigger+buyer all present', () => {
    const score = scoreProspect(UNCONFIRMED_GAP_DOSSIER, TODAY)
    const gate = evaluateGate(UNCONFIRMED_GAP_DOSSIER, score, TODAY)
    expect(gate.saved).toBe(true)
    expect(gate.nextAction).toBe('Validate then send')
    expect(gate.failures.some(f => f.toLowerCase().includes('control-gap'))).toBe(true)
  })

  it('reaches "Contact now" once the gap is confirmed alongside action, trigger and buyer', () => {
    const score = scoreProspect(CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER, TODAY)
    const gate = evaluateGate(CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER, score, TODAY)
    expect(gate.nextAction).toBe('Contact now')
  })
})

describe('isOemOrPartnerCandidate — OEM/Partner Watchlist is a separate pipeline from direct customers', () => {
  it('flags an oem_integration motion', () => {
    expect(isOemOrPartnerCandidate(OEM_INTEGRATION_DOSSIER)).toBe(true)
  })

  it('flags a partnership motion', () => {
    expect(isOemOrPartnerCandidate(PARTNERSHIP_DOSSIER)).toBe(true)
  })

  it('flags equivalent_offering regardless of motion', () => {
    expect(isOemOrPartnerCandidate(EQUIVALENT_OFFERING_DOSSIER)).toBe(true)
  })

  it('does not flag a genuine direct-customer candidate', () => {
    expect(isOemOrPartnerCandidate(CONFIRMED_ACTION_FRESH_TRIGGER_DOSSIER)).toBe(false)
  })
})

describe('validateOutreachSeed', () => {
  const GOOD: OutreachSeed = {
    trigger_sentence: 'Rallied listed its action-taking ITSM agent in the Atlassian Marketplace this week.',
    action_control_implication: 'That means password and access changes now run through an agent whose approval step is not independently documented.',
    intelligent_question: 'Can an IT owner stop one agent and prove which policy allowed a specific change?',
    linkedin_note: 'Saw Rallied\'s ITSM agent on the Atlassian Marketplace — curious how you handle independent approval for access changes.',
  }

  it('passes a well-formed seed', () => {
    expect(validateOutreachSeed(GOOD)).toHaveLength(0)
  })

  it('flags a missing seed entirely', () => {
    expect(validateOutreachSeed(null)).toContain('No outreach seed produced')
  })

  it('flags a missing question mark', () => {
    const bad = { ...GOOD, intelligent_question: 'Wondering about your approval flow.' }
    expect(validateOutreachSeed(bad)).toContain('Missing intelligent question')
  })

  it('flags a LinkedIn note over 280 characters', () => {
    const bad = { ...GOOD, linkedin_note: 'x'.repeat(281) }
    expect(validateOutreachSeed(bad).some(p => p.includes('280'))).toBe(true)
  })

  it('flags banned generic openers', () => {
    const bad = { ...GOOD, action_control_implication: "I'm impressed by what you're building — " + GOOD.action_control_implication }
    expect(validateOutreachSeed(bad).some(p => p.includes('Generic opener'))).toBe(true)
  })
})
