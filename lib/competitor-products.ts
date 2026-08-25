export type CompetitorProductSlug = 'agent' | 'aerseal' | 'aerpolice' | 'aer360'

export interface CompetitorProductDef {
  slug: CompetitorProductSlug
  name: string
  blurb: string
  color: string
}

export const COMPETITOR_PRODUCTS: CompetitorProductDef[] = [
  { slug: 'agent',     name: 'Aeredium L1', blurb: 'Core agentic-payments infrastructure', color: '#38bdf8' },
  { slug: 'aerseal',   name: 'AERseal',     blurb: 'Contract-authority transfer & lock-in removal', color: '#a78bfa' },
  { slug: 'aerpolice', name: 'AERpolice',   blurb: 'Compliance & fraud verification', color: '#34d399' },
  { slug: 'aer360',    name: 'AER360',      blurb: 'Full-lifecycle verification & monitoring', color: '#fbbf24' },
]

export function productBySlug(slug: string): CompetitorProductDef | undefined {
  return COMPETITOR_PRODUCTS.find(p => p.slug === slug)
}
