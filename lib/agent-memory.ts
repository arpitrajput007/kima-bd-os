// ============================================================
// lib/agent-memory.ts — Centralized long-term memory system
// ------------------------------------------------------------
// Every AI route imports from here so learned intelligence,
// agent rules, and feedback patterns are consistent everywhere.
//
// Capacity strategy: instead of limit(20-30) by recency
// (which silently drops old knowledge), we pull up to PER_TYPE_LIMIT
// entries from EACH knowledge_type category. This gives up to
// 8 × 7 = 56 diverse knowledge entries vs the old 20-30, and
// guarantees that competitor intel, ICP signals, outreach
// strategies etc. are never crowded out by a single dominant type.
//
// Future path: replace this with pgvector semantic search for
// truly unlimited memory (find relevant entries by similarity
// to the current lead/prompt rather than just recency).
// ============================================================

import { createClient } from '@supabase/supabase-js'

// ── Supabase client (server-side) ────────────────────────────
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Types ─────────────────────────────────────────────────────
export interface AgentRule {
  rule_type: string
  rule: string
  weight: number
}

export interface AgentKnowledge {
  title: string
  content: string
  knowledge_type: string
  tags: string[]
  created_at: string
}

// ── Constants ─────────────────────────────────────────────────
// All recognized knowledge types — we query each individually
// so no single type crowds out the others.
const KNOWLEDGE_TYPES = [
  'icp_signal',
  'competitor_intel',
  'market_trend',
  'product_context',
  'outreach_strategy',
  'source_directory',
  'general',
] as const

// How many entries to pull per knowledge_type.
// 8 × 7 types = up to 56 total, compared to the old flat limit(20-30).
const PER_TYPE_LIMIT = 8

// Max rules to pull (ordered by weight desc so strongest rules first).
const RULES_LIMIT = 60

// ── Load active rules ─────────────────────────────────────────
// Pull all active rules, sorted by weight so the most important
// ones appear first in the context window.
export async function loadRules(opts?: {
  types?: string[] // filter to specific rule_types, e.g. ['outreach_style']
}): Promise<AgentRule[]> {
  let q = db()
    .from('agent_rules')
    .select('rule_type, rule, weight')
    .eq('status', 'active')
    .order('weight', { ascending: false })
    .limit(RULES_LIMIT)

  if (opts?.types?.length) {
    q = q.in('rule_type', opts.types) as typeof q
  }

  const { data } = await q
  return (data || []) as AgentRule[]
}

// ── Load knowledge with type-diversity guarantee ──────────────
// Fetches from each knowledge_type in parallel, then merges.
// If `tags` are provided, tag-matching entries are sorted to the top
// (relevant to the current lead/context).
export async function loadKnowledge(opts?: {
  tags?: string[]          // boost entries that match these tags
  types?: string[]         // restrict to specific knowledge types
  perTypeLimit?: number    // override PER_TYPE_LIMIT
}): Promise<AgentKnowledge[]> {
  const types = opts?.types || [...KNOWLEDGE_TYPES]
  const limit = opts?.perTypeLimit ?? PER_TYPE_LIMIT

  // Fetch each type in parallel
  const batches = await Promise.all(
    types.map(ktype =>
      db()
        .from('agent_knowledge')
        .select('title, content, knowledge_type, tags, created_at')
        .eq('status', 'active')
        .eq('knowledge_type', ktype)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(r => (r.data || []) as AgentKnowledge[])
    )
  )

  let all = batches.flat()

  // Boost tag-matching entries to front of list
  if (opts?.tags?.length) {
    const lowerTags = opts.tags.map(t => t.toLowerCase())
    const matching = all.filter(k =>
      k.tags?.some(t => lowerTags.includes(t.toLowerCase()))
    )
    const rest = all.filter(k =>
      !k.tags?.some(t => lowerTags.includes(t.toLowerCase()))
    )
    all = [...matching, ...rest]
  }

  return all
}

// ── Load feedback patterns ────────────────────────────────────
// Summarises outcome signals from feedback_memory so the agent
// learns which lead types work and which to avoid.
export async function loadFeedbackPatterns(): Promise<string> {
  const { data } = await db()
    .from('feedback_memory')
    .select(`
      lead_quality,
      action_taken,
      rejection_reason,
      outcome,
      leads (
        company_name,
        customer_category,
        product_to_sell,
        industry_category,
        lead_score
      )
    `)
    .not('lead_quality', 'is', null)
    .order('created_at', { ascending: false })
    .limit(60)

  if (!data || data.length === 0) return ''

  type FeedbackRow = typeof data[0]

  const excellent = data.filter((f: FeedbackRow) =>
    f.lead_quality === 'excellent' ||
    f.outcome === 'meeting_booked' ||
    f.outcome === 'deal_in_progress' ||
    f.outcome === 'deal_closed'
  )
  const poor = data.filter((f: FeedbackRow) =>
    f.lead_quality === 'poor' ||
    f.action_taken === 'rejected' ||
    f.outcome === 'rejected_by_prospect'
  )
  const replied = data.filter((f: FeedbackRow) => f.outcome === 'replied')

  const fmt = (f: FeedbackRow) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lead = f.leads as any
    const parts = [
      lead?.company_name,
      lead?.customer_category ? `(${lead.customer_category})` : null,
      lead?.product_to_sell ? `→ ${lead.product_to_sell}` : null,
      f.rejection_reason ? `rejected: "${f.rejection_reason}"` : null,
    ].filter(Boolean)
    return `• ${parts.join(' ')}`
  }

  const lines: string[] = []
  if (excellent.length) {
    lines.push(`HIGH-VALUE PATTERNS (meetings/deals): use these as scoring boosts\n${excellent.slice(0, 8).map(fmt).join('\n')}`)
  }
  if (replied.length) {
    lines.push(`REPLIED (positive signal): similar leads responded\n${replied.slice(0, 6).map(fmt).join('\n')}`)
  }
  if (poor.length) {
    lines.push(`REJECTED / LOW QUALITY (avoid these patterns):\n${poor.slice(0, 10).map(fmt).join('\n')}`)
  }

  return lines.join('\n\n')
}

