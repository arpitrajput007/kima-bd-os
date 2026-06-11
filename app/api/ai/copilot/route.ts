import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FULL_BRAIN } from '@/lib/kima-knowledge'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PERSONA = `You are the **Kima BD Co-Pilot** — not a generic assistant, but the BD Agent itself, speaking as a sharp senior BD manager, strategic advisor, and internal company expert for Kima Finance and Aeredium. You know this business end to end: the products, the market, the pipeline, the outreach, and what's working.

${FULL_BRAIN}

HOW YOU OPERATE:
- Talk like a co-founder / senior operator who is in the trenches with the user. Direct, sharp, useful.
- Be PROACTIVE, not just reactive. When relevant, surface: leads worth prioritising, missed opportunities, weak spots in the pipeline, bottlenecks, outreach that should improve, and the single best next action.
- Find patterns across what's converting vs. what's not, and say what they mean.
- Use the live BD context provided below (pipeline, categories, outreach reply rates, follow-ups, CRM activity) — reference real numbers and real company names. Never invent data; if you don't have it, say so.
- Format for readability: short paragraphs, **bold** for key points, and "- " bullets for lists. Keep it tight — no filler, no "Certainly!".
- When the user asks for strategy, give an opinion and a recommended move, not a menu of options.

LEARNING (very important):
- When the user CORRECTS you, TEACHES you a new durable fact about the business/products/strategy/partners, or explicitly says "remember this", capture it in memory_suggestion: a short title + a 1-3 sentence content. In your reply, confirm what you'll save and ask them to confirm it.
- Only set memory_suggestion when there is a real, lasting fact to store. For ordinary questions, set it to null.

OUTPUT FORMAT — return ONLY valid JSON:
{
  "reply": "your markdown answer to the user",
  "memory_suggestion": null | { "title": "short title", "content": "the durable fact to remember, 1-3 sentences" }
}`

interface LeadRow {
  company_name: string
  status: string
  customer_category?: string[]
  lead_score?: number
  pain_point?: string
  next_follow_up_at?: string
  updated_at: string
}

// Build a compact but rich snapshot of the current BD state.
async function buildBDContext(): Promise<string> {
  const parts: string[] = []
  const now = Date.now()

  try {
    const { fullMemory: loadFullMemory } = await import('@/lib/agent-memory')
    const [memoryBlock, { data: leads }, { data: outreach }, { data: activities }] = await Promise.all([
      loadFullMemory(),
      supabase.from('leads').select('company_name, status, customer_category, lead_score, pain_point, next_follow_up_at, updated_at').limit(500),
      supabase.from('outreach_messages').select('channel, status').limit(800),
      supabase.from('lead_activities').select('type, scheduled_at, completed_at').limit(500),
    ])

    // Pipeline by status
    const leadRows = (leads || []) as LeadRow[]
    const byStatus: Record<string, number> = {}
    leadRows.forEach(l => { byStatus[l.status] = (byStatus[l.status] || 0) + 1 })
    if (leadRows.length) {
      parts.push(`PIPELINE (${leadRows.length} total leads):\n` +
        Object.entries(byStatus).map(([s, n]) => `  ${s}: ${n}`).join('\n'))
    }

    // Category performance (count + converting)
    const catCount: Record<string, number> = {}
    const catConv: Record<string, number> = {}
    leadRows.forEach(l => (l.customer_category || []).forEach(c => {
      catCount[c] = (catCount[c] || 0) + 1
      if (l.status === 'replied' || l.status === 'meeting_booked') catConv[c] = (catConv[c] || 0) + 1
    }))
    if (Object.keys(catCount).length) {
      parts.push('CATEGORY PERFORMANCE (leads · converting):\n' +
        Object.entries(catCount).sort((a, b) => b[1] - a[1])
          .map(([c, n]) => `  ${c}: ${n} · ${catConv[c] || 0} converting`).join('\n'))
    }

    // Top leads
    const top = [...leadRows].filter(l => l.lead_score != null)
      .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0)).slice(0, 8)
    if (top.length) {
      parts.push('TOP LEADS BY SCORE:\n' +
        top.map(l => `  ${l.company_name} (${l.lead_score}, ${l.status})${l.pain_point ? ' — ' + l.pain_point.slice(0, 90) : ''}`).join('\n'))
    }

    // Stale: contacted but no reply, last touch > 7d ago
    const stale = leadRows.filter(l => l.status === 'contacted' && (now - new Date(l.updated_at).getTime()) > 7 * 86400000)
    if (stale.length) {
      parts.push(`STALE (contacted >7d ago, no reply): ${stale.length} — ${stale.slice(0, 6).map(l => l.company_name).join(', ')}`)
    }

    // Outreach reply rates per channel
    const sent: Record<string, number> = {}
    const replied: Record<string, number> = {}
    ;(outreach || []).forEach((m: { channel?: string; status: string }) => {
      const ch = m.channel || 'unknown'
      if (m.status === 'sent' || m.status === 'delivered' || m.status === 'replied') sent[ch] = (sent[ch] || 0) + 1
      if (m.status === 'replied') replied[ch] = (replied[ch] || 0) + 1
    })
    if (Object.keys(sent).length) {
      parts.push('OUTREACH REPLY RATES:\n' +
        Object.entries(sent).map(([ch, n]) => {
          const r = replied[ch] || 0
          return `  ${ch}: ${r}/${n} replied (${Math.round((r / n) * 100)}%)`
        }).join('\n'))
    }

    // CRM follow-ups
    const overdue = (activities || []).filter((a: { type: string; scheduled_at?: string; completed_at?: string }) =>
      a.type === 'follow_up' && !a.completed_at && a.scheduled_at && new Date(a.scheduled_at).getTime() < now)
    if (overdue.length) parts.push(`OVERDUE FOLLOW-UPS (CRM): ${overdue.length}`)

    // Memory: rules + knowledge + feedback via centralized system (up to 56 entries, type-diverse)
    if (memoryBlock) parts.push(memoryBlock)
  } catch (e) {
    console.error('[buildBDContext]', e)
  }

  return parts.length ? `\n\n=== LIVE BD CONTEXT ===\n${parts.join('\n\n')}` : ''
}

