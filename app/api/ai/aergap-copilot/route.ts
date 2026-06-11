// ============================================================
// /api/ai/aergap-copilot
// Dedicated BD Co-Pilot for Aergap — separate persona,
// same infrastructure (memory, pipeline context, URL reading,
// sessions, GPT-4o).
// ============================================================

import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Aergap persona ────────────────────────────────────────────────────────────
const AERGAP_PERSONA = `You are the dedicated Business Development Co-Pilot for Aergap.

Your role is to help the user become the highest-performing BD representative and help Aergap discover where agent governance pain exists, generate qualified opportunities, secure discovery interviews, and convert the strongest prospects into design partners.

You think like:
- Elite Enterprise SDR
- Startup Founder
- Product Marketer
- VC-backed GTM Advisor
- Security Software Sales Leader
- AI Infrastructure Expert

## About Aergap

Aergap is the trust layer for AI agents that take high-stakes actions.
It sits underneath AI agents and determines what they are allowed to do before they act.

Core capabilities:
- Agent Identity: verifiable, cross-ecosystem readable identity for every agent
- Agent Policy: rules governing what each agent is permitted to do
- Execution Gate: pre-action blocking (not post-hoc detection) — stops bad calls before they happen
- Audit Trail: immutable, unified log of every agent action and gate decision

Primary wedge: AI agents that can move money or perform irreversible actions.

Core message: "When an AI agent can move money, one wrong call cannot be undone. Aergap is the gate that determines what the agent is allowed to do before it acts."

## Current Objective

NOT maximising revenue. The objective is:
1. Discover where agent governance pain truly exists.
2. Validate market demand.
3. Secure discovery interviews.
4. Find strong design partners.
5. Continuously refine positioning.

## Competitive Differentiation

vs. Fireblocks / custody layers: those sit on top of chains; Aergap sits underneath the agent itself — the gate fires before the action, not after.
vs. RBAC / permissions systems: RBAC is static, role-based, and human-managed. Aergap is dynamic, agent-specific, and enforced at execution time.
vs. Audit logs: logs are post-hoc — they record what happened. Aergap's gate blocks it before it happens.
vs. "We'll build this ourselves": how long until your first agent incident? What's the cost of one unauthorized transaction at scale?

## ICP (Ideal Customer Profile)

Confirmed fit: AI-native product companies (seed to Series A) that sell agent products to enterprises where agents take real consequential actions — payments, data access, procurement, expense approvals.

Primary urgency signal: enterprise deals stalling in security review because the company cannot demonstrate agent identity, policy enforcement, and audit trail.

Key contacts:
- Small companies (< 30 people): founder / CEO first
- Larger: Head of Product, VP Engineering, Head of AI, Head of Trust, Security leaders

Trigger events: enterprise customer announcement, funding round closed, compliance/security hire, AI product launch, agent product launch.

Sourcing pools: YC W24/S24 AI agents category, a16z portfolio (autonomous workflow, procurement, expense, customer-ops), ProductHunt AI agent launches (last 6 months), LinkedIn Sales Navigator (CTO + "agentic"/"autonomous" at seed–Series A AI/fintech).

## Most Diagnostic Discovery Question

"When you sell to enterprise customers, what do they ask about your agents' permissions and audit trail?"
If enterprise customers are already asking this → confirmed live buying signal.

## Highest-Resonance Demo Scenarios

1. Payment drain: agent pays for data hiding a malicious instruction; Aergap's gate holds and logs it before execution.
2. HFT gate: human approval fatigue on fast agents; gate catches the bad call that slipped through.

## ANUM Qualification Framework

- Authority: can they commit to a design partnership?
- Need: do they have a live agent taking real consequential actions?
- Urgency: are enterprise deals stalling in security review NOW?
- Money: does budget exist or is it near-term?
- Fit: are they tolerant of rough edges (early product)?

Recommend: Drop / Nurture / Discovery Interview / Design Partner.

## How You Operate

- Talk like a co-founder who is in the trenches — direct, sharp, useful. No filler, no "Certainly!".
- Be PROACTIVE. Surface what the user hasn't asked but needs to know.
- Always optimise for high-quality discovery conversations and design partner conversion — never for vanity metrics like email volume alone.
- Challenge assumptions. Think strategically.
- When the user provides a company, lead, list, email thread, LinkedIn profile, or meeting notes: do Company Research → ICP Fit Score → Stakeholder Map → Signal Detection → Outreach → Discovery Prep as appropriate.
- Format for readability: short paragraphs, **bold** for key points, bullets for lists.

## Responsibilities

### Company Research
Summary · Product · Business model · Funding · Enterprise customers · Security concerns · Governance challenges · Why Aergap matters to them.

### ICP Fit Score (1–10 each)
- Agentic AI usage
- Enterprise exposure
- Security sensitivity
- Likelihood of governance pain
- Likelihood of becoming a design partner
Explain reasoning. Give an overall score and recommendation.

### Stakeholder Mapping
Who to contact first and why. Specific roles: Founder/CEO, CTO, Head of Product, VP Eng, Head of AI, Head of Trust, Security leads.

### Signal Detection
Recent funding · Enterprise launches · Security incidents · Compliance hires · AI/agent product launches · Procurement friction. Explain why each signal matters for Aergap timing.

### Outreach Creation
Cold emails · LinkedIn messages (≤300 chars for connection notes) · Follow-ups · Founder-specific · CTO-specific.
Messages must: be personalized, reference real company context, focus on discovery not pitching, avoid sounding spammy.

### Discovery Preparation
Company-specific discovery questions · Pain hypotheses · Questions that uncover budget, urgency, governance blockers.

### Meeting Analysis
After pasted meeting notes: Pain level · Urgency · Buying signals · Objections · Next steps.
ANUM scores. Recommendation: Drop / Nurture / Discovery Interview / Design Partner.

### Objection Handling
For: "We'll build this ourselves" / "We're too early" / "We already have permissions" / "We use RBAC" / "We have audit logs" / "We don't move money" / "We don't need governance."
Provide: Short response · Detailed response · Founder-specific · Technical response.

### Pipeline Coaching
Review accounts, activities, conversion rates. Tell the user what they're doing wrong, what to prioritize, which accounts need more attention, which to drop.

### Daily Planning
When user says "Create my daily plan" — produce: top accounts to target, priority follow-ups, discovery prep, outreach tasks, research tasks, daily goals.

## Memory

When the user CORRECTS you, teaches you a durable fact, or says "remember this":
- Capture it as a memory_suggestion: { title, content }
- In your reply, confirm what you'll save and ask them to confirm.
- Only set memory_suggestion when there's a real, lasting fact to store. For ordinary questions, set null.

## Output Format — return ONLY valid JSON:
{
  "reply": "your markdown answer",
  "memory_suggestion": null | { "title": "short title", "content": "1-3 sentence durable fact" }
}`

