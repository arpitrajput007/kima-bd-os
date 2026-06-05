import { claudeJSON, claudeText, CLAUDE_RESEARCH } from "@/lib/claude"
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN_COMPACT } from '@/lib/kima-knowledge'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SOURCE_TYPES = [
  'exa_search', 'exa_similar', 'apollo_search',
  'website', 'google_search', 'twitter_profile', 'linkedin_company',
  'telegram_group', 'rss_feed', 'defillama_category', 'crunchbase_list',
  'ecosystem_directory', 'hackathon_directory', 'news_source', 'manual_list',
]

// Optional live grounding: surface real, currently-active source ideas via Tavily.
async function searchWeb(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return ''
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 6 }),
    })
    const data = await res.json()
    if (!data.results) return ''
    return data.results.map((r: { title: string; url: string; content: string }) => `${r.title} — ${r.url}\n${r.content?.slice(0, 200)}`).join('\n\n')
  } catch { return '' }
}

// How many Tavily results a search query returns (for validating query-type sources).
async function searchCount(query: string): Promise<number | null> {
  if (!process.env.TAVILY_API_KEY) return null
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 8 }),
    })
    const data = await res.json()
    return Array.isArray(data.results) ? data.results.length : 0
  } catch { return null }
}

interface SourceLike {
  source_url_or_query: string
  source_type: string
}
type Verdict = { status: 'good' | 'thin' | 'dead' | 'unverified'; note: string }

