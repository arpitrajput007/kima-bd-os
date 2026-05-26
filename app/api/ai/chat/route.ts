import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SYSTEM_BASE = `You are the Kima BD Intelligence Agent — a sharp, expert BD strategist and advisor for Kima Finance and Aeredium. You have deep knowledge of the products and the market.

KIMA: Universal settlement layer. Moves value across crypto and TradFi without bridges, wrapped assets, or smart contracts. Single API, free and instant.
Use cases: cross-chain deposits, fiat-to-crypto onboarding, stablecoin payments, cross-border settlement, treasury rebalancing, RWA delivery-versus-payment.

AEREDIUM: TEE-attested blockchain infra. MEV resistance, execution accountability, compliance-ready. Institutional-grade settlement.

YOUR PERSONALITY:
- Direct, intelligent, and confident — like a senior BD advisor
- Give crisp, actionable answers — no fluff
- When discussing leads or companies, reference what you know about the market
- Ask clarifying questions when needed to give better advice
- Be honest about uncertainty — say "I don't have data on that" rather than guessing
- Keep responses concise in voice context — 2-4 sentences unless asked for detail

YOUR CAPABILITIES:
- Discuss BD strategy, ICP targeting, outreach approach, competitive positioning
- Help analyse companies, markets, verticals
- Give opinions on lead quality, timing, messaging
- Remember everything discussed in this session and across sessions (via your knowledge base)
- Extract feedback and learn from corrections you receive

IMPORTANT: You are speaking in a voice conversation. Keep responses natural and conversational.
Do NOT use markdown formatting, bullet points, or headers — speak in natural sentences.
Never start with "Certainly!" or "Great question!" — just answer directly.`

async function getContextualSystemPrompt(): Promise<string> {
  try {
    // Load active agent rules
    const { data: rules } = await supabase
      .from('agent_rules')
      .select('rule_type, rule')
      .eq('status', 'active')
      .order('weight', { ascending: false })
      .limit(20)

    // Load recent agent knowledge (last 15 entries)
    const { data: knowledge } = await supabase
      .from('agent_knowledge')
      .select('title, content, knowledge_type')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(15)

    // Load recent high-score leads for context
    const { data: leads } = await supabase
      .from('leads')
      .select('company_name, score, status, one_line_reason')
      .gte('score', 60)
      .order('score', { ascending: false })
      .limit(10)

    let context = SYSTEM_BASE

    if (rules && rules.length > 0) {
      context += `\n\nYOUR ACTIVE BD RULES:\n${rules.map(r => `[${r.rule_type}] ${r.rule}`).join('\n')}`
    }

    if (knowledge && knowledge.length > 0) {
      context += `\n\nYOUR LEARNED INTELLIGENCE:\n${knowledge.map(k => `[${k.knowledge_type}] ${k.title}: ${k.content.slice(0, 300)}`).join('\n\n')}`
    }

    if (leads && leads.length > 0) {
      context += `\n\nCURRENT TOP LEADS (score ≥60):\n${leads.map(l => `${l.company_name} (score: ${l.score}, status: ${l.status}) — ${l.one_line_reason || ''}`).join('\n')}`
    }

    return context
  } catch (e) {
    console.error('[getContextualSystemPrompt]', e)
    return SYSTEM_BASE
  }
}

async function getOrCreateSession(sessionId?: string): Promise<string> {
  if (sessionId) {
    const { data } = await supabase
      .from('voice_sessions')
      .select('id')
      .eq('id', sessionId)
      .single()
    if (data) return sessionId
  }
  // Create new session
  const { data } = await supabase
    .from('voice_sessions')
    .insert({ title: 'New Conversation', message_count: 0 })
    .select('id')
    .single()
  return data?.id || crypto.randomUUID()
}

async function autoTitleSession(sessionId: string, firstUserMessage: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Create a short 4-6 word title for a voice conversation that starts with: "${firstUserMessage.slice(0, 200)}". Return ONLY the title, no quotes.`,
        },
      ],
      max_tokens: 20,
      temperature: 0.3,
    })
    const title = completion.choices[0].message.content?.trim() || 'Conversation'
    await supabase.from('voice_sessions').update({ title }).eq('id', sessionId)
  } catch { /* non-critical */ }
}

export async function POST(req: NextRequest) {
  try {
    const { message, session_id, messages: clientMessages } = await req.json()

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 })
    }

    // Get or create session
    const sessionId = await getOrCreateSession(session_id)

    // Load or use provided message history (client keeps rolling window)
    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = clientMessages || []

    // Build system prompt with live context
    const systemPrompt = await getContextualSystemPrompt()

    // Call GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages.slice(-18), // rolling window of 18 messages
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 400, // concise for voice
    })

    const reply = completion.choices[0].message.content || 'I had trouble processing that. Could you repeat?'

    // Save both messages to Supabase
    await supabase.from('voice_messages').insert([
      { session_id: sessionId, role: 'user', content: message },
      { session_id: sessionId, role: 'assistant', content: reply },
    ])

    // Update session message count
    const { data: session } = await supabase
      .from('voice_sessions')
      .select('message_count')
      .eq('id', sessionId)
      .single()
    const newCount = (session?.message_count || 0) + 2
    await supabase.from('voice_sessions').update({
      message_count: newCount,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId)

    // Auto-title on first user message
    if (newCount === 2) {
      autoTitleSession(sessionId, message) // fire-and-forget
    }

    return NextResponse.json({ reply, session_id: sessionId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Chat failed'
    console.error('[chat route]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
