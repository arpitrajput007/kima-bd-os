// POST /api/ai/content/discuss
// ------------------------------------------------------------
// Editorial thinking-partner chat for reviewing generated content
// before it gets posted. Arpit can ask "why did you write this?",
// "is this accurate?", "make tweet 2 sharper", etc.
// No DB persistence — context is passed with every request.
// ------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { claudeText } from '@/lib/claude'
import { AERPOLICE_KNOWLEDGE } from '@/lib/kima-knowledge'

interface ContentPost { id: string; text: string }

interface ContentContext {
  incident_summary: string
  root_cause: string
  kima_angle: string
  why_this_matters?: string
  original_insight?: string
  engagement_hooks?: string[]
  tweets: ContentPost[]
  thread: ContentPost[]
  linkedin: ContentPost[]
}

function buildContentBlock(content: ContentContext, sourceNews?: string, sourceUrl?: string): string {
  const parts: string[] = []

  parts.push('ANALYSIS GENERATED:')
  parts.push(`Summary: ${content.incident_summary}`)
  if (content.why_this_matters) parts.push(`Why it matters: ${content.why_this_matters}`)
  parts.push(`Hidden problem: ${content.root_cause}`)
  if (content.kima_angle && content.kima_angle !== 'N/A') parts.push(`Aerpolice angle: ${content.kima_angle}`)
  if (content.original_insight) parts.push(`Original insight: ${content.original_insight}`)
  if (content.engagement_hooks?.length) {
    parts.push(`Engagement hooks:\n${content.engagement_hooks.map(h => `  · ${h}`).join('\n')}`)
  }

  if (sourceUrl) parts.push(`\nSOURCE URL: ${sourceUrl}`)
  if (sourceNews) parts.push(`\nSOURCE TEXT:\n${sourceNews.slice(0, 3000)}${sourceNews.length > 3000 ? '\n[truncated]' : ''}`)

  if (content.tweets.length) {
    parts.push(`\nTWEETS (${content.tweets.length}):`)
    content.tweets.forEach((t, i) => parts.push(`— Tweet ${i + 1} [${t.id}]\n${t.text}`))
  }

  if (content.thread.length) {
    parts.push(`\nTHREAD (${content.thread.length} tweets):`)
    content.thread.forEach((t, i) => parts.push(`[${i + 1}] ${t.text}`))
  }

  if (content.linkedin.length) {
    parts.push(`\nLINKEDIN POSTS (${content.linkedin.length}):`)
    content.linkedin.forEach((p, i) => parts.push(`— LinkedIn ${i + 1} [${p.id}]\n${p.text}`))
  }

  return parts.join('\n')
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 400 })
  }

  const body = await req.json()
  const {
    message,
    messages: history = [],
    content,
    source_news,
    source_url,
  }: {
    message: string
    messages: { role: 'user' | 'assistant'; content: string }[]
    content: ContentContext
    source_news?: string
    source_url?: string
  } = body

  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  if (!content)          return NextResponse.json({ error: 'Content context required' }, { status: 400 })

  const contentBlock = buildContentBlock(content, source_news, source_url)

  const systemPrompt = `You are Arpit's editorial thinking partner. Arpit generated social media content about AI agent governance in the Aerpolice Content Studio, and he wants to understand it fully before posting.

Your job:
1. Explain the reasoning behind specific posts — why a claim was made, what angle is being taken, what the hook is trying to do
2. Verify Aerpolice-related claims are accurate and grounded in real product capabilities
3. Flag anything that might be factually weak, overstated, or might not land well with the intended audience (enterprise leaders, AI builders, founders, investors)
4. Suggest sharper alternatives if asked
5. Answer plain-English "what does this mean?" questions
6. Give your honest editorial opinion on which posts are strongest and why

AERPOLICE PRODUCT KNOWLEDGE — use to verify accuracy of any Aerpolice claims:
${AERPOLICE_KNOWLEDGE}

THE CONTENT UNDER REVIEW:
${contentBlock}

HOW TO RESPOND:
- Be direct and honest. If a claim is shaky, say so.
- When explaining a post, break down: hook, insight, Aerpolice connection (or lack of one), intended audience.
- When asked to improve something, write the revised version in full — don't just describe the change.
- Reference specific posts by number (Tweet 1, LinkedIn 2, Thread tweet 3, etc.).
- Keep responses concise — 150-300 words unless a full rewrite is requested.
- No "great question!" filler. Just useful editorial thinking.
- Bold important points with **double asterisks** if needed. No bullet spam.`

  const historyMessages = (Array.isArray(history) ? history : []).slice(-16)
  const userContent = [
    ...historyMessages.map(m => `${m.role === 'user' ? 'Arpit' : 'Agent'}: ${m.content}`),
    `Arpit: ${message}`,
  ].join('\n\n')

  try {
    const reply = await claudeText({
      model: 'claude-sonnet-4-6',
      maxTokens: 1000,
      temperature: 0.65,
      system: systemPrompt,
      user: userContent,
    }) || 'Something went wrong — try rephrasing?'

    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Discussion failed'
    console.error('[content/discuss]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