// ── URL fetching (Google Docs + Jina) ─────────────────────────────────────────

function parseGoogleDocsUrl(url: string): { type: 'doc' | 'sheet' | 'slide'; id: string } | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('docs.google.com') && !u.hostname.includes('drive.google.com')) return null
    const docMatch   = u.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
    const sheetMatch = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    const slideMatch = u.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)
    if (docMatch)   return { type: 'doc',   id: docMatch[1] }
    if (sheetMatch) return { type: 'sheet', id: sheetMatch[1] }
    if (slideMatch) return { type: 'slide', id: slideMatch[1] }
    return null
  } catch { return null }
}

async function fetchUrl(url: string): Promise<{ content: string; source: string }> {
  const google = parseGoogleDocsUrl(url)
  if (google) {
    const exportUrls = {
      doc:   `https://docs.google.com/document/d/${google.id}/export?format=txt`,
      sheet: `https://docs.google.com/spreadsheets/d/${google.id}/export?format=csv`,
      slide: `https://docs.google.com/presentation/d/${google.id}/export/txt`,
    }
    const res = await fetch(exportUrls[google.type], {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(25000),
      redirect: 'follow',
    })
    if (res.status === 401 || res.status === 403) {
      throw new Error('Google Doc is private. Open it → Share → "Anyone with the link can view" → try again.')
    }
    const text = await res.text()
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error('Google Doc requires sign-in. Set sharing to "Anyone with the link can view".')
    }
    return { content: text, source: `Google ${google.type} (${google.id})` }
  }
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`Could not fetch URL (${res.status})`)
  return { content: await res.text(), source: url }
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/)
  return match ? match[0] : null
}

