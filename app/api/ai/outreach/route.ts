import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { PRODUCT_BRAIN, SINGLE_API_LINE } from '@/lib/kima-knowledge'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    return NextResponse.json({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file.' }, { status: 400 })
  }

  const {
    company_name, contact_name, channel, tone, customer_category,
    product_to_sell, use_case, pain_point, kima_fit, aeredium_fit,
    message_length = 'medium'
  } = await req.json()

  const lengthGuides: Record<string, string> = {
    short: '2-3 sentences max per message',
    medium: '4-6 sentences per message',
    detailed: '6-10 sentences per message with more context'
  }
  const lengthGuide = lengthGuides[message_length] || lengthGuides.medium

  const toneGuides: Record<string, string> = {
    casual: 'friendly and informal, like texting a peer',
    professional: 'professional but warm, not stiff',
    founder_to_founder: 'direct founder-to-founder, peer level, no fluff',
    concise: 'extremely short, every word counts',
    strong_bd: 'confident, sales-focused, clear value prop'
  }
  const toneGuide = toneGuides[tone] || 'professional but warm'

  const channelGuides: Record<string, string> = {
    telegram: 'Telegram DM - no subject line, casual opener, emoji OK',
    linkedin: 'LinkedIn message - professional opener, no subject line',
    twitter: 'Twitter/X DM - very short, casual, to the point',
    email: 'Email - needs subject line, can be slightly longer'
  }
  const channelGuide = channelGuides[channel] || 'LinkedIn message'

  const systemPrompt = `You are writing BD outreach messages for Arpit, who leads BD/partnerships for Kima and Aeredium.

${PRODUCT_BRAIN}

ARPIT'S STYLE:
- Human, direct, sharp
- Not too formal, not generic
- Uses exact pain points, not generic pitch
- Short enough for DMs
- Confident but not pushy
- Always personalizes to their specific situation

ALWAYS include this line naturally: "${SINGLE_API_LINE}"

MESSAGE STRUCTURE:
1. Personal opener based on their company/product
2. Specific pain point they have
3. Kima/Aeredium fit for their situation
4. Product/use case to sell
5. Single API line
6. Soft CTA

Return JSON only. No markdown prose.`

  const userPrompt = `Write outreach messages for:
Company: ${company_name}
Contact: ${contact_name || '[Name]'}
Channel: ${channel} (${channelGuide})
Tone: ${tone} (${toneGuide})
Customer category: ${customer_category}
Product to sell: ${product_to_sell}
Use case: ${use_case}
Their pain point: ${pain_point}
Kima fit: ${kima_fit}
Aeredium fit: ${aeredium_fit}
Message length: ${lengthGuide}

Return JSON:
{
  "subject_line": "Email subject line (null for non-email)",
  "message": "First outreach message",
  "followup_1": "Follow-up message after 5-7 days of no reply",
  "followup_2": "Second follow-up (shorter, different angle)",
  "objection_reply": "Reply to common objection 'we already have a solution for this'",
  "call_opening": "Opening line for a cold call",
  "meeting_agenda": "3-bullet agenda for first meeting"
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    return NextResponse.json({ success: true, data: result })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
