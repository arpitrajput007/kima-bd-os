import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FULL_BRAIN } from '@/lib/kima-knowledge'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SYSTEM_BASE = `You are the Kima BD Intelligence Agent — a sharp, expert BD strategist and advisor for Kima Finance and Aeredium. You have deep knowledge of the products and the market.

${FULL_BRAIN}

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
    const { fullMemory: loadFullMemory } = await import('@/lib/agent-memory')

    // Load memory + top leads in parallel
    const [memoryBlock, { data: leads }] = await Promise.all([
      loadFullMemory(),
      supabase
        .from('leads')
        .select('company_name, lead_score, status, pain_point')
        .gte('lead_score', 60)
        .order('lead_score', { ascending: false })
        .limit(10),
    ])

    let context = SYSTEM_BASE

    if (memoryBlock) {
      context += memoryBlock
    }

    if (leads && leads.length > 0) {
      context += `\n\nCURRENT TOP LEADS (score ≥60):\n${leads.map(l => `${l.company_name} (score: ${l.lead_score}, status: ${l.status}) — ${l.pain_point || ''}`).join('\n')}`
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
