import { claudeJSON, claudeText, CLAUDE_RESEARCH } from "@/lib/claude"
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'
import { getProductSection } from '@/lib/product-sections'
import { firecrawlConfigured, firecrawlSearch, firecrawlDeepScrape } from '@/lib/firecrawl'

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
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      console.error('[searchCount] Tavily HTTP', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    return Array.isArray(data.results) ? data.results.length : 0
  } catch (e) {
    // Was previously silent — every source-suggestion run's query-type
    // validation failures were unexplainable (see "not test-crawled" note),
    // same class of problem as the leads.source_id incident: a real error
    // with zero trace. Six of these checks fire concurrently (see
    // Promise.all below) alongside Firecrawl's own long-running fetches,
    // so a transient network stall is plausible — logging it is what makes
    // that diagnosable instead of just "unverified" with no reason.
    console.error('[searchCount]', e instanceof Error ? e.message : e)
    return null
  }
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

  // URL: prefer Firecrawl (handles JS-rendered/paginated pages a plain fetch
  // misses — the same tool "Run these resources" uses to actually work these
  // sources later, so a source that validates via Firecrawl here is proven
  // crawlable the same way it'll really be crawled). Falls back to Jina when
  // Firecrawl isn't configured or comes back empty.
  try {
    let text = ''
    let via = 'jina'
    if (firecrawlConfigured()) {
      text = await firecrawlDeepScrape(target, { maxActions: 2 })
      via = 'firecrawl'
    }
    if (!text) {
      const res = await fetch(`https://r.jina.ai/${target}`, {
        headers: { Accept: 'text/plain' },
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) return { status: 'unverified', note: `Couldn’t reach (HTTP ${res.status})` }
      text = (await res.text()) || ''
      via = 'jina'
    }
    if (text.length < 250) return { status: 'thin', note: 'Reachable but very little content' }
    // Rough signal: number of links + capitalized multi-word names hints at a list of companies.
    const links = (text.match(/https?:\/\//g) || []).length
    if (text.length > 1200 && links >= 5) return { status: 'good', note: `Reachable via ${via} · rich, link-heavy page` }
    return { status: 'good', note: `Reachable via ${via} · has content` }
  } catch {
    return { status: 'unverified', note: 'Couldn’t reach in time' }
  }
}

const PRODUCT_LABELS: Record<string, string> = {
  aerpolice: 'AERpolice (AI-agent governance)',
  aer360: 'AER360 (hardware-enforced wallet/fund custody and key-signing)',
  aerseal: "AERseal (hardware-enforced custody of a deployed smart contract's privileged admin authority)",
  aerkey: 'AERKey (TEE-attested threshold ECDSA signing — cryptographic key governance)',
  agent: 'Kima / Aeredium-L1 (trustless settlement and interoperability infrastructure)',
}

export async function POST(req: Request) {
  // This route generates suggestions via claudeJSON (Claude), not OpenAI —
  // gate on the key it actually uses.
  const { claudeConfigured } = await import('@/lib/claude')
  if (!claudeConfigured()) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 400 })
  }

  let productSlug = ''
  let approachText = ''
  try {
    const body = await req.json()
    productSlug = typeof body?.productSlug === 'string' ? body.productSlug : ''
    approachText = typeof body?.approachText === 'string' ? body.approachText : ''
  } catch { /* no body — global suggestion mode */ }

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

    // 3. What the agent has learned about good targeting.
    const { data: knowledge } = await supabase
      .from('agent_knowledge')
      .select('title, content')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)
    const learned = (knowledge || []).map(k => `- ${k.title}: ${(k.content || '').slice(0, 200)}`).join('\n') || '(none yet)'

    const scopedLabel = PRODUCT_LABELS[productSlug]
    const scopedSection = scopedLabel ? getProductSection(productSlug) : undefined

    // 4. Live grounding — actually crawl the web for what currently exists,
    // rather than trusting the model's static training-data recall of
    // directories/communities that may be stale, renamed, or dead. Grounded
    // in the product's own approach text (or its label as a fallback) so the
    // search itself reflects the specific strategy, not a generic crypto
    // query. Firecrawl search first (real crawled results); falls back to
    // Tavily if Firecrawl isn't configured.
    const groundingQuery = approachText
      ? approachText.slice(0, 300)
      : scopedLabel
        ? `sources to find ${scopedLabel} customers`
        : 'directories and communities to find AI-agent governance, custody/key-signing, and deployed-contract admin-authority companies'
    const firecrawlHits = firecrawlConfigured() ? await firecrawlSearch(groundingQuery, 8) : []
    const web = firecrawlHits.length
      ? firecrawlHits.map(r => `${r.title} — ${r.url}\n${r.description}`).join('\n\n')
      : await searchWeb(groundingQuery)

    // Global (unscoped) mode — hit when "Suggest sources" is clicked from the
    // general Sources page rather than a per-product Resources page, which
    // sends no productSlug/approachText. Without this, the three saved
    // Approach pages were silently ignored on that path even though the user
    // had filled them in. Loads all three at once since this branch covers
    // all three products together.
    let globalApproachBlock = ''
    if (!scopedLabel) {
      const { data: approachRows } = await supabase
        .from('product_hunting_approach')
        .select('product_slug, approach_text')
        .in('product_slug', ['aer360', 'aerpolice', 'aerseal'])
      const labels: Record<string, string> = { aer360: 'AER360', aerpolice: 'Aerpolice', aerseal: 'AERseal' }
      const parts = (approachRows || [])
        .filter(r => r.approach_text?.trim())
        .map(r => `${labels[r.product_slug] || r.product_slug}:\n${r.approach_text!.trim()}`)
      if (parts.length) {
        globalApproachBlock = `THE USER'S OWN HUNTING APPROACH PER PRODUCT (follow these as the primary strategy for each product — they override generic assumptions below where the two disagree):\n\n${parts.join('\n\n')}`
      }
    }

    const systemPrompt = scopedLabel
      ? `You are a senior BD lead-generation strategist working ONLY on ${scopedLabel}. Suggest sources for finding ${scopedLabel} customers exclusively — do not suggest sources for any other Kima/Aeredium product, even if they'd otherwise look reasonable.

${scopedSection?.knowledge || ''}

${approachText ? `THE USER'S OWN HUNTING APPROACH FOR THIS PRODUCT (follow this as the primary strategy — it overrides generic assumptions below):\n${approachText}\n` : ''}

