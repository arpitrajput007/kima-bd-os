// POST /api/reaction/explain
// Explains a news item in brief, plain, non-technical language.

import { NextRequest, NextResponse } from 'next/server'
import { claudeJSON, CLAUDE_FAST } from '@/lib/claude'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const EXPLAIN_PROMPT = `You explain news to someone with zero background in tech, crypto, or finance — a smart friend who has never heard any of the jargon in this article.

Rules:
- Plain, everyday English. No jargon. If a technical term is unavoidable, define it in the same sentence in parentheses.
- Short. 3-5 sentences total, as one paragraph.
- Cover: what happened, who it involves, and why anyone should care — in the simplest terms possible.
- No headline restating, no hashtags, no emojis, no marketing language.

Return ONLY valid JSON: { "explanation": "..." }`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { title, summary, topic } = body

  if (!title && !summary) {
    return NextResponse.json({ error: 'Provide at least a title or summary.' }, { status: 400 })
  }

  const userPrompt = [
    `Topic category: ${topic || 'General'}`,
    `Headline: ${title || '(no title)'}`,
    summary ? `Summary/excerpt:\n${summary}` : '(No summary available — explain from the headline alone.)',
    '',
    'Explain this in brief, plain, layman language as specified in the system prompt.',
  ].filter(Boolean).join('\n\n')

  try {
    const result = await claudeJSON<{ explanation: string }>({
      model: CLAUDE_FAST,
      system: EXPLAIN_PROMPT,
      user: userPrompt,
      maxTokens: 500,
      temperature: 0.5,
    })

    if (!result.explanation) {
      return NextResponse.json({ error: 'Explanation generation returned empty output.' }, { status: 500 })
    }

    return NextResponse.json({ explanation: result.explanation })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explanation failed' }, { status: 500 })
  }
}
