// ============================================================
// TypeScript Types for Kima BD OS
// ============================================================

export type LeadStatus =
  | 'new'
  | 'researching'
  | 'qualified'
  | 'approved'
  | 'rejected'
  | 'contacted'
  | 'replied'
  | 'meeting_booked'
  | 'archived'
  | 'needs_more_research'

export type LeadPriority = 'excellent' | 'qualified' | 'needs_research' | 'low_priority'

export type PainPointSeverity = 'critical' | 'high' | 'medium' | 'low'

export type ContactConfidence = 'high' | 'medium' | 'low' | 'unknown'

export type SourceType =
  | 'website'
  | 'google_search'
  | 'twitter_profile'
  | 'linkedin_company'
  | 'telegram_group'
  | 'rss_feed'
  | 'defillama_category'
  | 'crunchbase_list'
  | 'ecosystem_directory'
  | 'hackathon_directory'
  | 'news_source'
  | 'manual_list'

export type OutreachChannel = 'telegram' | 'linkedin' | 'twitter' | 'email'

export type OutreachTone =
  | 'casual'
  | 'professional'
  | 'founder_to_founder'
  | 'concise'
  | 'strong_bd'

export type RuleType =
  | 'prioritize'
  | 'reject'
  | 'score_boost'
  | 'score_penalty'
  | 'outreach_style'
  | 'source_preference'

export type FeedbackAction =
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'contacted'
  | 'replied'
  | 'meeting_booked'
  | 'deal_closed'
  | 'needs_more_research'

export const INDUSTRY_CATEGORIES = [
  'Cross-border payment company',
  'PSP/payment gateway',
  'On/off-ramp provider',
  'Stablecoin payment company',
  'Wallet',
  'DEX',
  'Perp DEX',
  'Launchpad',
  'RWA platform',
  'iGaming/payment-heavy platform',
  'Neobank',
  'Fintech',
  'Exchange',
  'Chain ecosystem',
  'AI commerce/payment agent',
  'Treasury management platform',
  'Custody/payment infrastructure company',
  'Web2 company with payment/settlement friction',
  'Other',
] as const

export const CUSTOMER_CATEGORIES = [
  'Agentic Payments Customer',
  'LayerZero Customer',
  'Hacked Protocol',
  'Needs On/Off Ramp',
  'Fireblocks Customer',
  'Web2 Stablecoin Settlement Customer',
  'Other',
] as const

export const PRODUCTS_TO_SELL = [
  'Agentic payment rails',
  'Cross-chain settlement',
  'Stablecoin settlement',
  'Fiat on/off-ramp',
  'Treasury movement',
  'DvP settlement',
  'iGaming payments',
  'RWA settlement',
  'PSP settlement',
  'Wallet onboarding',
  'Launchpad participation',
  'Payment orchestration',
  'Cross-border USDT/USDC settlement',
] as const

export const REGIONS = [
  'Global',
  'North America',
  'Europe',
  'Asia',
  'Middle East',
  'Africa',
  'Southeast Asia',
  'South Asia',
  'Latin America',
  'MENA',
  'EU-India corridor',
  'UAE-India corridor',
  'US-India corridor',
] as const

export type IndustryCategory = (typeof INDUSTRY_CATEGORIES)[number]
export type CustomerCategory = (typeof CUSTOMER_CATEGORIES)[number]
export type ProductToSell = (typeof PRODUCTS_TO_SELL)[number]
export type Region = (typeof REGIONS)[number]

export interface Lead {
  id: string
  company_name: string
  website?: string
  industry_category?: string
  customer_category?: string[]
  product_to_sell?: string
  region?: string
  description?: string
  business_model?: string
  product_summary?: string
  supported_chains_or_rails?: string
  current_providers?: string
  competitor_or_current_provider?: string
  competitor_context?: string
  pain_point?: string
  pain_point_severity?: PainPointSeverity
  pain_point_evidence?: string
  kima_fit?: string
  aeredium_fit?: string
  suggested_use_case?: string
  trigger_reason?: string
  risk_angle?: string
  settlement_angle?: string
  security_angle?: string
  revenue_potential?: string
  integration_feasibility?: string
  source_url?: string
  source_summary?: string
  twitter_url?: string
  telegram_url?: string
  discord_url?: string
  facts?: Record<string, unknown>[]
  assumptions?: Record<string, unknown>[]
  lead_score?: number
  confidence_score?: number
  priority?: LeadPriority
  status: LeadStatus
  contacted_at?: string
  last_contacted_at?: string
  follow_up_stage?: number
  next_follow_up_at?: string
  last_channel?: string
  created_at: string
  updated_at: string
  contacts?: Contact[]
  outreach_messages?: OutreachMessage[]
}