async function getOrCreateSession(sessionId?: string): Promise<string> {
  if (sessionId) {
    const { data } = await supabase.from('voice_sessions').select('id').eq('id', sessionId).single()
    if (data) return sessionId
  }
  const { data } = await supabase.from('voice_sessions').insert({ title: 'Co-Pilot chat', message_count: 0 }).select('id').single()
  return data?.id || crypto.randomUUID()
}

async function autoTitle(sessionId: string, firstMsg: string) {
  try {
    const c = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: `Create a short 4-6 word title for a BD conversation that starts with: "${firstMsg.slice(0, 200)}". Return ONLY the title, no quotes.` }],
      max_tokens: 20, temperature: 0.3,
    })
    const title = c.choices[0].message.content?.trim() || 'Co-Pilot chat'
    await supabase.from('voice_sessions').update({ title }).eq('id', sessionId)
  } catch { /* non-critical */ }
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
  }

  try {
    const body = await req.json()

    // ── Action: persist a confirmed memory into long-term knowledge ──
    if (body.action === 'save_memory') {
      const { title, content } = body
      if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })
      const { error } = await supabase.from('agent_knowledge').insert({
        title, content, knowledge_type: 'correction',
        tags: ['copilot'], status: 'active',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ saved: true })
    }

    // ── Normal chat turn ──
    const { message, session_id, messages: clientMessages } = body
    if (!message || !message.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    const sessionId = await getOrCreateSession(session_id)
    const history: { role: 'user' | 'assistant'; content: string }[] = clientMessages || []
    const bdContext = await buildBDContext()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PERSONA + bdContext },
        ...history.slice(-16),
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 1300,
    })

    let reply = 'Let me try that again — could you rephrase?'
    let memory: { title: string; content: string } | null = null
    try {
      const parsed = JSON.parse(completion.choices[0].message.content || '{}')
      if (typeof parsed.reply === 'string') reply = parsed.reply
      if (parsed.memory_suggestion && parsed.memory_suggestion.title && parsed.memory_suggestion.content) {
        memory = { title: String(parsed.memory_suggestion.title), content: String(parsed.memory_suggestion.content) }
      }
    } catch { /* fall through with default reply */ }

    // Persist messages (shared with the voice session store)
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
    const message = err instanceof Error ? err.message : 'Co-Pilot failed'
    console.error('[copilot route]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
