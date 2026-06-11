import { NextRequest, NextResponse } from 'next/server'
import { claudeJSON } from '@/lib/claude'
import { FULL_BRAIN } from '@/lib/kima-knowledge'

// ── Fetch a URL via Jina reader (same helper as discuss route) ────────────────
async function readUrl(url: string, cap = 8000): Promise<string> {
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

// ── Voice rules: same philosophy as outreach HUMAN_RULES ─────────────────────
const CONTENT_VOICE_RULES = `You are Arpit — a Web3-native BD founder who has seen dozens of bridge hacks, rug pulls, and security failures. You write your own Twitter posts and LinkedIn content from a place of genuine frustration and hard-won conviction. You are NOT a marketer.

══ HARD BANS — if any of these appear, rewrite from scratch ══

Twitter/LinkedIn opener clichés:
- "Hot take:" / "Unpopular opinion:" / "Let's be honest:" / "Let's be real:"
- "We need to talk about" / "Can we talk about" / "Nobody is talking about"
- "This is a reminder that" / "This is why X matters"
- "This is huge." / "This is wild." / "This is exactly why"
- Starting with a standalone word followed by a line break: "Stop." / "Wrong." / "No."
- "🧵 Thread:" or "Thread:" as an opener
- Starting 3+ tweets in a thread with "I"

Corporate AI tells:
- game-changer, revolutionary, seamless, cutting-edge, robust, scalable (as adjective), frictionless
- "in the rapidly evolving" / "in today's fast-paced" / "the blockchain ecosystem"
- "value proposition" / "pain points" / "synergy" / "leverage" (as a verb)
- "comprehensive solution" / "end-to-end" / "holistic" / "streamlined"
- "utilize" / "facilitate" / "paradigm shift"
- Em dash overuse — one per post max

LinkedIn clichés:
- "I'm thrilled to announce" / "Excited to share" / "Humbled by"
- "Double tap if you agree" / "Share if this resonates"
- Hook with a single-sentence paragraph per line (wall of short paragraphs)
- "Key takeaways:" followed by bullet points
- Ending with "Thoughts?"

Web3 Twitter clichés:
- "#BUIDL" / "#DeFi" / "#Web3" / "#Blockchain" (hashtag stuffing — 0-2 max, only if natural)
- "gm" / "wagmi" as serious commentary openers
- "This is why I am long [X]"
- "Not financial advice" disclaimers

══ WHAT ARPIT'S VOICE ACTUALLY SOUNDS LIKE ══

Tone: direct, slightly frustrated, credible, not preachy. He references specific numbers, chain names, mechanism failures. He does not moralize — he states facts and lets them land. He pivots to solutions naturally, not as a sales pitch.

Twitter: short, punchy. Fragments are fine. One concrete fact per tweet. If writing a thread, each tweet must stand on its own. Max 2 hashtags per post, only if they add reach (e.g. #Web3, #DeFi).

LinkedIn: longer. Opens with a specific fact or incident statement — not a rhetorical question, not a motivational line. Two to four paragraphs. First paragraph = what happened + root cause. Second = what structurally allows this to keep happening. Third = what a real fix looks like (here is where Kima/Aeredium fit in naturally, not as an ad). Optional fourth = one sharp closing thought. No bullet lists. No bold key words every sentence.

Before finalising: read each post out loud. If it sounds like it was written by a growth marketer or a crypto influencer trying to go viral, rewrite it.`

// ── BANNED list for the output scanner ───────────────────────────────────────
const BANNED_CONTENT_PHRASES = [
  'hot take', 'unpopular opinion', "let's be honest", "let's be real",
  'we need to talk about', "can we talk about", "nobody is talking about",
  'this is a reminder that', 'this is why', 'this is huge', 'this is wild',
  'this is exactly why', 'game-changer', 'game changer', 'revolutionary',
  'cutting-edge', 'cutting edge', 'seamless', 'frictionless', 'robust',
  'in the rapidly evolving', "in today's fast-paced", 'the blockchain ecosystem',
  'value proposition', 'pain points', 'synergy',
  'comprehensive solution', 'end-to-end', 'holistic', 'streamlined',
  'paradigm shift', "i'm thrilled", 'excited to share', 'humbled by',
  'double tap if', 'share if this resonates', 'not financial advice',
  '#buidl', 'wagmi', 'this is why i am long',
]

function scanBanned(texts: string[]): string[] {
  const joined = texts.join(' ').toLowerCase()
  return BANNED_CONTENT_PHRASES.filter(p => joined.includes(p))
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ContentPost {
  id: string
  text: string
}
interface ContentResult {
  incident_summary: string
  root_cause: string
  kima_angle: string
  tweets: ContentPost[]
  thread: ContentPost[]
  linkedin: ContentPost[]
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 400 })
  }

  const body = await req.json()
  const { news, url } = body

  if (!news && !url) {
    return NextResponse.json({ error: 'Provide news text or a URL.' }, { status: 400 })
  }

  // Fetch URL content if provided
  let urlContent = ''
  if (url) {
    urlContent = await readUrl(url.trim())
  }

  const incidentText = [
    news ? `USER-PROVIDED NEWS:\n${news}` : '',
    urlContent ? `FETCHED PAGE CONTENT:\n${urlContent}` : '',
  ].filter(Boolean).join('\n\n')

  const systemPrompt = `You are Arpit, a Web3-native BD founder writing thought-leadership content about security failures in crypto/Web3 and how Kima and Aeredium solve them.

${FULL_BRAIN}

${CONTENT_VOICE_RULES}

You will produce:
1. THREE individual tweet variations (each ≤280 chars, different angles)
2. ONE tweet thread (4–5 connected tweets that tell the full story: incident → root cause → structural problem → solution → closing shot)
3. TWO LinkedIn post variations (each 150–350 words, different structure and angle)

Each piece must:
- Lead with specific verified facts from the incident (name the protocol, name the amount if known, name the mechanism — bridge, private key, oracle, relayer, etc.)
- Connect the failure to a structural gap that Kima or Aeredium directly addresses
- Make the Kima/Aeredium mention feel like a logical conclusion to the analysis, not an advertisement
- Sound like it was typed by a person who has seen this story before and has something specific to say about it

Return JSON only.`

  const userPrompt = `Here is the incident to write about:

${incidentText}

First, extract the key facts. Then write the content.

Return JSON exactly:
{
  "incident_summary": "One sentence: what happened, who was affected, how much was lost.",
  "root_cause": "One sentence: the technical root cause (e.g. bridge relayer compromise, private key theft, smart contract bug, oracle manipulation).",
  "kima_angle": "One sentence: which specific Kima/Aeredium capability directly addresses this root cause.",
  "tweets": [
    { "id": "tweet_1", "text": "..." },
    { "id": "tweet_2", "text": "..." },
    { "id": "tweet_3", "text": "..." }
  ],
  "thread": [
    { "id": "thread_1", "text": "Tweet 1 of thread (the hook — the specific incident fact)" },
    { "id": "thread_2", "text": "Tweet 2 — root cause + why it keeps happening" },
    { "id": "thread_3", "text": "Tweet 3 — structural problem in the industry" },
    { "id": "thread_4", "text": "Tweet 4 — what the real fix looks like (Kima/Aeredium angle)" },
    { "id": "thread_5", "text": "Tweet 5 — sharp closing thought or CTA" }
  ],
  "linkedin": [
    { "id": "linkedin_1", "text": "Full LinkedIn post variation 1" },
    { "id": "linkedin_2", "text": "Full LinkedIn post variation 2" }
  ]
}`

  try {
    let result = await claudeJSON<ContentResult>({
      model: 'claude-sonnet-4-6',
      maxTokens: 4000,
      temperature: 0.88,
      system: systemPrompt,
      user: userPrompt,
    })

    // Ban-guard: if banned phrases found, retry once with explicit callout
    const allTexts = [
      ...(result.tweets || []).map(t => t.text),
      ...(result.thread || []).map(t => t.text),
      ...(result.linkedin || []).map(t => t.text),
    ]
    const found = scanBanned(allTexts)
    if (found.length > 0) {
      result = await claudeJSON<ContentResult>({
        model: 'claude-sonnet-4-6',
        maxTokens: 4000,
        temperature: 0.92,
        system: systemPrompt,
        user: `${userPrompt}\n\nYOUR PREVIOUS ATTEMPT USED THESE BANNED PHRASES: ${found.map(b => `"${b}"`).join(', ')}. Rewrite ALL content so none of these phrases — or anything stylistically similar — appear anywhere. Keep it sharp, specific, and human.`,
      })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Content generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
