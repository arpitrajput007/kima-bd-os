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

export type DealStatus           = (typeof DEAL_STATUSES)[number]['value']
export type LeadType             = (typeof LEAD_TYPES)[number]
export type OutreachChannelValue = (typeof OUTREACH_CHANNELS)[number]['value']
export type BlockerTypeValue     = (typeof BLOCKER_TYPES)[number]['value']
export type ActivityTypeValue    = (typeof ACTIVITY_TYPES)[number]['value']

export interface DealBlocker {
  type: BlockerTypeValue
  notes?: string
  resolved: boolean
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

// ── Helpers ──────────────────────────────────────────────────────

export function dealStatusMeta(status: DealStatus) {
  return DEAL_STATUSES.find(s => s.value === status) ?? DEAL_STATUSES[0]
}

export function fmtMonthYear(my: string): string {
  const [y, m] = my.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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
