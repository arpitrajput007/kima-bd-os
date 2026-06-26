import { NextRequest, NextResponse } from 'next/server'
import { claudeJSON } from '@/lib/claude'
import { AERGAP_KNOWLEDGE } from '@/lib/kima-knowledge'

// ── Twitter/X API v2 — needs TWITTER_BEARER_TOKEN env var ────────────────────
async function fetchTweetViaAPI(tweetUrl: string): Promise<string> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) return ''

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
    const apiText = await fetchTweetViaAPI(url)
    if (apiText.length > 20) return apiText.slice(0, cap)

    const oembedText = await fetchTweetOEmbed(url)
    if (oembedText.length > 20) return oembedText.slice(0, cap)

    return ''
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

// ── Voice rules ───────────────────────────────────────────────────────────────
const CONTENT_VOICE_RULES = `You are Arpit — founder of Aergap, building the policy enforcement and governance layer for autonomous AI agents. You write thought leadership content that positions Aergap as the company defining the conversation around AI agent governance.

You write from a place of genuine conviction, not marketing. You see patterns before they become obvious. You call out governance gaps and accountability risks that everyone else is ignoring. You think like a founder, a product strategist, a B2B enterprise leader, and a VC — simultaneously.

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
- "in the rapidly evolving" / "in today's fast-paced" / "the AI ecosystem"
- "value proposition" / "pain points" / "synergy" / "leverage" (as a verb)
- "comprehensive solution" / "end-to-end" / "holistic" / "streamlined"
- "utilize" / "facilitate" / "paradigm shift" / "democratize"
- Em dash overuse — one per post max

LinkedIn clichés:
- "I'm thrilled to announce" / "Excited to share" / "Humbled by"
- "Double tap if you agree" / "Share if this resonates"
- Hook with a single-sentence paragraph per line (wall of short paragraphs)
- "Key takeaways:" followed by bullet points
- Ending with "Thoughts?"

AI hype language:
- "AI is eating the world" / "AI changes everything" / "AI is the future"
- "Agents are the future" (too vague — be specific about what agents do)
- "Unprecedented" / "transformative" / "revolutionary"
- "The next frontier" / "at the cutting edge" / "the AI revolution"

Web3 Twitter clichés:
- "#BUIDL" / "#DeFi" / "#Web3" / "#Blockchain" (hashtag stuffing — 0-2 max)
- "gm" / "wagmi" as serious commentary openers
- "Not financial advice" disclaimers

══ WHAT ARPIT'S VOICE ACTUALLY SOUNDS LIKE ══

Tone: direct, founder-level, credible, not preachy. References specific products, companies, failure modes, and numbers. Does not moralize — states facts and lets them land. Connects trends to structural risks. Pivots to solutions naturally, never as a sales pitch.

Thinking framework (use implicitly, not literally):
1. Why does this matter?
2. What problem does this create?
3. What risks emerge as AI agents become more autonomous?
4. What governance layer is missing?
5. How does Aergap solve part of this problem?
6. What insight would make enterprise leaders stop and think?

Aergap lens (apply where relevant, never forced):
- Where does governance break down?
- What permissions should exist before this action executes?
- Does the agent have a verifiable identity?
- Who is accountable when something goes wrong?
- Could this action have been blocked before execution?
- Is there an immutable audit trail?
- Would an enterprise customer trust this today?

Twitter: short, punchy. Fragments are fine. One concrete fact or observation per tweet. If writing a thread, each tweet must stand on its own. Max 2 hashtags per post, only if they add reach.

LinkedIn: longer. Opens with a specific fact, number, or observation — not a rhetorical question, not a motivational line. Two to four paragraphs. Each paragraph = one distinct analytical beat. No bullet lists. No bold keywords every sentence.

Aergap rule — 80% insight, 20% Aergap: Readers should feel they learned something, not that they were sold to. Do NOT mention Aergap in every paragraph. Do NOT turn every post into an advertisement. Aergap appears once per post, maximum — and only when it genuinely strengthens the narrative. When it does appear, describe the mechanism first ("policies enforced before execution", "immutable audit trail", "verifiable agent identity") then name Aergap as the thing providing it.

Before finalising: read each post out loud. If it sounds like it was written by an AI company marketer or a tech influencer trying to go viral, rewrite it.`

