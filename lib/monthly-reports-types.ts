// ── Monthly Performance Reports — TypeScript Types ────────────────

export const DEAL_STATUSES = [
  { value: 'new',                  label: 'New',                  color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'contacted',            label: 'Contacted',            color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  { value: 'discovery',            label: 'Discovery',            color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { value: 'demo',                 label: 'Demo',                 color: '#22d3ee', bg: 'rgba(34,211,238,0.12)'  },
  { value: 'technical_discussion', label: 'Technical Discussion', color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  { value: 'proposal_sent',        label: 'Proposal Sent',        color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  { value: 'negotiation',          label: 'Negotiation',          color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  { value: 'closed_won',           label: 'Closed Won',           color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  { value: 'closed_lost',          label: 'Closed Lost',          color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
] as const

export const LEAD_TYPES = [
  'B2B', 'B2C', 'Partner', 'Investor', 'Exchange',
  'Protocol', 'AI Agent Builder', 'Enterprise', 'Other',
] as const

export const OUTREACH_CHANNELS = [
  { value: 'email',      label: 'Email'              },
  { value: 'linkedin',   label: 'LinkedIn'           },
  { value: 'twitter',    label: 'X (Twitter)'        },
  { value: 'telegram',   label: 'Telegram'           },
  { value: 'discord',    label: 'Discord'            },
  { value: 'event',      label: 'Event'              },
  { value: 'warm_intro', label: 'Warm Introduction'  },
  { value: 'other',      label: 'Other'              },
] as const

export const BLOCKER_TYPES = [
  { value: 'waiting_response',    label: 'Waiting for Response' },
  { value: 'compliance',          label: 'Compliance'           },
  { value: 'technical',           label: 'Technical Integration'},
  { value: 'pricing',             label: 'Pricing'              },
  { value: 'budget',              label: 'Budget'               },
  { value: 'internal_approval',   label: 'Internal Approval'    },
  { value: 'legal',               label: 'Legal'                },
  { value: 'product_limitation',  label: 'Product Limitation'   },
  { value: 'timing',              label: 'Timing'               },
  { value: 'competition',         label: 'Competition'          },
] as const

export const ACTIVITY_TYPES = [
  { value: 'note',          label: 'Note'          },
  { value: 'follow_up',     label: 'Follow-up'     },
  { value: 'meeting',       label: 'Meeting'       },
  { value: 'email',         label: 'Email'         },
  { value: 'linkedin',      label: 'LinkedIn'      },
  { value: 'twitter',       label: 'X / Twitter'   },
  { value: 'telegram',      label: 'Telegram'      },
  { value: 'call',          label: 'Call'          },
  { value: 'status_change', label: 'Status Change' },
  { value: 'next_action',   label: 'Next Action'   },
] as const

export const KIMA_PRODUCTS = [
  'Kima Protocol',
  'Aeredium',
  'Aergap',
  'Cross-chain settlement',
  'Stablecoin settlement',
  'Fiat on/off-ramp',
  'Treasury movement',
  'DvP settlement',
  'Agentic payment rails',
  'PSP settlement',
  'Payment orchestration',
  'Cross-border USDT/USDC settlement',
] as const

export const PRODUCT_DEMAND_CATEGORIES = [
  { value: 'feature_requested',        label: 'Feature Request'        },
  { value: 'missing_functionality',    label: 'Missing Functionality'  },
  { value: 'product_gaps',             label: 'Product Gap'            },
  { value: 'integration_requested',    label: 'Integration'            },
  { value: 'api_requirements',         label: 'API Requirement'        },
  { value: 'compliance_requirements',  label: 'Compliance'             },
  { value: 'technical_blockers',       label: 'Technical Blocker'      },
] as const

export const PRODUCT_DEMAND_STATUSES = [
  { value: 'open',     label: 'Open',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  { value: 'planned',  label: 'Planned',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  { value: 'shipped',  label: 'Shipped',   color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  { value: 'wont_fix', label: "Won't Fix", color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
] as const

export type DealStatus            = (typeof DEAL_STATUSES)[number]['value']
export type LeadType              = (typeof LEAD_TYPES)[number]
export type OutreachChannelValue  = (typeof OUTREACH_CHANNELS)[number]['value']
export type BlockerTypeValue      = (typeof BLOCKER_TYPES)[number]['value']
export type ActivityTypeValue     = (typeof ACTIVITY_TYPES)[number]['value']
export type ProductDemandCategory = (typeof PRODUCT_DEMAND_CATEGORIES)[number]['value']
export type ProductDemandStatus   = (typeof PRODUCT_DEMAND_STATUSES)[number]['value']

export interface DealBlocker {
  type: string          // one of BLOCKER_TYPES values, or a custom slug
  label?: string         // display label for custom blockers (not in BLOCKER_TYPES)
  notes?: string
  resolved: boolean
}

export interface ProductDemandClient {
  company: string
  deal_id?: string
  monthly_volume?: string       // raw text, e.g. "$2M/month" — as entered on the deal
  estimated_revenue?: string    // raw text, e.g. "$200K/year"
  strategic_importance?: string
  monthly_volume_usd?: number | null   // best-effort parsed monthly USD estimate
}

export interface ProductFeatureDemand {
  id: string
  title: string
  description?: string
  category: ProductDemandCategory | string
  mention_count: number
  companies: string[]
  client_details: ProductDemandClient[]
  status: ProductDemandStatus
  first_seen: string
  last_seen: string
  created_at: string
  updated_at: string
}

export interface DealProductFeedback {
  feature_requested?: string
  missing_functionality?: string
  product_gaps?: string
  integration_requested?: string
  api_requirements?: string
  compliance_requirements?: string
  technical_blockers?: string
}

export interface MonthlyDeal {
  id: string
  // Company
  company_name: string
  individual_name?: string
  designation?: string
  website?: string
  industry?: string
  country?: string
  // Classification
  lead_type?: string
  // Opportunity
  requirement?: string
  problem_statement?: string
  products_interested?: string[]
  products_proposed?: string[]
  status: DealStatus
  expected_close_date?: string
  // Business Potential
  expected_monthly_volume?: string
  expected_yearly_volume?: string
  estimated_revenue?: string
  geographic_corridor?: string
  use_case?: string
  end_users_count?: string
  strategic_importance?: 'low' | 'medium' | 'high'
  // Business Impact
  business_impact?: string
  why_valuable?: string
  best_product_fit?: string
  long_term_value?: string
  // Structured feedback & blockers (JSONB in DB)
  product_feedback?: DealProductFeedback
  blockers?: DealBlocker[]
  // Outreach
  outreach_channel?: string
  // Meta
  month_year: string   // "YYYY-MM"
  owner?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface DealActivity {
  id: string
  deal_id: string
  activity_type: ActivityTypeValue
  content?: string
  channel?: string
  next_follow_up_date?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface TimeAllocation {
  id: string
  month_year: string
  responsibility: string
  percentage: number
  notes?: string
  created_at: string
  updated_at: string
}

// ── Helpers ──────────────────────────────────────────────────────

export function dealStatusMeta(status: DealStatus) {
  return DEAL_STATUSES.find(s => s.value === status) ?? DEAL_STATUSES[0]
}

export function blockerLabel(b: DealBlocker): string {
  const meta = BLOCKER_TYPES.find(t => t.value === b.type)
  if (meta) return meta.label
  if (b.label) return b.label
  return b.type.replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function productDemandStatusMeta(status: string) {
  return PRODUCT_DEMAND_STATUSES.find(s => s.value === status) ?? PRODUCT_DEMAND_STATUSES[0]
}

export function productDemandCategoryLabel(category: string): string {
  return PRODUCT_DEMAND_CATEGORIES.find(c => c.value === category)?.label ?? category.replace(/_/g, ' ')
}

// Best-effort extraction of a monthly USD figure out of free-text volume/revenue
// fields like "$2M/month", "$24M/year", "$500K", "2.5M". Returns null when the
// text has no parseable amount — callers should treat the result as directional,
// not authoritative (source data is a free-text field, not a structured number).
export function parseUsdMonthly(text?: string | null): number | null {
  if (!text) return null
  const match = text.match(/([\d,]+(?:\.\d+)?)\s*([kmb])?/i)
  if (!match) return null
  const amount = parseFloat(match[1].replace(/,/g, ''))
  if (!Number.isFinite(amount)) return null
  const suffix = match[2]?.toLowerCase()
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1
  let usd = amount * multiplier
  if (/year|yr|annum|\/yr|\/y\b/i.test(text)) usd = usd / 12
  return usd
}

export function fmtUsdCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `$${Math.round(n)}`
}

export function sumClientMonthlyVolume(clients: ProductDemandClient[]): { total: number; parsedCount: number } {
  const parsed = clients.map(c => c.monthly_volume_usd).filter((v): v is number => v != null && v > 0)
  return { total: parsed.reduce((a, b) => a + b, 0), parsedCount: parsed.length }
}

export function fmtMonthYear(my: string): string {
  const [y, m] = my.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function fmtMonthShort(my: string): string {
  const [y, m] = my.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export function currentMonthYear(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function last12Months(): string[] {
  const months: string[] = []
  const d = new Date()
  for (let i = 0; i < 12; i++) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return months
}

export function activityTypeMeta(type: string) {
  return ACTIVITY_TYPES.find(a => a.value === type) ?? ACTIVITY_TYPES[0]
}
