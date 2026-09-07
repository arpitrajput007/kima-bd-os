// ============================================================================
// Tests for the deterministic core of the Aerpolice pipeline (wallet-signing
// product scope, 2026-09-07): scoring and evaluateGate()'s pipeline-routing
// ladder. Deliberately does NOT test the LLM-driven stages (harvest/extract/
// profile in app/api/ai/discover-aerpolice/route.ts) — those need live
// network + API keys and are nondeterministic by construction.
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  scoreProspect,
  evaluateGate,
  validateOutreachSeed,
  daysSince,
  TIER_1_MIN,
  TIER_2_MIN,
  TRIGGER_PREFERRED_FRESH_DAYS,
  type OutreachSeed,
} from '@/lib/aerpolice-discovery'
import {
  TODAY,
  isoDaysAgo,
  DIRECT_SALES_DOSSIER,
  NO_WALLET_KEY_DOSSIER,
  UNKNOWN_WALLET_KEY_DOSSIER,
  NO_IRREVERSIBLE_ACTION_DOSSIER,
  UNKNOWN_IRREVERSIBLE_DOSSIER,
  TESTNET_ONLY_DOSSIER,
  API_FIAT_RAIL_DOSSIER,
  INACTIVE_DOSSIER,
  S3_WALLET_INFRA_NO_GAP_DOSSIER,
  S3_WALLET_INFRA_VERIFIED_GAP_DOSSIER,
  NO_TRIGGER_NO_BUYER_DOSSIER,
  STALE_TRIGGER_DOSSIER,
} from './fixtures/aerpolice-dossiers'

describe('scoreProspect — only scores when all three gates pass', () => {
  it('scores 0 across the board when the gates have not all passed', () => {
    for (const d of [NO_WALLET_KEY_DOSSIER, NO_IRREVERSIBLE_ACTION_DOSSIER, TESTNET_ONLY_DOSSIER, UNKNOWN_WALLET_KEY_DOSSIER]) {
      const s = scoreProspect(d, TODAY)
      expect(s.totalScore).toBe(0)
    }
  })

  it('keeps every component within its native point range for a fully-gated dossier', () => {
    const s = scoreProspect(DIRECT_SALES_DOSSIER, TODAY)
    expect(s.walletScore).toBeGreaterThanOrEqual(0); expect(s.walletScore).toBeLessThanOrEqual(25)
    expect(s.irreversibleScore).toBeGreaterThanOrEqual(0); expect(s.irreversibleScore).toBeLessThanOrEqual(20)
    expect(s.triggerScore).toBeGreaterThanOrEqual(0); expect(s.triggerScore).toBeLessThanOrEqual(20)
    expect(s.integrationScore).toBeGreaterThanOrEqual(0); expect(s.integrationScore).toBeLessThanOrEqual(15)
    expect(s.reachabilityScore).toBeGreaterThanOrEqual(0); expect(s.reachabilityScore).toBeLessThanOrEqual(15)
    expect(s.evidenceScore).toBeGreaterThanOrEqual(0); expect(s.evidenceScore).toBeLessThanOrEqual(5)
    expect(s.totalScore).toBeGreaterThanOrEqual(0); expect(s.totalScore).toBeLessThanOrEqual(100)
  })

  it('assigns tier consistently with the total score', () => {
    for (const d of [DIRECT_SALES_DOSSIER, STALE_TRIGGER_DOSSIER, S3_WALLET_INFRA_VERIFIED_GAP_DOSSIER]) {
      const s = scoreProspect(d, TODAY)
      if (s.totalScore >= TIER_1_MIN) expect(s.tier).toBe(1)
      else if (s.totalScore >= TIER_2_MIN) expect(s.tier).toBe(2)
      else expect(s.tier).toBe(3)
    }
  })

  it('scores a fresh trigger higher than the same dossier with a stale one', () => {
    const fresh = scoreProspect(DIRECT_SALES_DOSSIER, TODAY)
    const stale = scoreProspect(STALE_TRIGGER_DOSSIER, TODAY)
    expect(fresh.triggerScore).toBeGreaterThan(stale.triggerScore)
  })
})