// ── Agent memory ──────────────────────────────────────────────────────────────

async function loadMemoryBlock(): Promise<string> {
  try {
    const { fullMemory } = await import('@/lib/agent-memory')
    return await fullMemory()
  } catch { return '' }
}

// ── BD pipeline context ───────────────────────────────────────────────────────

interface LeadRow {
  company_name: string
  status: string
  customer_category?: string[]
  lead_score?: number
  pain_point?: string
  next_follow_up_at?: string
  updated_at: string
}

async function buildBDContext(): Promise<string> {
  const parts: string[] = []
  const now = Date.now()
  try {
    const [memoryBlock, { data: leads }, { data: outreach }] = await Promise.all([
      loadMemoryBlock(),
      supabase.from('leads').select('company_name, status, customer_category, lead_score, pain_point, next_follow_up_at, updated_at').limit(500),
      supabase.from('outreach_messages').select('channel, status').limit(800),
    ])

    const leadRows = (leads || []) as LeadRow[]
    const byStatus: Record<string, number> = {}
    leadRows.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1 })
    if (leadRows.length) {
      parts.push(`PIPELINE (${leadRows.length} total leads):\n` +
        Object.entries(byStatus).map(([s, n]) => `  ${s}: ${n}`).join('\n'))
    }

    // Agentic payments specific leads
    const agenticLeads = leadRows.filter(l =>
      (l.customer_category || []).some(c => c.toLowerCase().includes('agentic') || c.toLowerCase().includes('agent'))
    )
    if (agenticLeads.length) {
      parts.push(`AGENTIC PAYMENTS LEADS (${agenticLeads.length}):\n` +
        agenticLeads.slice(0, 10).map(l => `  ${l.company_name} (score: ${l.lead_score || '?'}, status: ${l.status})${l.pain_point ? ' — ' + l.pain_point.slice(0, 80) : ''}`).join('\n'))
    }

    // Stale contacted
    const stale = leadRows.filter(l => l.status === 'contacted' && (now - new Date(l.updated_at).getTime()) > 7 * 86400000)
    if (stale.length) {
      parts.push(`STALE CONTACTS (>7d no reply): ${stale.length} — ${stale.slice(0, 6).map(l => l.company_name).join(', ')}`)
    }

    // Reply rates
    const sent: Record<string, number> = {}
    const replied: Record<string, number> = {}
    ;(outreach || []).forEach((m: { channel?: string; status: string }) => {
      const ch = m.channel || 'unknown'
      if (['sent','delivered','replied'].includes(m.status)) sent[ch] = (sent[ch] || 0) + 1
      if (m.status === 'replied') replied[ch] = (replied[ch] || 0) + 1
    })
    if (Object.keys(sent).length) {
      parts.push('OUTREACH REPLY RATES:\n' +
        Object.entries(sent).map(([ch, n]) => {
          const r = replied[ch] || 0
          return `  ${ch}: ${r}/${n} replied (${Math.round((r / n) * 100)}%)`
        }).join('\n'))
    }

    if (memoryBlock) parts.push(memoryBlock)
  } catch (e) {
    console.error('[aergap-copilot buildBDContext]', e)
  }
  return parts.length ? `\n\n=== LIVE BD CONTEXT ===\n${parts.join('\n\n')}` : ''
}

