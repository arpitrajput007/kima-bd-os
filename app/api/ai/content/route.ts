import { NextRequest, NextResponse } from 'next/server'
import { claudeJSON } from '@/lib/claude'
import { FULL_BRAIN } from '@/lib/kima-knowledge'

// ── Twitter/X API v2 — needs TWITTER_BEARER_TOKEN env var ────────────────────
// Free tier: 500k reads/month. Setup: developer.twitter.com → create app → copy Bearer Token → add to Vercel.
async function fetchTweetViaAPI(tweetUrl: string): Promise<string> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) return ''

  // Extract tweet ID from URL (twitter.com/*/status/ID or x.com/*/status/ID)
  const match = tweetUrl.match(/\/status\/(\d+)/)
  if (!match) return ''
  const tweetId = match[1]

  try {
    const res = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text,created_at&expansions=author_id&user.fields=name,username`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(12_000),
      }
    )
    if (!res.ok) return ''
    const json = await res.json() as {
      data?: { text?: string }
      includes?: { users?: Array<{ username: string; name: string }> }
    }
    const text   = json.data?.text || ''
    const author = json.includes?.users?.[0]
    return author ? `Tweet by @${author.username} (${author.name}):\n${text}` : text
  } catch {
    return ''
  }
}

// ── Twitter/X oEmbed — public fallback, no auth needed ───────────────────────
async function fetchTweetOEmbed(tweetUrl: string): Promise<string> {
  try {
    const api = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`
    const res = await fetch(api, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return ''
    const json = await res.json() as { html?: string; author_name?: string }
    const html   = json.html || ''
    const text   = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const author = json.author_name ? `Tweet by @${json.author_name}:\n` : ''
    return author + text
  } catch {
    return ''
  }
}