describe('daysSince', () => {
  it('returns null for missing/unparseable dates', () => {
    expect(daysSince(null, TODAY)).toBeNull()
    expect(daysSince(undefined, TODAY)).toBeNull()
    expect(daysSince('unknown', TODAY)).toBeNull()
  })

  it('parses ISO dates', () => {
    expect(daysSince(isoDaysAgo(10), TODAY)).toBe(10)
  })
})

describe('evaluateGate — "No wallet key, no Aerpolice lead"', () => {
  it('rejects a company with no wallet key', () => {
    const score = scoreProspect(NO_WALLET_KEY_DOSSIER, TODAY)
    const gate = evaluateGate(NO_WALLET_KEY_DOSSIER, score, TODAY)
    expect(gate.route).toBe('rejected')
    expect(gate.scored).toBe(false)
    expect(gate.rejections).toContain('no_wallet_key')
  })

  it('rejects a company with a confirmed wallet key but no irreversible action', () => {
    const score = scoreProspect(NO_IRREVERSIBLE_ACTION_DOSSIER, TODAY)
    const gate = evaluateGate(NO_IRREVERSIBLE_ACTION_DOSSIER, score, TODAY)
    expect(gate.route).toBe('rejected')
    expect(gate.rejections).toContain('no_irreversible_action')
  })

  it('rejects an inactive company', () => {
    const score = scoreProspect(INACTIVE_DOSSIER, TODAY)
    const gate = evaluateGate(INACTIVE_DOSSIER, score, TODAY)
    expect(gate.route).toBe('rejected')
    expect(gate.rejections).toContain('inactive')
  })
})

describe('evaluateGate — "Unknown remains Unknown, never converted to Yes"', () => {
  it('routes an unconfirmed wallet-key status to monitoring, not rejected and not scored', () => {
    const score = scoreProspect(UNKNOWN_WALLET_KEY_DOSSIER, TODAY)
    const gate = evaluateGate(UNKNOWN_WALLET_KEY_DOSSIER, score, TODAY)
    expect(gate.route).toBe('monitoring')
    expect(gate.scored).toBe(false)
    expect(gate.tierLabel).toBe('Research hold')
    expect(gate.rejections).toHaveLength(0)
  })

  it('routes an unconfirmed irreversible-action status to monitoring', () => {
    const score = scoreProspect(UNKNOWN_IRREVERSIBLE_DOSSIER, TODAY)
    const gate = evaluateGate(UNKNOWN_IRREVERSIBLE_DOSSIER, score, TODAY)
    expect(gate.route).toBe('monitoring')
    expect(gate.scored).toBe(false)
  })
})

describe('evaluateGate — "No production evidence, no sales outreach"', () => {
  it('routes a testnet-only product to monitoring even with both gates confirmed', () => {
    const score = scoreProspect(TESTNET_ONLY_DOSSIER, TODAY)
    const gate = evaluateGate(TESTNET_ONLY_DOSSIER, score, TODAY)
    expect(gate.route).toBe('monitoring')
    expect(gate.scored).toBe(false)
  })
})

describe('evaluateGate — Later: API keys & fiat rails', () => {
  it('routes an API/fiat-rail agent to later_api_fiat, not a current lead', () => {
    const score = scoreProspect(API_FIAT_RAIL_DOSSIER, TODAY)
    const gate = evaluateGate(API_FIAT_RAIL_DOSSIER, score, TODAY)
    expect(gate.route).toBe('later_api_fiat')
    expect(gate.scored).toBe(false)
  })
})

