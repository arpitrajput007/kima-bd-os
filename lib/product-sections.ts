// Shared config for the per-product BD sections (sidebar + Resources/Approach
// pages). One entry per product that gets its own Customers / Resources /
// Hunting-Approach trio.

import {
  AERPOLICE_KNOWLEDGE, AER360_KNOWLEDGE, AERSEAL_KNOWLEDGE, AERKEY_KNOWLEDGE,
  KIMA_KNOWLEDGE, AEREDIUM_KNOWLEDGE,
} from '@/lib/kima-knowledge'

export type ProductSlug = 'aerpolice' | 'aer360' | 'aerseal' | 'aerkey' | 'agent'

export interface ProductSection {
  slug: ProductSlug
  label: string
  shortLabel: string
  accent: 'violet' | 'blue' | 'cyan' | 'orange'
  /** Fed to the AI as ground truth when suggesting resources for this product. */
  knowledge: string
  /** Existing dedicated customers page(s), if any — shown instead of the generic shell. */
  customerLinks: { href: string; label: string }[]
  /** Existing dedicated discovery/run page, if any. */
  discoveryHref?: string
  defaultApproachPlaceholder: string
}

export const PRODUCT_SECTIONS: ProductSection[] = [
  {
    slug: 'aerpolice',
    label: 'AERpolice',
    shortLabel: 'AERpolice',
    accent: 'cyan',
    knowledge: AERPOLICE_KNOWLEDGE,
    customerLinks: [{ href: '/aerpolice-customers', label: 'AERpolice Customers' }],
    discoveryHref: '/aerpolice',
    defaultApproachPlaceholder:
      'Describe how to find AERpolice customers — e.g. "Target AI-native companies whose agents take consequential financial actions (payments, procurement, treasury, trading), especially ones facing enterprise security review. Look for MCP-based tooling, agentic-commerce startups, AI wallet builders." Paste your own notes here and save.',
  },
  {
    slug: 'aer360',
    label: 'AER360',
    shortLabel: 'AER360',
    accent: 'violet',
    knowledge: AER360_KNOWLEDGE,
    customerLinks: [],
    defaultApproachPlaceholder:
      'Describe how to find AER360 customers — e.g. "Target custodians, MPC/custody wallet providers, exchanges, treasuries, or funds needing hardware-enforced key-signing governance, or companies about to give an AI agent real spending authority." Paste your own notes here and save.',
  },
  {
    slug: 'aerseal',
    label: 'AERSeal',
    shortLabel: 'AERSeal',
    accent: 'cyan',
    knowledge: AERSEAL_KNOWLEDGE,
    customerLinks: [{ href: '/aerseal-customers', label: 'AERSeal Customers' }],
    discoveryHref: '/aerseal',
    defaultApproachPlaceholder:
      'Describe how to find AERseal customers — e.g. "Trigger-first: event → company → authority → gap → trigger → buyer. Target DeFi protocols, token/stablecoin issuers, bridges, L2/L3 operators, tokenization/RWA platforms, staking/restaking protocols, or DAOs whose deployed contract has a privileged role controlled by a single EOA or weak multisig." Paste your own notes here and save.',
  },
  {
    slug: 'aerkey',
    label: 'AERKey',
    shortLabel: 'AERKey',
    accent: 'blue',
    knowledge: AERKEY_KNOWLEDGE,
    customerLinks: [{ href: '/aerkey-customers', label: 'AERKey Customers' }],
    defaultApproachPlaceholder:
      'Describe how to find AERKey customers — e.g. "TEE-attested threshold ECDSA signing. Target companies needing cryptographic key governance, not just custody." Paste your own notes here and save.',
  },
  {
    slug: 'agent',
    label: 'Agent (Kima / Aeredium)',
    shortLabel: 'Agent',
    accent: 'orange',
    knowledge: `${KIMA_KNOWLEDGE}\n\n${AEREDIUM_KNOWLEDGE}`,
    customerLinks: [
      { href: '/web3-agent-companies', label: 'Web3 AI Agent Companies' },
      { href: '/web2-agent-companies', label: 'Web2 AI Agent Companies' },
    ],
    defaultApproachPlaceholder:
      'Describe how to find Kima/Aeredium-L1 customers. Paste your own notes here and save.',
  },
]

export function getProductSection(slug: string): ProductSection | undefined {
  return PRODUCT_SECTIONS.find(p => p.slug === slug)
}

// Maps the 3 products scored by /api/ai/discover to the `leads` fields that
// hold their result: the customer_category value the pipeline writes, and
// the fit column it fills in when a company qualifies for that product.
// (aeredium_fit is the DB column name for AER360 fit, kept for compatibility
// with when the product was called Aeredium.) AERseal additionally gets its
// own dedicated dossier pipeline (aerseal_score/aerseal_tier/aerseal_dossier)
// — see app/api/ai/discover-aerseal/route.ts.
export const PRODUCT_DISCOVERY: Partial<Record<ProductSlug, { category: string; fitField: 'aerpolice_fit' | 'aeredium_fit' | 'aerseal_fit' }>> = {
  aerpolice: { category: 'Aerpolice Governance Customer', fitField: 'aerpolice_fit' },
  aer360: { category: 'AER360 Custody / Key-Governance Customer', fitField: 'aeredium_fit' },
  aerseal: { category: 'AERseal Contract-Authority Customer', fitField: 'aerseal_fit' },
}

export interface ProductBadge { label: string; color: string }

// Which of the 4 dedicated-discovery products (AERseal/Aerpolice/AER360/
// AERKey) a lead belongs to, from the same customer_category/fit-field
// signals each product's own pipeline already writes (see PRODUCT_DISCOVERY
// above and each *-customers page's leadFieldsFor). Used anywhere a lead
// list spans multiple products and needs to show which one it's for — e.g.
// Pluto's Section, which otherwise has no way to tell an AERseal assignment
// from an Aerpolice one. Returns null when none match — the caller decides
// the fallback (e.g. the legacy Kima/Aeredium Web3/Web2/Other grouping).
export function productOfLead(lead: {
  customer_category?: string[] | null
  aerseal_score?: number | null
  aerseal_fit?: string | null
  aerpolice_score?: number | null
  aerpolice_fit?: string | null
  aeredium_fit?: string | null
}): ProductBadge | null {
  const cats = lead.customer_category || []
  if (lead.aerseal_score != null || cats.includes('AERseal Contract-Authority Customer') || !!lead.aerseal_fit) {
    return { label: 'AERseal', color: '#a78bfa' }
  }
  if (lead.aerpolice_score != null || cats.includes('Aerpolice Governance Customer') || cats.includes('Aerpolice Reachable Prospect') || !!lead.aerpolice_fit) {
    return { label: 'Aerpolice', color: '#22d3ee' }
  }
  if (cats.includes('AER360 Custody / Key-Governance Customer') || !!lead.aeredium_fit) {
    return { label: 'AER360', color: '#38bdf8' }
  }
  if (cats.includes('AERKey Customer')) {
    return { label: 'AERKey', color: '#60a5fa' }
  }
  return null
}

// Hex values for each ProductSection.accent name — matches the accent colors
// already used elsewhere in the app (e.g. the Lead Inbox "By Product" star/
// badge accents), so a product's own color stays consistent across every
// page that represents it (Resources run panel, Customers table border, etc).
export const ACCENT_HEX: Record<ProductSection['accent'], string> = {
  violet: '#a78bfa',
  blue: '#38bdf8',
  cyan: '#22d3ee',
  orange: '#fb923c',
}
