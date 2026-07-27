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
  id?: string
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
// 436 active rules at ~15 words each is well within budget for Sonnet/GPT-4o
// context — a hard 60-row cap was silently dropping ~85% of everything
// taught via the Learn page or weekly reports.
const RULES_LIMIT = 300

// rule_types that act as guardrails ("never do X") rather than a ranking —
// these must never be cut by the weight sort, since a low/negative weight is
// how a "reject" rule is normally written, not a sign it's unimportant.
export const GUARDRAIL_TYPES = ['reject', 'score_penalty'] as const

// ── Duplicate detection for newly-learned rules ────────────────
// The Learn page and Discuss chat both mint new agent_rules from free-form
// content, with no dedup — the same lesson taught twice (or phrased two
// ways across two documents) creates two rows forever. This is a cheap
// word-overlap check (Jaccard on normalized token sets) run before insert;
// no new schema or extension needed.
function normalizeRuleWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2) // drop stopword-ish noise (a, to, is, ...)
  )
}

export function isDuplicateRule(candidate: string, existingRules: string[], threshold = 0.6): boolean {
  const candWords = normalizeRuleWords(candidate)
  if (candWords.size === 0) return false
  for (const existing of existingRules) {
    const exWords = normalizeRuleWords(existing)
    if (exWords.size === 0) continue
    let overlap = 0
    for (const w of candWords) if (exWords.has(w)) overlap++
    const union = candWords.size + exWords.size - overlap
    if (union > 0 && overlap / union >= threshold) return true
  }
  return false
}

// ── Load active rules ─────────────────────────────────────────
// Guardrail rule_types (reject/score_penalty) are always included in full.
// The remainder is sorted by weight desc so the strongest preferences fill
// out the rest of the budget.
export async function loadRules(opts?: {
  types?: string[] // filter to specific rule_types, e.g. ['outreach_style']
}): Promise<AgentRule[]> {
  const wantedTypes = opts?.types?.length ? opts.types : null
  const guardrailTypes = wantedTypes
    ? GUARDRAIL_TYPES.filter(t => wantedTypes.includes(t))
    : GUARDRAIL_TYPES
  const rankedTypes = wantedTypes
    ? wantedTypes.filter(t => !(GUARDRAIL_TYPES as readonly string[]).includes(t))
    : null // null = all non-guardrail types

  let guardrailQ = db()
    .from('agent_rules')
    .select('rule_type, rule, weight')
    .eq('status', 'active')
    .order('weight', { ascending: true }) // most-negative (strongest reject) first

  guardrailQ = guardrailTypes.length
    ? (guardrailQ.in('rule_type', guardrailTypes) as typeof guardrailQ)
    : (guardrailQ.in('rule_type', []) as typeof guardrailQ) // caller excluded guardrails entirely

  let rankedQ = db()
    .from('agent_rules')
    .select('rule_type, rule, weight')
    .eq('status', 'active')
    .not('rule_type', 'in', `(${GUARDRAIL_TYPES.join(',')})`)
    .order('weight', { ascending: false })
    .limit(RULES_LIMIT)

  if (rankedTypes) {
    rankedQ = rankedTypes.length
      ? (rankedQ.in('rule_type', rankedTypes) as typeof rankedQ)
      : (rankedQ.in('rule_type', []) as typeof rankedQ)
  }

  const [guardrails, ranked] = await Promise.all([
    guardrailTypes.length ? guardrailQ : Promise.resolve({ data: [] }),
    rankedQ,
  ])

  return [...(guardrails.data || []), ...(ranked.data || [])] as AgentRule[]
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
  const tags = opts?.tags?.length ? opts.tags : null
  const cols = 'id, title, content, knowledge_type, tags, created_at'

  // Fetch each type in parallel. When tags are given, query tag-matching
  // rows directly (not just reorder afterward) — otherwise a well-tagged
  // but older entry sits outside the recency window and never gets pulled
  // in at all, making the "boost" purely cosmetic.
  const batches = await Promise.all(
    types.map(async ktype => {
      if (!tags) {
        const { data } = await db()
          .from('agent_knowledge')
          .select(cols)
          .eq('status', 'active')
          .eq('knowledge_type', ktype)
          .order('created_at', { ascending: false })
          .limit(limit)
        return (data || []) as AgentKnowledge[]
      }

      const [{ data: matched }, { data: recent }] = await Promise.all([
        db()
          .from('agent_knowledge')
          .select(cols)
          .eq('status', 'active')
          .eq('knowledge_type', ktype)
          .overlaps('tags', tags)
          .order('created_at', { ascending: false })
          .limit(limit),
        db()
          .from('agent_knowledge')
          .select(cols)
          .eq('status', 'active')
          .eq('knowledge_type', ktype)
          .order('created_at', { ascending: false })
          .limit(limit),
      ])

      const matchedRows = (matched || []) as AgentKnowledge[]
      const seen = new Set(matchedRows.map(r => r.id))
      const fill = ((recent || []) as AgentKnowledge[]).filter(r => !seen.has(r.id))
      return [...matchedRows, ...fill].slice(0, limit)
    })
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