describe('evaluateGate — S3 Wallet Infra is not automatically a direct customer', () => {
  it('routes a wallet-infra provider with no verified residual gap to learning_oem', () => {
    const score = scoreProspect(S3_WALLET_INFRA_NO_GAP_DOSSIER, TODAY)
    const gate = evaluateGate(S3_WALLET_INFRA_NO_GAP_DOSSIER, score, TODAY)
    expect(gate.route).toBe('learning_oem')
    expect(gate.scored).toBe(true) // still scored — see spec's Segment 3 examples, which all carry scores
  })

  it('allows a wallet-infra provider to route to direct_sales when a genuine residual gap and outreach motion are both present', () => {
    const score = scoreProspect(S3_WALLET_INFRA_VERIFIED_GAP_DOSSIER, TODAY)
    const gate = evaluateGate(S3_WALLET_INFRA_VERIFIED_GAP_DOSSIER, score, TODAY)
    expect(gate.route).toBe('direct_sales')
  })
})

describe('evaluateGate — Direct sales vs Design partner', () => {
  it('routes a fully-gated, triggered, reachable prospect to direct_sales, Contact-now', () => {
    const score = scoreProspect(DIRECT_SALES_DOSSIER, TODAY)
    const gate = evaluateGate(DIRECT_SALES_DOSSIER, score, TODAY)
    expect(gate.route).toBe('direct_sales')
    expect(gate.nextAction).toBe('Contact now; request a 20-minute architecture interview.')
  })

  it('routes a prospect with no trigger and no reachable buyer to design_partner instead of direct_sales', () => {
    const score = scoreProspect(NO_TRIGGER_NO_BUYER_DOSSIER, TODAY)
    const gate = evaluateGate(NO_TRIGGER_NO_BUYER_DOSSIER, score, TODAY)
    expect(gate.route).toBe('design_partner')
  })

  it('still scores a design-partner-routed prospect (both gates passed) — routing and scoring are independent', () => {
    const score = scoreProspect(NO_TRIGGER_NO_BUYER_DOSSIER, TODAY)
    expect(score.totalScore).toBeGreaterThan(0)
  })

  it('downgrades an otherwise-qualified prospect to an interview-first action when the trigger is older than the preferred window', () => {
    const dossier = structuredClone(DIRECT_SALES_DOSSIER)
    dossier.trigger.date = isoDaysAgo(TRIGGER_PREFERRED_FRESH_DAYS + 10)
    const score = scoreProspect(dossier, TODAY)
    const gate = evaluateGate(dossier, score, TODAY)
    expect(gate.route).toBe('direct_sales')
    expect(gate.nextAction).not.toBe('Contact now; request a 20-minute architecture interview.')
  })
})

describe('validateOutreachSeed', () => {
  const GOOD: OutreachSeed = {
    story_seeking_question: 'What is the largest position the agent can open before anyone on your team notices?',
    linkedin_note: 'Saw your live Polymarket fills this week — curious how you scope agent wallet permissions.',
  }

  it('passes a well-formed seed', () => {
    expect(validateOutreachSeed(GOOD)).toHaveLength(0)
  })

  it('flags a missing seed entirely', () => {
    expect(validateOutreachSeed(null)).toContain('No outreach seed produced')
  })

  it('flags a missing question mark', () => {
    const bad = { ...GOOD, story_seeking_question: 'Wondering about your wallet setup.' }
    expect(validateOutreachSeed(bad)).toContain('Missing story-seeking question')
  })

  it('flags a LinkedIn note over the length budget', () => {
    const bad = { ...GOOD, linkedin_note: 'x'.repeat(220) }
    expect(validateOutreachSeed(bad).some(p => p.includes('180'))).toBe(true)
  })

  it('flags banned phrases, including vulnerability framing', () => {
    const bad = { ...GOOD, linkedin_note: 'Your wallet setup looks vulnerable — ' + GOOD.linkedin_note }
    expect(validateOutreachSeed(bad).some(p => p.includes('Banned phrase'))).toBe(true)
  })
})
