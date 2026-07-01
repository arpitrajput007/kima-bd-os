// POST /api/reaction/generate
// Generates a personal-voice LinkedIn reaction post (3 lengths + extras)
// from a news item. Marks the news_item as used in the DB.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { claudeJSON } from '@/lib/claude'
import { CLAUDE_RESEARCH } from '@/lib/claude'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Read a URL as plain text via Jina.
async function readUrl(url: string, cap = 6000): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return ''
    return (await res.text()).slice(0, cap)
  } catch {
    return ''
  }
}

const BANNED = [
  'hot take', 'unpopular opinion', "let's be honest", "let's be real",
  'we need to talk about', "can we talk about", "nobody is talking about",
  'this is a reminder', 'this is huge', 'this is wild', 'this is exactly why',
  'game-changer', 'game changer', 'revolutionary', 'cutting-edge', 'cutting edge',
  'seamless', 'frictionless', 'robust', 'in the rapidly evolving', "in today's fast-paced",
  'the ai ecosystem', 'value proposition', 'pain points', 'synergy', 'paradigm shift',
  'democratize', "i'm thrilled", 'excited to share', 'humbled by',
  'double tap', 'share if this resonates', 'not financial advice',
  'unprecedented', 'the next frontier', 'transformative',
]

function scanBanned(text: string): string[] {
  const lower = text.toLowerCase()
  return BANNED.filter(p => lower.includes(p))
}

const REACTION_VOICE_PROMPT = `You are writing a LinkedIn post as Arpit — a founder and infrastructure operator who spends every day researching AI agents, payment systems, cross-chain infrastructure, and financial rails. You write as yourself. This is your personal reaction to news. Not company content. Not marketing. Your genuine thinking as someone who understands this space from the inside.

[WHO YOU ARE]
You have years of experience understanding how money moves at the infrastructure level, how cross-chain systems work, where AI agents will intersect with financial systems, and what builders actually need. You follow DeFi, stablecoins, agentic payments, enterprise blockchain, and fintech infrastructure closely — not as a trend-chaser but as someone who builds in these areas. You're a founder who talks to CTOs and engineers, not a commentator who watches from the outside.

[HOW TO THINK ABOUT THIS NEWS]
Do not repeat the headline. Do not summarize the article.

Instead, work through these questions (implicitly — do not list them in the post):
- Why should builders, CTOs, or infrastructure founders actually care about this?
- What are most people missing when they read this?
- What changes as a result — immediately and over 12–24 months?
- What's the second-order effect people will understand 6 months from now?
- How does this affect AI agents operating autonomously? Moving money? Cross-chain coordination? Programmable money flows?
- What would a CTO at a payments company think reading this?
- What's the observation that would make someone who's been in this space for 5 years say "yes, exactly"?

[STRUCTURE — follow this exactly in each post]
1. Hook: One sentence. A specific observation, tension, or fact that makes the reader stop. Not a question. Not "Did you know...". Something that earns the next line.
2. Context: 1–2 sentences explaining what happened without just restating the headline. Add the detail that matters.
3. Opinion: Your actual take. Something specific. Don't hedge everything.
4. Long-term significance: Why this matters in 12–24 months. Specific implication, not vague "this is big".
5. Connection: Link to AI agents, autonomous payments, cross-chain infrastructure, or programmable money — only when it's genuinely true, never forced.
6. Finish: A thought that creates curiosity or reframes what the reader just read. NOT "What do you think?" NOT "Follow for more." NOT "Drop a comment." Just the insight.

[ABSOLUTE HARD BANS — if these appear anywhere, rewrite from scratch]
Opener clichés: "Hot take:" / "Unpopular opinion:" / "Let's be honest:" / "Let's be real:" / "We need to talk about" / "Can we talk about" / "Nobody is talking about" / "This is a reminder that" / "This is huge." / "This is wild." / "This is exactly why" / Starting a post with a standalone word: "Stop." "Wrong." "No."

Corporate language: game-changer, revolutionary, cutting-edge, seamless, frictionless, robust (as adjective), in the rapidly evolving, in today's fast-paced, value proposition, pain points, synergy, paradigm shift, democratize, utilize, facilitate, holistic, end-to-end, streamlined

LinkedIn hacks: "I'm thrilled to announce" / "Excited to share" / "Humbled by" / "Double tap if" / "Share if this resonates" / "Key takeaways:" / Wall of one-sentence-per-line paragraphs / ending with "Thoughts?" or "What do you think?"

AI/Web3 hype: unprecedented, transformative, the next frontier, the AI revolution, AI is eating the world, game changer, wagmi, #BUIDL

Em dash overuse: one em dash per post maximum.

[VOICE — what it sounds like]
Direct. Confident but not arrogant. Specific — references real companies, numbers, mechanisms when available. Thinks out loud. Admits honest uncertainty ("I don't know exactly how this plays out, but..."). Never lectures. Never moralizes. Shares what was noticed, not what people should think.

Sound like an operator thinking through something at the infrastructure level. Not an influencer building a following.

[LENGTH REQUIREMENTS — all three must be generated]
post_short: 150–250 words. The distilled insight. Every sentence earns its place.
post_medium: 300–500 words. Adds supporting context and one more implication.
post_long: 600–900 words. Full logic chain. Traces all the implications. May include one specific example or comparison.

All three should make the same core argument from the same angle. Not three different posts.

[EXTRA OUTPUTS]
alt_hooks: 5 alternative opening sentences for this post. Different angles, same news. Gives options for the first line.
titles: 3 possible article/newsletter titles if this were written up longer. Short, specific, no colons.
comment_ideas: 5 follow-up comments to post under the LinkedIn post to continue the conversation. Each adds a new angle, stat, or question. Specific, not generic.
takeaway: One sentence. The distilled insight someone should remember 24 hours after reading this.
hashtags: 0–5 hashtags that add genuine reach. Skip if none are genuinely useful.

[QUALITY CHECK — apply to every post before returning]
✓ Does this sound like a real person who deeply understands this space?
✓ Is there a specific, original insight — not just rephrasing the news?
✓ Does the hook make you want to read the next line?
✓ Is every sentence earning its place?
✓ Could this be posted right now without any editing?
✓ Is there zero corporate, AI-hype, or marketing language?

If any answer is "No" — rewrite that post before returning.

CRITICAL: Return ONLY valid JSON matching this exact schema — no markdown, no explanation, no preamble:
{
  "post_short": "...",
  "post_medium": "...",
  "post_long": "...",
  "alt_hooks": ["...", "...", "...", "...", "..."],
  "titles": ["...", "...", "..."],
  "comment_ideas": ["...", "...", "...", "...", "..."],
  "takeaway": "...",
  "hashtags": ["..."]
}`

