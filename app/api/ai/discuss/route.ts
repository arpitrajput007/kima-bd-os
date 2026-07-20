import { claudeJSON, claudeText, CLAUDE_RESEARCH, CLAUDE_MINI } from "@/lib/claude"
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FULL_BRAIN } from '@/lib/kima-knowledge'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Live web research via Jina (no extra API key needed) ──────────────────────

// Read a page's text content. Capped + timed out so one slow page can't hang
// the whole discussion.
async function readUrl(url: string, cap = 6000): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return ''
    const t = await res.text()
    return t.slice(0, cap)
  } catch {
    return ''
  }
}

// Web search — returns the top results as text.
async function webSearch(query: string, cap = 4500): Promise<string> {
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return ''
    const t = await res.text()
    return t.slice(0, cap)
  } catch {
    return ''
  }
}

interface LeadRow {
  id: string
  company_name: string
  website?: string | null
  source_url?: string | null
  description?: string | null
  business_model?: string | null
  product_summary?: string | null
  supported_chains_or_rails?: string | null
  current_providers?: string | null
  customer_category?: string[] | null
  industry_category?: string | null
  product_to_sell?: string | null
  region?: string | null
  pain_point?: string | null
  pain_point_evidence?: string | null
  kima_fit?: string | null
  aeredium_fit?: string | null
  suggested_use_case?: string | null
  settlement_angle?: string | null
  security_angle?: string | null
  trigger_reason?: string | null
  lead_score?: number | null
  status?: string | null
  contacts?: { name?: string | null; role?: string | null }[] | null
}

function leadFacts(lead: LeadRow): string {
  const lines = [
    `Company: ${lead.company_name}`,
    lead.website && `Website: ${lead.website}`,
    lead.industry_category && `Industry: ${lead.industry_category}`,
    (lead.customer_category || []).length > 0 && `Customer category: ${(lead.customer_category || []).join(', ')}`,
    lead.region && `Region: ${lead.region}`,
    lead.description && `What they do: ${lead.description}`,
    lead.business_model && `Business model: ${lead.business_model}`,
    lead.product_summary && `Product: ${lead.product_summary}`,
    lead.supported_chains_or_rails && `Chains/rails: ${lead.supported_chains_or_rails}`,
    lead.current_providers && `Current providers: ${lead.current_providers}`,
    lead.pain_point && `Pain point: ${lead.pain_point}`,
    lead.pain_point_evidence && `Pain evidence: ${lead.pain_point_evidence}`,
    lead.trigger_reason && `Reason to reach out now: ${lead.trigger_reason}`,
    lead.kima_fit && `Kima fit: ${lead.kima_fit}`,
    lead.aeredium_fit && `Aeredium fit: ${lead.aeredium_fit}`,
    lead.settlement_angle && `Settlement angle: ${lead.settlement_angle}`,
    lead.security_angle && `Security angle: ${lead.security_angle}`,
    lead.suggested_use_case && `Suggested use case: ${lead.suggested_use_case}`,
    lead.product_to_sell && `Best product to sell: ${lead.product_to_sell}`,
    typeof lead.lead_score === 'number' && `Lead score: ${lead.lead_score}`,
    lead.source_url && `Source/proof: ${lead.source_url}`,
    (lead.contacts || []).length > 0 && `Known contacts: ${(lead.contacts || []).map(c => `${c.name || 'unknown'}${c.role ? ` (${c.role})` : ''}`).join(', ')}`,
  ].filter(Boolean)
  return lines.join('\n')
}

// Build a fresh research dossier by pulling the lead's own site, the proof URL,
// and a live web search. Done once per discussion (the client caches & resends).
async function buildDossier(lead: LeadRow): Promise<string> {
  const tasks: Promise<string>[] = []
  const labels: string[] = []

  if (lead.website) {
    labels.push(`THEIR SITE (${lead.website})`)
    tasks.push(readUrl(lead.website, 6000))
  }
  if (lead.source_url && lead.source_url !== lead.website) {
    labels.push(`TRIGGER SOURCE (${lead.source_url})`)
    tasks.push(readUrl(lead.source_url, 4000))
  }
  const cat = (lead.customer_category || [])[0] || lead.industry_category || 'crypto'
  const query = `${lead.company_name} ${cat} AI agents payments settlement governance latest news`
  labels.push(`WEB SEARCH "${query}"`)
  tasks.push(webSearch(query, 4500))

  const results = await Promise.all(tasks)
  const parts = results
    .map((r, i) => (r ? `=== ${labels[i]} ===\n${r}` : ''))
    .filter(Boolean)
  return parts.join('\n\n')
}