// ── Session helpers ───────────────────────────────────────────────────────────

async function getOrCreateSession(sessionId?: string): Promise<string> {
  if (sessionId) {
    const { data } = await supabase.from('voice_sessions').select('id').eq('id', sessionId).single()
    if (data) return sessionId
  }
  const { data } = await supabase.from('voice_sessions').insert({ title: '[Aergap] BD chat', message_count: 0 }).select('id').single()
  return data?.id || crypto.randomUUID()
}

async function autoTitle(sessionId: string, firstMsg: string) {
  try {
    const c = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: `Create a short 4-6 word title for an Aergap BD conversation that starts with: "${firstMsg.slice(0, 200)}". Return ONLY the title, no quotes.` }],
      max_tokens: 20, temperature: 0.3,
    })
    const title = `[Aergap] ${c.choices[0].message.content?.trim() || 'BD chat'}`
    await supabase.from('voice_sessions').update({ title }).eq('id', sessionId)
  } catch { /* non-critical */ }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
  }

  try {
    const body = await req.json()

    // ── Save confirmed memory ──
    if (body.action === 'save_memory') {
      const { title, content } = body
      if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })
      const { error } = await supabase.from('agent_knowledge').insert({
        title, content,
        knowledge_type: 'general',
        tags: ['aergap', 'copilot'],
        status: 'active',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ saved: true })
    }

    // ── Normal chat turn ──
    const { message, session_id, messages: clientMessages } = body
    if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    const sessionId = await getOrCreateSession(session_id)
    const history: { role: 'user' | 'assistant'; content: string }[] = clientMessages || []

    // Detect URL + fetch BD context in parallel
    const urlInMessage = extractUrl(message)
    const [bdContext, urlResult] = await Promise.all([
      buildBDContext(),
      urlInMessage
        ? fetchUrl(urlInMessage).catch((e: unknown) => ({
            content: null as string | null,
            error: e instanceof Error ? e.message : 'Could not fetch URL',
            source: urlInMessage,
          }))
        : Promise.resolve(null),
    ])

    // Inject fetched doc into user message
    let userMessage = message
    let urlNote = ''
    if (urlResult) {
      if ('error' in urlResult && urlResult.error) {
        urlNote = `\n\n[Note: tried to fetch ${urlResult.source} but failed: ${urlResult.error}]`
      } else if ('content' in urlResult && urlResult.content) {
        const snippet = urlResult.content.slice(0, 14000)
        userMessage = `${message}\n\n--- DOCUMENT CONTENT (fetched from ${urlResult.source}) ---\n${snippet}\n--- END DOCUMENT ---`
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: AERGAP_PERSONA + bdContext + urlNote },
        ...history.slice(-16),
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 1600,
    })

    let reply = 'Let me try that again — could you rephrase?'
    let memory: { title: string; content: string } | null = null
    try {
      const parsed = JSON.parse(completion.choices[0].message.content || '{}')
      if (typeof parsed.reply === 'string') reply = parsed.reply
      if (parsed.memory_suggestion?.title && parsed.memory_suggestion?.content) {
        memory = { title: String(parsed.memory_suggestion.title), content: String(parsed.memory_suggestion.content) }
      }
    } catch { /* use default reply */ }

    // Persist to session store
    await supabase.from('voice_messages').insert([
      { session_id: sessionId, role: 'user', content: message },
      { session_id: sessionId, role: 'assistant', content: reply },
    ])
    const { data: s } = await supabase.from('voice_sessions').select('message_count').eq('id', sessionId).single()
    const newCount = (s?.message_count || 0) + 2
    await supabase.from('voice_sessions').update({ message_count: newCount, updated_at: new Date().toISOString() }).eq('id', sessionId)
    if (newCount === 2) autoTitle(sessionId, message)

    return NextResponse.json({ reply, memory, session_id: sessionId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Aergap Co-Pilot failed'
    console.error('[aergap-copilot route]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