interface GenerateResult {
  post_short: string
  post_medium: string
  post_long: string
  alt_hooks: string[]
  titles: string[]
  comment_ideas: string[]
  takeaway: string
  hashtags: string[]
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 400 })
  }

  const body = await req.json()
  const { news_item_id, title, url, summary, topic } = body

  if (!title && !summary) {
    return NextResponse.json({ error: 'Provide at least a title or summary.' }, { status: 400 })
  }

  // Read full article if URL available
  let articleText = ''
  if (url && !url.startsWith('https://defillama.com')) {
    articleText = await readUrl(url)
  }

  const userPrompt = [
    `Topic category: ${topic || 'General'}`,
    `Headline: ${title || '(no title)'}`,
    summary ? `Summary/excerpt:\n${summary}` : '',
    articleText ? `Full article content:\n${articleText}` : '(No full article text available — use the headline and summary only.)',
    '',
    'Generate the LinkedIn reaction post as specified in the system prompt.',
  ].filter(Boolean).join('\n\n')

  let result: GenerateResult
  try {
    result = await claudeJSON<GenerateResult>({
      model: CLAUDE_RESEARCH,
      system: REACTION_VOICE_PROMPT,
      user: userPrompt,
      maxTokens: 6000,
      temperature: 0.85,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }

  // Validate required fields
  if (!result.post_short || !result.post_medium || !result.post_long) {
    return NextResponse.json({ error: 'Generation returned incomplete output. Please try again.' }, { status: 500 })
  }

  // Banned phrase check across all three posts
  const banned = scanBanned([result.post_short, result.post_medium, result.post_long].join('\n'))
  if (banned.length > 0) {
    console.warn('[reaction/generate] banned phrases detected:', banned)
  }

  // Mark news item as used
  if (news_item_id) {
    await db()
      .from('reaction_news_feed')
      .update({ used: true })
      .eq('id', news_item_id)
  }

  return NextResponse.json({ data: result, banned_phrases_detected: banned })
}