// Pull the Kima/Aeredium brain + what the agent has already learned, so answers
// are grounded in our products AND prior intelligence about this exact lead.
// Uses the centralized memory system (lib/agent-memory.ts) for up to 56 entries
// with type diversity, vs the old limit(20) by recency.
async function loadAgentContext(leadId: string): Promise<string> {
  const { fullMemory, loadKnowledge } = await import('@/lib/agent-memory')

  // Load lead-specific knowledge (tagged to this lead) separately first
  const { data: leadTaggedRaw } = await supabase
    .from('agent_knowledge')
    .select('title, content, knowledge_type, tags')
    .eq('status', 'active')
    .contains('tags', [`lead:${leadId}`])
    .limit(10)

  const leadTagged = leadTaggedRaw || []

  // Full memory excluding lead-specific (those are surfaced first above)
  const generalMemory = await fullMemory({ tags: [] })

  let ctx = ''
  if (leadTagged.length) {
    const fmt = (k: { knowledge_type: string; title: string; content: string }) =>
      `[${k.knowledge_type}] ${k.title}: ${k.content.slice(0, 350)}`
    ctx += `\n\nWHAT YOU'VE ALREADY LEARNED ABOUT THIS LEAD:\n${leadTagged.map(fmt).join('\n\n')}`
  }
  ctx += generalMemory

  return ctx
}

// ── DISTILL: turn a discussion into durable agent memory ──────────────────────
async function distill(leadId: string, transcript: { role: string; content: string }[]) {
  const { data: lead } = await supabase.from('leads').select('company_name').eq('id', leadId).single()
  const company = lead?.company_name || 'this lead'

  const convo = transcript
    .map(m => `${m.role === 'user' ? 'BD (Arpit)' : 'Agent'}: ${m.content}`)
    .join('\n\n')

  const parsed = await claudeJSON<{
    worth_saving?: boolean; title?: string; content?: string
    knowledge_type?: string; tags?: string[]
    new_rules?: Array<{ rule_type: string; rule: string; weight: number }>
  }>({
    model: CLAUDE_RESEARCH,
    maxTokens: 1200,
    system: `You are the memory engine for the Kima BD OS. Read a discussion between the BD person and the agent about a specific lead, and extract ONLY durable, reusable intelligence worth remembering. Skip pleasantries and obvious facts.`,
    user: `Discussion about "${company}":\n\n${convo}\n\nExtract what's worth saving to long-term memory. Return JSON:
{
  "worth_saving": true/false,
  "title": "short title (max 10 words)",
  "content": "150-350 words of specific, reusable insight: their tech, real objections raised and how to handle them, angles that resonated, competitive context, decision dynamics.",
  "knowledge_type": "one of: icp_signal | competitor_intel | market_trend | product_context | outreach_strategy | general",
  "tags": ["2-5 tags"],
  "new_rules": [{ "rule_type": "prioritize|reject|score_boost|score_penalty|outreach_style|source_preference", "rule": "GENERAL lesson only", "weight": 0 }]
}
Set worth_saving=false if nothing durable came up.`,
  })
  if (!parsed.worth_saving || !parsed.content) return { saved: false }

  const tags = [...(parsed.tags || []), `lead:${leadId}`]
  await supabase.from('agent_knowledge').insert({
    title: parsed.title || `Discussion: ${company}`,
    content: parsed.content,
    source_type: 'text',
    source_name: `Discussion: ${company}`,
    tags,
    knowledge_type: parsed.knowledge_type || 'general',
    status: 'active',
  })

  let rulesCreated = 0
  for (const rule of (parsed.new_rules || []).slice(0, 2)) {
    if (!rule.rule || rule.rule.length < 12) continue
    const { error } = await supabase.from('agent_rules').insert({
      rule_type: rule.rule_type || 'prioritize', rule: rule.rule, weight: rule.weight || 0, status: 'active',
    })
    if (!error) rulesCreated++
  }

  return { saved: true, title: parsed.title, rules_created: rulesCreated }
}