// Dry-run a single suggestion: is the URL reachable with real, crawlable content,
// or does the search query return results? Used to drop low-yield ideas.
async function validateSuggestion(s: SourceLike): Promise<Verdict> {
  const target = (s.source_url_or_query || '').trim()
  if (!target) return { status: 'dead', note: 'No URL or query' }

  const isUrl = target.startsWith('http://') || target.startsWith('https://')
  if (!isUrl) {
    // Treat as a search query.
    const n = await searchCount(target)
    if (n === null) return { status: 'unverified', note: 'Search query (not test-crawled)' }
    if (n === 0) return { status: 'dead', note: 'Query returned no results' }
    return { status: 'good', note: `Query returns ${n}+ results` }
  }

  // URL: fetch through Jina and judge by reachability + content richness.
  try {
    const res = await fetch(`https://r.jina.ai/${target}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { status: 'unverified', note: `Couldn’t reach (HTTP ${res.status})` }
    const text = (await res.text()) || ''
    if (text.length < 250) return { status: 'thin', note: 'Reachable but very little content' }
    // Rough signal: number of links + capitalized multi-word names hints at a list of companies.
    const links = (text.match(/https?:\/\//g) || []).length
    if (text.length > 1200 && links >= 5) return { status: 'good', note: 'Reachable · rich, link-heavy page' }
    return { status: 'good', note: 'Reachable · has content' }
  } catch {
    return { status: 'unverified', note: 'Couldn’t reach in time' }
  }
}

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
  }

  try {
    // 1. What sources already exist (so we don't suggest duplicates).
    const { data: existing } = await supabase
      .from('sources')
      .select('source_name, source_type, source_url_or_query, leads_generated')

    const existingList = (existing || []).map(s =>
      `- ${s.source_name} [${s.source_type}] ${s.source_url_or_query || ''} (${s.leads_generated || 0} leads)`
    ).join('\n') || '(none yet)'

    const existingUrls = new Set(
      (existing || []).map(s => (s.source_url_or_query || '').toLowerCase().trim()).filter(Boolean)
    )

    // 2. Which categories are underfilled — bias suggestions toward gaps + what converts.
    const { data: leads } = await supabase
      .from('leads')
      .select('customer_category, status')
      .not('status', 'in', '("rejected","archived")')

    const catCounts: Record<string, number> = {}
    const converting: Record<string, number> = {}
    ;(leads || []).forEach((l: { customer_category?: string[]; status?: string }) => {
      ;(l.customer_category || []).forEach(c => {
        catCounts[c] = (catCounts[c] || 0) + 1
        if (l.status === 'replied' || l.status === 'meeting_booked') converting[c] = (converting[c] || 0) + 1
      })
    })
    const catSummary = Object.keys(catCounts).length
      ? Object.entries(catCounts).map(([c, n]) => `${c}: ${n} leads, ${converting[c] || 0} converting`).join('\n')
      : '(no leads yet)'

    // 3. What the agent has learned about good targeting.
    const { data: knowledge } = await supabase
      .from('agent_knowledge')
      .select('title, content')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)
    const learned = (knowledge || []).map(k => `- ${k.title}: ${(k.content || '').slice(0, 200)}`).join('\n') || '(none yet)'

    // 4. Light live grounding (best-effort).
    const web = await searchWeb('best directories and communities to find new crypto payment, stablecoin, DeFi and AI agent projects 2026')

    const systemPrompt = `You are a senior BD lead-generation strategist for Kima and Aeredium.

${PRODUCT_BRAIN_COMPACT}

Your job: suggest NEW discovery sources the user should add to their lead-finding agent.
A "source" is a place the agent can crawl/search to find target companies: an ecosystem directory,
a Telegram/Discord community, a Twitter/X profile that posts deals, a Google search query, a news/funding
feed, a DeFiLlama category, a Crunchbase list, a hackathon directory, etc.

Good sources are: high-signal, regularly updated, full of companies that match Kima/Aeredium's ICP
(payment/settlement/cross-chain/stablecoin/agentic-commerce/RWA/wallets/exchanges/fintech), and
realistically crawlable from a public URL or a search query.

Return ONLY valid JSON. No markdown.`

    const userPrompt = `SOURCES ALREADY ADDED (do NOT suggest these or close variants):
${existingList}

CURRENT LEAD CATEGORIES (bias toward gaps and what's converting):
${catSummary}

WHAT THE AGENT HAS LEARNED ABOUT GOOD TARGETS:
${learned}

LIVE WEB CONTEXT (real places, may help you propose concrete URLs):
${web || '(no live data)'}

Suggest 6 strong NEW sources. For each, prefer a real, specific, public URL or a precise Google search query.
Return JSON:
{
  "suggestions": [
    {
      "source_name": "short descriptive name",
      "source_type": "one of: ${SOURCE_TYPES.join(', ')}",
      "source_url_or_query": "a real public URL OR a precise search query the agent can run",
      "why": "1-2 sentences: why this is a strong source and what kind of leads it brings",
      "expected_leads": "the kind of companies/categories this will surface",
      "confidence": "high|medium|low"
    }
  ]
}`

    const parsed = await claudeJSON({ model: CLAUDE_RESEARCH, system: systemPrompt, user: userPrompt, maxTokens: 1600, temperature: 0.6 })
    const raw = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
      .filter((s: { source_url_or_query?: string }) =>
        !existingUrls.has((s.source_url_or_query || '').toLowerCase().trim()))
      .map((s: Record<string, string>) => ({
        source_name: s.source_name || 'Untitled source',
        source_type: SOURCE_TYPES.includes(s.source_type) ? s.source_type : 'google_search',
        source_url_or_query: s.source_url_or_query || '',
        why: s.why || '',
        expected_leads: s.expected_leads || '',
        confidence: ['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'medium',
      }))

    // Dry-run each suggestion in parallel, then drop the dead ones.
    const verdicts = await Promise.all(raw.map((s: SourceLike) => validateSuggestion(s)))
    const suggestions = raw
      .map((s: Record<string, string>, i: number) => ({
        ...s,
        verified: verdicts[i].status === 'good',
        check_status: verdicts[i].status,
        check_note: verdicts[i].note,
      }))
      .filter((s: { check_status: string }) => s.check_status !== 'dead')
      // Show verified/reachable ones first.
      .sort((a: { check_status: string }, b: { check_status: string }) => {
        const rank: Record<string, number> = { good: 0, unverified: 1, thin: 2 }
        return (rank[a.check_status] ?? 3) - (rank[b.check_status] ?? 3)
      })

    return NextResponse.json({ success: true, suggestions, tested: raw.length, kept: suggestions.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Suggestion failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
