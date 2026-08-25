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
    customerLinks: [],
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