// ── Fetch a URL — Twitter API → oEmbed fallback → Jina ───────────────────────
async function readUrl(url: string, cap = 8000): Promise<string> {
  const isTwitter = /twitter\.com|x\.com/.test(url)

  if (isTwitter) {
    // Try official API first (if TWITTER_BEARER_TOKEN is set), then oEmbed fallback
    const apiText = await fetchTweetViaAPI(url)
    if (apiText.length > 20) return apiText.slice(0, cap)

    const oembedText = await fetchTweetOEmbed(url)
    if (oembedText.length > 20) return oembedText.slice(0, cap)

    return '' // both failed — caller will ask user to paste manually
  }

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
  let urlFetchNote = ''
  if (url) {
    const trimmedUrl = url.trim()
    urlContent = await readUrl(trimmedUrl)
    if (!urlContent) {
      // URL fetch failed — let the user know but still try with any provided news text
      urlFetchNote = `(Note: could not fetch content from ${trimmedUrl} — if this is a tweet, paste the text below)`
    }
  }

  const incidentText = [
    news ? `USER-PROVIDED NEWS:\n${news}` : '',
    urlContent ? `FETCHED PAGE CONTENT:\n${urlContent}` : '',
  ].filter(Boolean).join('\n\n')

  // Guard: nothing to work with
  if (incidentText.trim().length < 40) {
    const isTwitter = url && /twitter\.com|x\.com/.test(url)
    return NextResponse.json({
      error: isTwitter
        ? 'Could not read this tweet automatically. Please paste the tweet text into the news field and try again.'
        : urlFetchNote
          ? `Could not fetch the URL. Please paste the article text directly into the news field.`
          : 'Please provide more context about the incident.',
    }, { status: 400 })
  }

  const systemPrompt = `You are Arpit, a Web3-native BD founder writing thought-leadership content about security failures in crypto/Web3 and how Kima and Aeredium solve them.

${FULL_BRAIN}

${CONTENT_VOICE_RULES}

IMPORTANT — X PREMIUM POST FORMAT:
Arpit has X Premium which allows posts up to 25,000 characters. Do NOT write short 280-char one-liners. Each tweet should be a complete narrative post — long enough to tell the full story with impact.

Every tweet must follow this exact 3-part structure, with a blank line between each section:

PART 1 — HOOK (2-4 lines max)
The single most alarming or counterintuitive fact from the incident. Something that makes someone stop scrolling. Specific numbers, specific name. No generic opener. No question. State the fact cold.

PART 2 — WHAT HAPPENED (4-8 lines)
Walk through the incident mechanically. How did it happen step by step? Name the mechanism (private key, bridge, oracle, relayer, smart contract). What exactly did the attacker do? Use short sentences. Be specific. Cite numbers.

PART 3 — WHAT THE FIX LOOKS LIKE (4-8 lines)
This is where Kima or Aeredium comes in — but naturally, as the logical answer to the mechanism you just described. Explain specifically how the technology addresses the exact failure vector. Do not say "Kima solves this" or "Aeredium has a solution" — instead, describe the mechanism: "When signing authority is split across three separate TEE-attested enclaves on different cloud providers, there is no single key to steal." The product name can appear once, at the end, as the thing that does this.

No hashtags. No call-to-action. No "retweet if you agree". End on a sharp factual statement.

LINKEDIN FORMAT — same narrative discipline as the tweets, but long-form:

Every LinkedIn post must follow this exact 4-part structure, with a blank line between each part:

PART 1 — HOOK (1-3 lines)
The single sharpest fact from the incident. Stated cold. No rhetorical question. No "I want to talk about". Just the fact — a number, a name, a specific failure. Something that makes someone stop scrolling in a feed.

PART 2 — WHAT HAPPENED (3-5 short paragraphs)
Tell the full story mechanically. Each paragraph = one distinct beat of the story. What was the system, what was the failure vector, what sequence of events led to the loss. Short sentences. Specific names and numbers. No moralizing — just the mechanics.

PART 3 — WHY THIS KEEPS HAPPENING (1-2 paragraphs)
The structural reason this is a recurring industry problem — not a one-off mistake. Explain the design assumption that gets exploited. No finger-pointing, just the mechanism.

PART 4 — WHAT THE FIX LOOKS LIKE (1-2 paragraphs)
Same rule as tweets: describe the mechanism of the solution first. Kima or Aeredium appears once, as the name for the thing you just described. End with one sharp factual closing line — no call to action, no "follow me for more".

No bullet points. No bold text on random words. No emoji. No hashtag spam (0-1 max). Max 400 words total.

You will produce:
1. THREE tweet variations — same structure (hook → what happened → fix), each using a DIFFERENT angle or entry point from the incident
2. ONE tweet thread (5 tweets — break the long-form story into connected parts, each tweet a standalone insight)
3. TWO LinkedIn post variations — same 4-part structure, each starting from a DIFFERENT hook and using a different angle on the incident

Return JSON only.`

  const userPrompt = `Here is the incident to write about:

${incidentText}

First extract the key facts. Then write the content following the exact structures above.

Return JSON exactly:
{
  "incident_summary": "One sentence: what happened, who was affected, how much was lost.",
  "root_cause": "One sentence: the technical root cause (e.g. bridge relayer compromise, private key theft, smart contract bug, oracle manipulation).",
  "kima_angle": "One sentence: which specific Kima/Aeredium capability directly addresses this root cause.",
  "tweets": [
    { "id": "tweet_1", "text": "HOOK\\n\\nWHAT HAPPENED\\n\\nFIX — variation 1" },
    { "id": "tweet_2", "text": "HOOK\\n\\nWHAT HAPPENED\\n\\nFIX — variation 2, different angle" },
    { "id": "tweet_3", "text": "HOOK\\n\\nWHAT HAPPENED\\n\\nFIX — variation 3, different entry point" }
  ],
  "thread": [
    { "id": "thread_1", "text": "Hook tweet — the most alarming single fact" },
    { "id": "thread_2", "text": "The mechanics of what happened" },
    { "id": "thread_3", "text": "Why this keeps happening (structural problem)" },
    { "id": "thread_4", "text": "What the actual fix looks like (Kima/Aeredium angle)" },
    { "id": "thread_5", "text": "Closing — sharp takeaway or implication for the industry" }
  ],
  "linkedin": [
    { "id": "linkedin_1", "text": "HOOK\\n\\nWHAT HAPPENED (multiple paragraphs, each separated by blank line)\\n\\nWHY THIS KEEPS HAPPENING\\n\\nFIX — variation 1" },
    { "id": "linkedin_2", "text": "HOOK (different angle)\\n\\nWHAT HAPPENED\\n\\nWHY THIS KEEPS HAPPENING\\n\\nFIX — variation 2" }
  ]
}`

  try {
    let result = await claudeJSON<ContentResult>({
      model: 'claude-sonnet-4-6',
      maxTokens: 8000,
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
        maxTokens: 8000,
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