// ── Format rules as a prompt block ───────────────────────────
function formatRules(rules: AgentRule[]): string {
  if (!rules.length) return ''
  const grouped: Record<string, string[]> = {}
  for (const r of rules) {
    if (!grouped[r.rule_type]) grouped[r.rule_type] = []
    grouped[r.rule_type].push(r.rule)
  }
  return Object.entries(grouped)
    .map(([type, list]) =>
      `[${type.toUpperCase()}]\n${list.map(r => `• ${r}`).join('\n')}`
    )
    .join('\n\n')
}

// ── Format knowledge as a prompt block ───────────────────────
function formatKnowledge(knowledge: AgentKnowledge[], maxContentLen = 500): string {
  if (!knowledge.length) return ''
  const typeCounts = [...new Set(knowledge.map(k => k.knowledge_type))]
  const header = `${knowledge.length} entries across ${typeCounts.length} categories: ${typeCounts.join(', ')}`
  return header + '\n\n' + knowledge
    .map(k =>
      `[${k.knowledge_type.toUpperCase()}] ${k.title}\n${k.content.slice(0, maxContentLen)}`
    )
    .join('\n\n---\n\n')
}

// ── Master context builder ────────────────────────────────────
// Call this from any AI route to inject the full memory context.
//
//   const memory = await buildMemoryContext({ tags: lead.tags, includeFeedback: true })
//   // Then add `memory` to your system prompt.
//
export interface MemoryContextOpts {
  tags?: string[]           // boost knowledge matching these tags
  ruleTypes?: string[]      // filter rules to specific types
  knowledgeTypes?: string[] // filter knowledge to specific types
  includeFeedback?: boolean // include feedback_memory patterns
  maxContentLen?: number    // how many chars of each knowledge entry to include (default 500)
}

export async function buildMemoryContext(opts?: MemoryContextOpts): Promise<string> {
  const [rules, knowledge, feedback] = await Promise.all([
    loadRules({ types: opts?.ruleTypes }),
    loadKnowledge({ tags: opts?.tags, types: opts?.knowledgeTypes }),
    opts?.includeFeedback ? loadFeedbackPatterns() : Promise.resolve(''),
  ])

  const parts: string[] = []

  if (rules.length) {
    parts.push(`══ AGENT RULES (${rules.length} active — apply these to every decision) ══\n\n${formatRules(rules)}`)
  }

  if (knowledge.length) {
    parts.push(
      `══ LEARNED INTELLIGENCE ══\n\n${formatKnowledge(knowledge, opts?.maxContentLen ?? 500)}`
    )
  }

  if (feedback) {
    parts.push(`══ FEEDBACK PATTERNS (from real outreach outcomes) ══\n\n${feedback}`)
  }

  if (!parts.length) return ''

  return `\n\n${'═'.repeat(60)}\nAGENT LONG-TERM MEMORY\n${'═'.repeat(60)}\n\n${parts.join('\n\n────────────────────────────────────────────────────────────\n\n')}\n${'═'.repeat(60)}`
}

// ── Convenience shorthands ────────────────────────────────────

// For outreach: pull outreach_style rules + icp/competitor/general knowledge
export async function outreachMemory(opts?: { tags?: string[] }): Promise<string> {
  return buildMemoryContext({
    tags: opts?.tags,
    // Outreach uses ALL rule types (especially outreach_style)
    knowledgeTypes: ['outreach_strategy', 'icp_signal', 'competitor_intel', 'market_trend', 'general'],
    includeFeedback: true,
    maxContentLen: 400,
  })
}

// For scoring/qualify: pull scoring rules + ICP signals
export async function scoringMemory(opts?: { tags?: string[] }): Promise<string> {
  return buildMemoryContext({
    tags: opts?.tags,
    ruleTypes: ['prioritize', 'reject', 'score_boost', 'score_penalty'],
    knowledgeTypes: ['icp_signal', 'competitor_intel', 'market_trend', 'general'],
    includeFeedback: true,
    maxContentLen: 400,
  })
}

// For discovery: full memory + feedback patterns for broad signal
export async function discoveryMemory(): Promise<string> {
  return buildMemoryContext({
    includeFeedback: true,
    maxContentLen: 500,
  })
}

// For discussion / copilot: everything
export async function fullMemory(opts?: { tags?: string[] }): Promise<string> {
  return buildMemoryContext({
    tags: opts?.tags,
    includeFeedback: true,
    maxContentLen: 500,
  })
}