// ── BANNED list for output scanner ───────────────────────────────────────────
const BANNED_CONTENT_PHRASES = [
  'hot take', 'unpopular opinion', "let's be honest", "let's be real",
  'we need to talk about', "can we talk about", "nobody is talking about",
  'this is a reminder that', 'this is why', 'this is huge', 'this is wild',
  'this is exactly why', 'game-changer', 'game changer', 'revolutionary',
  'cutting-edge', 'cutting edge', 'seamless', 'frictionless', 'robust',
  'in the rapidly evolving', "in today's fast-paced", 'the ai ecosystem',
  'the blockchain ecosystem', 'value proposition', 'pain points', 'synergy',
  'comprehensive solution', 'end-to-end', 'holistic', 'streamlined',
  'paradigm shift', 'democratize', "i'm thrilled", 'excited to share', 'humbled by',
  'double tap if', 'share if this resonates', 'not financial advice',
  '#buidl', 'wagmi', 'this is why i am long', 'ai is eating', 'ai changes everything',
  'unprecedented', 'the next frontier',
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
  why_this_matters: string
  original_insight: string
  engagement_hooks: string[]
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

  let urlContent = ''
  let urlFetchNote = ''
  if (url) {
    const trimmedUrl = url.trim()
    urlContent = await readUrl(trimmedUrl)
    if (!urlContent) {
      urlFetchNote = `(Note: could not fetch content from ${trimmedUrl} — if this is a tweet, paste the text below)`
    }
  }

  const incidentText = [
    news ? `USER-PROVIDED CONTENT:\n${news}` : '',
    urlContent ? `FETCHED PAGE CONTENT:\n${urlContent}` : '',
  ].filter(Boolean).join('\n\n')

  if (incidentText.trim().length < 40) {
    const isTwitter = url && /twitter\.com|x\.com/.test(url)
    return NextResponse.json({
      error: isTwitter
        ? 'Could not read this tweet automatically. Please paste the tweet text into the context field and try again.'
        : urlFetchNote
          ? 'Could not fetch the URL. Please paste the article text directly into the context field.'
          : 'Please provide more context.',
    }, { status: 400 })
  }

  const systemPrompt = `You are Arpit, founder of Aergap — building the policy enforcement and governance layer for autonomous AI agents. You write thought leadership content that positions Aergap as the company defining the conversation around AI agent governance.

AERGAP KNOWLEDGE:
${AERGAP_KNOWLEDGE}

${CONTENT_VOICE_RULES}

You analyze ANY type of content related to AI agents — product launches, funding announcements, research papers, enterprise deployments, regulations, security incidents, market trends, failures, or success stories. You are not limited to security hacks. The full scope includes:
- AI agent news and infrastructure announcements
- Agentic payment products and autonomous finance
- Enterprise AI deployments and case studies
- AI regulations and compliance developments
- Security incidents (AI and crypto)
- Venture funding in AI-agent companies
- Research papers and benchmark reports
- Developer tools and MCP-based products
- Conference announcements and industry shifts

For every piece of content, identify:
1. Why this matters for the future of AI agents
2. The hidden governance, trust, compliance, or accountability problem most people overlook
3. Where the Aergap governance layer (agent identity, policy enforcement, execution gate, audit trail) becomes relevant — only if the connection is genuine
4. An original insight that goes beyond what the article says

IMPORTANT — X PREMIUM POST FORMAT:
Arpit has X Premium (posts up to 25,000 characters). Do NOT write short 280-char one-liners. Each tweet should be a complete narrative — long enough to tell the full story with impact.

Every tweet must follow this exact 3-part structure, with a blank line between each section:

PART 1 — HOOK (2-4 lines max)
The single most important or counterintuitive fact from the news. Something that makes someone stop scrolling. Specific numbers, company names, or outcomes. No generic opener. No question. State the fact cold.

PART 2 — THE INSIGHT (4-8 lines)
Break down what this actually means. What is the structural implication? What risk or opportunity does this create? What governance or accountability question does it raise? Be specific. Reference actual mechanisms, not abstractions.

PART 3 — THE MISSING LAYER (4-8 lines)
This is where the Aergap angle comes in — but naturally, as the logical answer to the gap you just identified. Describe the specific capability (policy enforcement, agent identity, execution gate, audit trail) that addresses the exact problem. The product name can appear once, at the end. Skip this section entirely if the Aergap connection is forced or weak — instead, end with a sharp industry observation.

No hashtags. No call-to-action. No "retweet if you agree". End on a sharp factual or analytical statement.

LINKEDIN FORMAT — same narrative discipline, long-form:

Every LinkedIn post must follow this exact 4-part structure, with a blank line between each part:

PART 1 — HOOK (1-3 lines)
The sharpest insight or most surprising fact from the news. Stated cold. Specific — a number, a company name, a specific outcome. Not a question, not a motivational opener.

PART 2 — WHAT THIS MEANS (3-5 short paragraphs)
Unpack with depth. Each paragraph = one distinct analytical beat. What's the structural shift? Who benefits, who's at risk? What assumption does this challenge? Short sentences. Specific details.

PART 3 — THE GOVERNANCE GAP (1-2 paragraphs)
The structural risk or missing layer most people will overlook. Not finger-pointing — just the mechanism. Why does this problem exist at the system level? If no governance gap exists, write about the broader industry implication instead.

PART 4 — WHAT THE FIX LOOKS LIKE (1-2 paragraphs)
Describe the solution mechanism first. Aergap appears once, as the name for the governance layer you just described. If Aergap is not a natural fit, end with one sharp observation about where the industry needs to go. End the post with one sharp closing line — no call to action, no "follow me for more".

No bullet points. No bold text on random words. No emoji. No hashtag spam (0-1 max). Max 400 words total.

You will produce:
1. THREE tweet variations — same structure, each using a DIFFERENT angle or entry point
2. ONE tweet thread (5 tweets — break the story into connected insights, each tweet standalone)
3. TWO LinkedIn post variations — same 4-part structure, each starting from a DIFFERENT hook

Return JSON only.`

  const userPrompt = `Here is the content to analyze and write about:

${incidentText}

First, analyze it through the Aergap lens:
1. What happened / what was announced?
2. Why does this matter for the future of autonomous AI agents?
3. What hidden governance or accountability gap does this reveal?
4. Which Aergap capability (agent identity, policy enforcement, execution gate, audit trail) is genuinely relevant — and only if it is?
5. What original, founder-level observation goes beyond the obvious summary?

Then write the content following the exact structures above.

Return JSON exactly:
{
  "incident_summary": "One sentence: executive summary of the news in plain language.",
  "root_cause": "One sentence: the hidden problem or governance gap most people will overlook.",
  "kima_angle": "One sentence: which specific Aergap capability directly addresses this — or 'N/A' if the connection is not genuine.",
  "why_this_matters": "One sentence: the broader market or industry implication for enterprise AI.",
  "original_insight": "One sentence: the founder-level observation that goes beyond the obvious summary.",
  "engagement_hooks": [
    "A thought-provoking question for enterprise leaders or AI builders",
    "A question for founders or investors",
    "A question that challenges conventional wisdom about this topic"
  ],
  "tweets": [
    { "id": "tweet_1", "text": "HOOK\\n\\nTHE INSIGHT\\n\\nTHE MISSING LAYER — angle 1" },
    { "id": "tweet_2", "text": "HOOK\\n\\nTHE INSIGHT\\n\\nTHE MISSING LAYER — angle 2, different perspective" },
    { "id": "tweet_3", "text": "HOOK\\n\\nTHE INSIGHT\\n\\nTHE MISSING LAYER — angle 3, different entry point" }
  ],
  "thread": [
    { "id": "thread_1", "text": "Hook tweet — the single sharpest observation" },
    { "id": "thread_2", "text": "Context — what is actually happening here" },
    { "id": "thread_3", "text": "The structural implication or risk" },
    { "id": "thread_4", "text": "The governance gap — what is missing" },
    { "id": "thread_5", "text": "Closing — sharp takeaway or call to the industry" }
  ],
  "linkedin": [
    { "id": "linkedin_1", "text": "HOOK\\n\\nWHAT THIS MEANS (multiple paragraphs, each separated by blank line)\\n\\nTHE GOVERNANCE GAP\\n\\nFIX — angle 1" },
    { "id": "linkedin_2", "text": "HOOK (different angle)\\n\\nWHAT THIS MEANS\\n\\nTHE GOVERNANCE GAP\\n\\nFIX — angle 2" }
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

    // Ensure new fields have defaults for backward compatibility
    if (!result.why_this_matters) result.why_this_matters = ''
    if (!result.original_insight) result.original_insight = ''
    if (!Array.isArray(result.engagement_hooks)) result.engagement_hooks = []

    return NextResponse.json({ success: true, data: result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Content generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