export interface Contact {
  id: string
  lead_id: string
  name?: string
  role?: string
  company?: string
  linkedin_url?: string
  twitter_url?: string
  telegram?: string
  email?: string
  contact_confidence?: ContactConfidence
  reason_this_person?: string
  source_url?: string
  created_at: string
}

export interface OutreachMessage {
  id: string
  lead_id: string
  contact_id?: string
  channel?: OutreachChannel
  tone?: OutreachTone
  customer_category?: string
  product_to_sell?: string
  message?: string
  followup_1?: string
  followup_2?: string
  objection_reply?: string
  call_opening?: string
  meeting_agenda?: string
  status: 'draft' | 'sent' | 'delivered' | 'replied' | 'archived'
  created_at: string
  updated_at: string
}

export interface Source {
  id: string
  source_name: string
  source_type?: SourceType
  source_url_or_query?: string
  target_industry_category?: string
  target_customer_category?: string
  frequency?: 'daily' | 'weekly' | 'manual'
  quality_rating?: 'excellent' | 'good' | 'average' | 'poor' | 'unrated'
  status: 'active' | 'paused'
  notes?: string
  last_run_at?: string
  leads_generated?: number
  created_at: string
  updated_at: string
}

export interface FeedbackMemory {
  id: string
  lead_id: string
  contact_id?: string
  outreach_id?: string
  action_taken?: FeedbackAction
  lead_quality?: 'excellent' | 'good' | 'average' | 'poor'
  pain_point_accuracy?: 'very_accurate' | 'mostly_accurate' | 'partially_accurate' | 'inaccurate'
  contact_accuracy?: 'perfect' | 'good' | 'off' | 'wrong'
  message_quality?: 'excellent' | 'good' | 'needs_work' | 'poor'
  outcome?: 'replied' | 'meeting_booked' | 'deal_in_progress' | 'deal_closed' | 'no_response' | 'rejected_by_prospect' | 'not_yet_sent'
  rejection_reason?: string
  arpit_notes?: string
  created_at: string
  lead?: Lead
}

export interface AgentRule {
  id: string
  rule_type?: RuleType
  rule: string
  weight: number
  status: 'active' | 'inactive' | 'pending_approval'
  created_at: string
  updated_at: string
}

export interface LearningReport {
  id: string
  report_period?: string
  summary?: string
  winning_patterns?: Record<string, unknown>[]
  rejected_patterns?: Record<string, unknown>[]
  best_sources?: Record<string, unknown>[]
  worst_sources?: Record<string, unknown>[]
  best_customer_categories?: Record<string, unknown>[]
  worst_customer_categories?: Record<string, unknown>[]
  best_products_to_sell?: Record<string, unknown>[]
  scoring_changes_suggested?: Record<string, unknown>[]
  outreach_changes_suggested?: Record<string, unknown>[]
  new_rules_suggested?: Record<string, unknown>[]
  status: 'pending_review' | 'approved' | 'archived'
  created_at: string
}

export interface AgentKnowledge {
  id: string
  title: string
  content: string
  source_type?: 'file' | 'url' | 'text' | 'image' | 'screenshot'
  source_name?: string
  tags?: string[]
  rules_created?: number
  sources_created?: number
  knowledge_type?: string
  status: 'active' | 'archived'
  created_at: string
}

// Scoring system
export interface ScoreBreakdown {
  pain_point_score: number
  traction_score: number
  contact_score: number
  trigger_score: number
  category_fit_score: number
  integration_feasibility_score: number
  revenue_potential_score: number
  category_boost: number
  penalties: number
  total: number
  priority: LeadPriority
}
