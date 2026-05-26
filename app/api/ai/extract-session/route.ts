import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json()
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    // Load all messages in this session
    const { data: messages } = await supabase
      .from('voice_messages')
      .select('role, content, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })

    if (!messages || messages.length < 2) {
      return NextResponse.json({ error: 'Not enough conversation to extract from' }, { status: 400 })
    }

    // Format conversation as a readable transcript
    const transcript = messages
      .map(m => `${m.role === 'user' ? 'You' : 'Agent'}: ${m.content}`)
      .join('\n')

    const { data: session } = await supabase
      .from('voice_sessions')
      .select('title')
      .eq('id', session_id)
      .single()

    const sourceName = `Voice session: ${session?.title || 'Conversation'}`

    // Generate a session summary first
    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are summarizing a voice conversation between a user and their Kima BD Agent.
Extract: key decisions made, feedback given to the agent, market intel discussed, companies mentioned, strategies discussed, corrections or preference signals.
Write a clear 3-5 sentence summary. Then list specific feedback items the agent should learn from.
Return JSON: { "summary": "...", "feedback_points": ["...", "..."] }`,
        },
        { role: 'user', content: `CONVERSATION TRANSCRIPT:\n\n${transcript}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1000,
    })

    let summary = ''
    let feedbackPoints: string[] = []
    try {
      const parsed = JSON.parse(summaryCompletion.choices[0].message.content || '{}')
      summary = parsed.summary || ''
      feedbackPoints = parsed.feedback_points || []
    } catch { summary = 'Voice session processed.' }

    // Update session with summary
    await supabase.from('voice_sessions').update({
      summary,
      knowledge_extracted: true,
      updated_at: new Date().toISOString(),
    }).eq('id', session_id)

    // Call the learn pipeline with the full transcript as text input
    const learnResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/learn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'text',
        content: `${sourceName}\n\nSESSION SUMMARY:\n${summary}\n\nFEEDBACK POINTS:\n${feedbackPoints.join('\n')}\n\nFULL TRANSCRIPT:\n${transcript}`,
        source_name: sourceName,
      }),
    })

    const learnResult = await learnResponse.json()

    // Save feedback points to feedback_memory table
    if (feedbackPoints.length > 0) {
      for (const point of feedbackPoints.slice(0, 5)) {
        try {
          await supabase.from('feedback_memory').insert({
            lead_id: null,
            feedback_type: 'voice_session',
            feedback_text: point,
            processed: false,
          })
        } catch { /* ignore if schema mismatch */ }
      }
    }


    return NextResponse.json({
      success: true,
      summary,
      feedback_points: feedbackPoints,
      knowledge_created: learnResult?.rules_created > 0 || learnResult?.sources_created > 0,
      rules_created: learnResult?.rules_created || 0,
      sources_created: learnResult?.sources_created || 0,
      knowledge_title: learnResult?.title || '',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    console.error('[extract-session route]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