Your job: suggest NEW discovery sources the user should add to their lead-finding agent for ${scopedLabel} ONLY.
A "source" is a place the agent can crawl/search to find target companies: an ecosystem/MCP directory,
a Telegram/Discord community, a Twitter/X profile that posts deals, a Google search query, a news/funding
feed, a Crunchbase list, a hackathon directory, an agent marketplace, a hack/incident tracker, etc.
Sources must be realistically crawlable from a public URL or a search query.

Return ONLY valid JSON. No markdown.`
      : `You are a senior BD lead-generation strategist for Aerpolice (AI-agent governance), AER360 (hardware-enforced wallet/fund custody and key-signing), and AERseal (hardware-enforced custody of a deployed smart contract's privileged admin authority) — the ONLY three products this agent sources leads for, each co-equal. Do not suggest sources aimed at Kima, cross-chain settlement, bridges (as a settlement/interop play), RWA tokenization, stablecoin on/off-ramps, or general crypto/DeFi/fintech directories that aren't specifically about AI agents, custody/key-signing, or deployed-contract admin authority — those are out of scope even if they'd otherwise look like reasonable BD sources.

${PRODUCT_BRAIN}

${globalApproachBlock ? `${globalApproachBlock}\n` : ''}

Your job: suggest NEW discovery sources the user should add to their lead-finding agent.
A "source" is a place the agent can crawl/search to find target companies: an ecosystem/MCP directory,
a Telegram/Discord community, a Twitter/X profile that posts deals, a Google search query, a news/funding
feed, a Crunchbase list, a hackathon directory, an agent marketplace, a hack/incident tracker, etc.

Good sources are: high-signal, regularly updated, full of companies that match one of the three products' ICP —
Aerpolice (AI-native companies whose agents take consequential financial or system actions — payments,
procurement, treasury, trading, data access — especially ones facing enterprise security review; MCP-based
tooling; agentic-commerce/autonomous-checkout startups; AI wallet builders), AER360 (custodians, MPC/
custody wallet providers, exchanges, treasuries, or funds needing hardware-enforced key-signing governance,
or companies about to give an AI agent real spending authority), and AERseal (DeFi protocols, token/stablecoin
issuers, bridges, L2/L3 operators, tokenization/RWA platforms, staking/restaking protocols, or DAOs whose
deployed contract has a privileged role controlled by a single EOA or weak multisig — hack/near-miss trackers
like DeFiLlama, Rekt.news, and Immunefi are strong AERseal sources since they surface exactly this). Actively
look for gaps: if any of the three have few or no dedicated sources yet, prioritize suggesting sources for
whichever is thinnest.
Sources must be realistically crawlable from a public URL or a search query.

Return ONLY valid JSON. No markdown.`

    const userPrompt = `SOURCES ALREADY ADDED (do NOT suggest these or close variants):
${existingList}

WHAT THE AGENT HAS LEARNED ABOUT GOOD TARGETS:
${learned}

LIVE WEB CONTEXT (real, currently-crawled places — prefer these over recalling from memory when they fit):
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

    const parsed = await claudeJSON({ model: CLAUDE_RESEARCH, system: systemPrompt, user: userPrompt, maxTokens: 1600 })
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