// ── Follow-up suggestions: concrete next actions grounded in named contacts ──
async function suggestFollowUps(params: {
  company: string
  contacts: { name?: string | null; role?: string | null }[]
  question: string
  reply: string
}): Promise<string[]> {
  const contactList = (params.contacts || [])
    .filter(c => c.name)
    .map(c => `${c.name}${c.role ? ` (${c.role})` : ''}`)
    .join(', ') || 'none on file'

  try {
    const parsed = await claudeJSON<{ follow_ups?: string[] }>({
      model: CLAUDE_MINI,
      maxTokens: 400,
      temperature: 0.6,
      system: `You suggest what a BD person would want to ask next in a chat with a sales-intelligence agent, right after reading the agent's answer. Suggest concrete, actionable next steps — not vague "tell me more" prompts. Favor requests for deliverables tied to a SPECIFIC named contact when one is known: an outreach note/message for that person, with the right channel and its real character limit (LinkedIn connection note ≈300 characters, LinkedIn InMail ≈2000, cold email — no hard limit but say "concise"). Also consider: objection handling, a comparison angle, or a next-step recommendation. Ground every suggestion in names/roles actually mentioned — never invent a person. Each suggestion must be phrased as something the BD person would type, first person implied (e.g. "Reachout note for Patricia within 300 characters" not "Should I write a note?").`,
      user: `Company: ${params.company}\nKnown contacts: ${contactList}\nBD's question: ${params.question}\nAgent's answer:\n${params.reply.slice(0, 2500)}\n\nReturn JSON: {"follow_ups": ["...", "...", "..."]} — exactly 3 suggestions, each under 90 characters.`,
    })
    return (parsed.follow_ups || []).filter(s => typeof s === 'string' && s.trim()).slice(0, 3)
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 400 })
  }

  try {
    const body = await req.json()

    // ── Distill mode: save what was learned (called when the panel closes) ──
    if (body.mode === 'distill') {
      if (!body.lead_id || !Array.isArray(body.transcript) || body.transcript.length < 2) {
        return NextResponse.json({ success: true, saved: false })
      }
      const result = await distill(body.lead_id, body.transcript)
      return NextResponse.json({ success: true, ...result })
    }

    // ── Chat mode ──
    const { lead_id, message, messages: history, dossier: clientDossier } = body
    if (!lead_id) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
    if (!message || !message.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*, contacts(name, role)')
      .eq('id', lead_id)
      .single()
    if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // First turn → do the live deep-dive once and hand the dossier back so the
    // client can resend it (no repeated fetching mid-conversation).
    let dossier: string = typeof clientDossier === 'string' ? clientDossier : ''
    if (!dossier) {
      dossier = await buildDossier(lead as LeadRow)
    }

    const agentContext = await loadAgentContext(lead_id)

    const systemPrompt = `You are the BD Intelligence Agent for Kima, Aeredium (incl. AERKey), and Aerpolice — complementary products we sell together. You are in a focused, deep-dive discussion about ONE specific lead. The BD person wants to truly understand this company — its tech, how AI agents feature in their product, and where Kima / Aeredium / AERKey / Aerpolice can each plug in — so they can have a smart, credible conversation with the prospect.

${FULL_BRAIN}

FOCUS — FOUR PRODUCTS, FOUR QUESTIONS TO ALWAYS KEEP IN MIND:
1. Aerpolice fit: Do they have AI agents taking real consequential actions (payments, data access, procurement, expense)? Are enterprise deals stalling in security review? → Aerpolice (identity, policy gate, audit trail)
2. Kima fit: Do they need to move value across chains, fiat corridors, or stablecoin rails? → Kima UPR / LaaS / DvP
3. Aeredium fit: Do they need institutional-grade settlement infrastructure or bank API connectivity? → Aeredium Institutional L1 / AERLink
4. AERKey fit: Do they run custody, an MPC/multisig wallet, or a signing operation (exchange, market maker, custodian, payment processor) that needs hardware-grade key governance? → Aeredium AERKey (TEE-attested threshold ECDSA signing). Call this out explicitly whenever the company touches private keys, custody, or signing — don't bury it under a generic "Aeredium fit" answer.

HOW YOU ANSWER:
- Start with their tech: explain how the company's product actually works before jumping to fit.
- Ground every answer in the live research and saved facts. Cite specifics (numbers, products, chains, events) — never generic filler.
- For every relevant product (Kima, Aeredium, AERKey, Aerpolice), state concretely WHERE it plugs in and what problem it solves for them specifically.
- If the research doesn't cover something, say what you'd verify and give your best-reasoned read, clearly marked as inference — don't bluff.
- Anticipate the PROSPECT's likely cross-questions and objections, and arm the BD person with crisp answers.
- Be direct and substantive. Short paragraphs or tight bullets. No fluff, no "great question", no corporate filler.

=== SAVED FACTS ON THIS LEAD ===
${leadFacts(lead as LeadRow)}

=== LIVE RESEARCH (fetched just now) ===
${dossier || '(live research returned nothing — rely on saved facts and reasoning, and flag the gap)'}
${agentContext}`

    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(history) ? history : []

    const { claudeText: ct } = await import('@/lib/claude')
    const reply = await ct({
      model: CLAUDE_RESEARCH,
      maxTokens: 1100,
      temperature: 0.7,
      system: systemPrompt,
      user: [
        ...historyMessages.slice(-16).map(m => `${m.role === 'user' ? 'BD' : 'Agent'}: ${m.content}`),
        `BD: ${message}`,
      ].join('\n\n'),
    }) || 'I had trouble with that — try rephrasing?'

    const followUps = await suggestFollowUps({
      company: lead.company_name,
      contacts: (lead as LeadRow).contacts || [],
      question: message,
      reply,
    })

    return NextResponse.json({ reply, dossier, followUps })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Discussion failed'
    console.error('[discuss route]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
