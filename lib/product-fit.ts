// ============================================================
// Product-fit classifier — UI-layer only.
// ------------------------------------------------------------
// Groups existing leads by WHICH of our 9 products/services fits
// them, using only fields already stored on the lead (kima_fit,
// aeredium_fit, aerpolice_fit, product_to_sell, customer_category,
// industry_category, pain_point, etc). No schema or AI-prompt
// changes required — this is purely a display-layer reclassification
// so the Leads page can show "customers by product" instead of the
// old sales-motion categories.
//
// A lead can match more than one product (e.g. an agentic-payments
// company is a genuine Kima + Aerpolice mix) — that's intentional,
// not a bug. Leads with no derivable signal land in "Unclassified".
// ============================================================

import { PRODUCTS, type Product } from './products-showcase'
import type { Lead } from './types'

export interface ProductFit {
  companySlug: Product['slug']
  companyName: string
  subProduct: string
}

export const UNCLASSIFIED = 'Unclassified' as const

function haystack(lead: Lead): string {
  return [
    lead.kima_fit,
    lead.aeredium_fit,
    lead.aerpolice_fit,
    lead.agent_control_angle,
    lead.product_to_sell,
    lead.industry_category,
    lead.pain_point,
    lead.pain_point_evidence,
    lead.product_summary,
    lead.description,
    lead.settlement_angle,
    lead.security_angle,
    lead.risk_angle,
    lead.suggested_use_case,
    (lead.customer_category || []).join(' '),
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase()
}

function catsLower(lead: Lead): string[] {
  return (lead.customer_category || []).map(c => c.toLowerCase())
}

// Returns every product/sub-product this lead plausibly fits, derived
// purely from existing text/array fields — no new data required.
export function classifyLead(lead: Lead): ProductFit[] {
  const hay = haystack(lead)
  const cats = catsLower(lead)
  const matches: ProductFit[] = []

  // ── Aerpolice ────────────────────────────────────────────────
  const aerpoliceSignal =
    !!lead.aerpolice_fit ||
    !!lead.agent_control_angle ||
    cats.some(c => c.includes('aerpolice') || c.includes('agentic payments')) ||
    (lead.industry_category || '').toLowerCase().includes('ai commerce') ||
    /\b(ai agent|agentic|autonomous agent|agent governance|agent identity|execution gate|audit trail|agent control)\b/.test(hay)

  if (aerpoliceSignal) {
    let sub = 'Agent Policy + Execution Gate'
    if (/\baudit trail\b|immutable log|compliance record/.test(hay)) sub = 'Audit Trail'
    else if (/\bagent identity\b|verifiable identity|who \(or what\) acted|prove who acted/.test(hay) && !/execution gate|policy enforcement|spend limit/.test(hay)) sub = 'Agent Identity'
    matches.push({ companySlug: 'aerpolice', companyName: 'Aerpolice', subProduct: sub })
  }

  // ── Aeredium (Institutional L1 / AERLink / AERKey) ────────────
  const aerkeySignal =
    cats.some(c => c.includes('aerkey')) ||
    /\baerkey\b|threshold ecdsa|threshold signing|mpc custody|mpc wallet|key governance|key management|signing polic/.test(hay)

  const aerlinkSignal = /\baerlink\b|bank api|\bswift\b|core-banking|core banking|\berp\b/.test(hay)

  const aeredumGeneralSignal =
    !!lead.aeredium_fit ||
    cats.some(c => c.includes('fireblocks')) ||
    /\baeredium\b|tee-attested|institutional l1|bitcoin-anchored|250,?000 tps|250k tps/.test(hay)

  if (aerkeySignal) {
    matches.push({ companySlug: 'aeredium', companyName: 'Aeredium', subProduct: 'AERKey (TEE Threshold Signing)' })
  } else if (aerlinkSignal && aeredumGeneralSignal) {
    matches.push({ companySlug: 'aeredium', companyName: 'Aeredium', subProduct: 'AERLink (Bank API Bridge)' })
  } else if (aeredumGeneralSignal) {
    matches.push({ companySlug: 'aeredium', companyName: 'Aeredium', subProduct: 'Aeredium Institutional L1' })
  }

  // ── Kima (UPR / LaaS / DvP) ────────────────────────────────────
  const kimaGeneralSignal =
    !!lead.kima_fit ||
    !!lead.settlement_angle ||
    cats.some(c =>
      c.includes('layerzero') || c.includes('hacked') || c.includes('on/off ramp') ||
      c.includes('web2 stablecoin') || c.includes('agentic payments')
    ) ||
    !!(lead.product_to_sell && lead.product_to_sell.trim())

  if (kimaGeneralSignal) {
    let sub = 'Universal Payment Rail (UPR)'
    if (/\bdvp\b|delivery vs payment|rwa platform|tokenized securit/.test(hay)) sub = 'Delivery vs Payment (DvP)'
    else if (/liquidity as a service|\blaas\b|pooled liquidity|fragmented liquidity|fragmented reserves/.test(hay)) sub = 'Liquidity as a Service (LaaS)'
    matches.push({ companySlug: 'kima', companyName: 'Kima', subProduct: sub })
  }

  return matches
}

export interface ProductNode {
  slug: Product['slug']
  name: string
  subProducts: string[]
}

// Static tree shape driven by the real product catalog (products-showcase.ts)
// — this is the same taxonomy already used on the /products page and in the
// qualify-lead product_matches matrix, so the left-nav mirrors what the agent
// actually evaluates per lead.
export const PRODUCT_TREE: ProductNode[] = PRODUCTS.map(p => ({
  slug: p.slug,
  name: p.name,
  subProducts: p.subProducts.map(sp => sp.name),
}))
