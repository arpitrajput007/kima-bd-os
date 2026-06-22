import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN, PRODUCT_BRAIN_COMPACT } from '@/lib/kima-knowledge'
import { pickBestUrl, extractSocials, type Socials } from '@/lib/utils'
import { apolloConfigured, apolloEnrichContacts, apolloSearchCompanies, toDomain } from '@/lib/apollo'
import { isGenericName } from '@/lib/leadQuality'
import { exaConfigured, exaSearchCompanies, exaCompanyNews } from '@/lib/exa'
import { perplexityConfigured, researchCompanyTrigger } from '@/lib/perplexity'
import { routeJSON, type AIProvider } from '@/lib/ai-router'
import { CLAUDE_FAST } from '@/lib/claude'
import { discoveryMemory } from '@/lib/agent-memory'

// Deep research (OpenAI + Exa + crawling) per company is slow. Without this the
// function hits Vercel's default timeout and gets killed before saving leads.
// 300s = Vercel Pro cap; on Hobby it's silently clamped to the plan max.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

async function getHunterContacts(website: string): Promise<string> {
  if (!process.env.HUNTER_API_KEY || !website) return ''
  try {
    const domain = website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${process.env.HUNTER_API_KEY}&limit=10`)
    const data = await res.json()
    if (!data?.data?.emails?.length) return ''
    return JSON.stringify(data.data.emails.map((e: any) => ({
      email: e.value,
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
      position: e.position,
      department: e.department,
      confidence: e.confidence
    })))
  } catch (e) {
    return ''
  }
}


const CUSTOMER_CATEGORIES = [
  'Agentic Payments Customer',
  'LayerZero Customer',
  'Hacked Protocol',
  'Needs On/Off Ramp',
  'Fireblocks Customer',
  'Web2 Stablecoin Settlement Customer',
]
// Cap = how many *unworked* prospects we allow to sit in a category at once.
// Only leads still in the top-of-funnel (see CAP_BLOCKING_STATUSES) count toward
// this. Once you contact/reserve/qualify a lead it stops blocking new discovery,
// so the daily pipeline keeps surfacing fresh leads instead of clogging.
const CATEGORY_CAP = 8
const CAP_BLOCKING_STATUSES = ['new', 'researching', 'needs_more_research']

// Read any URL as clean text via Jina.ai (free, no key needed)
async function readUrl(url: string): Promise<string> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`)
    const text = await res.text()
    return text.slice(0, 10000) // cap to stay within GPT token budget
  } catch (e) {
    console.error('[readUrl]', e)
    return ''
  }
}

// Check a URL against ChainPatrol's phishing registry (free, no key needed).
// Used by MetaMask, SEAL, and other Web3 security tools.
// Returns true if safe, false if flagged as phishing/malicious.
// Fails open (returns true) so a network error never blocks all discovery.
async function isSafeDomain(url: string): Promise<boolean> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch('https://app.chainpatrol.io/api/v2/asset/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'URL', content: fullUrl }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return true // fail open
    const json = await res.json()
    if (json.status === 'BLOCKED') {
      console.warn(`[isSafeDomain] Phishing domain blocked: ${fullUrl}`)
      return false
    }
    return true
  } catch {
    return true // fail open — don't block discovery if check times out
  }
}

// Read a company website and pull real social links (twitter/telegram/discord)
// from the page (usually the header/footer). No AI guessing — regex only.
async function fetchSocials(website?: string, companyName?: string): Promise<Socials> {
  if (!website) return {}
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return {}
    const text = await res.text()
    return extractSocials(text, companyName)
  } catch {
    return {}
  }
}

// If the extracted company has no website, do a quick search to find the real one.
// Returns the best URL found, or '' if nothing found.
async function resolveWebsite(companyName: string): Promise<string> {
  try {
    // First try Jina search — fast and free.
    const jinaSearch = `https://s.jina.ai/${encodeURIComponent(companyName + ' official website')}`
    const res = await fetch(jinaSearch, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) {
      const text = await res.text()
      // Find first https:// link that looks like a homepage (not a social or news site).
      const links = [...text.matchAll(/https?:\/\/(?!.*(?:twitter|t\.co|x\.com|linkedin|facebook|instagram|crunchbase|wikipedia|medium|substack|coinmarketcap|coingecko|techcrunch|theblock|decrypt|cointelegraph|github|reddit|youtube|bloomberg|forbes|reuters|wsj))[a-z0-9.-]+\.[a-z]{2,}(?:\/)?(?=$|\s|\))/gi)]
      if (links.length) return links[0][0].replace(/\/$/, '')
    }
  } catch { /* fall through */ }

  // Tavily fallback.
  if (process.env.TAVILY_API_KEY) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: companyName + ' official site', max_results: 3, search_depth: 'basic' }),
        signal: AbortSignal.timeout(12000),
      })
      const data = await res.json()
      const top = (data?.results || [])[0]?.url
      if (top && !/(twitter|linkedin|facebook|crunchbase|wikipedia|medium|github|reddit|youtube|bloomberg|theblock|decrypt|cointelegraph)/i.test(top)) {
        return top.replace(/\/$/, '')
      }
    } catch { /* fall through */ }
  }
  return ''
}

// Pull socials from a web-search result page (fallback when we have no website to crawl).
async function fetchSocialsFromSearch(companyName: string): Promise<Socials> {
  try {
    const q = encodeURIComponent(companyName + ' twitter telegram discord')
    const res = await fetch(`https://s.jina.ai/${q}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return {}
    return extractSocials(await res.text(), companyName)
  } catch { return {} }
}

// Search web using Tavily API
async function searchWeb(query: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return ''
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_raw_content: false,
        max_results: 10
      })
    })
    const data = await res.json()
    if (!data.results) return ''
    return data.results.map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n\n')
  } catch (e) {
    console.error('[searchWeb]', e)
    return ''
  }
}

// Extract company mentions from raw page content
async function extractCompanies(
  content: string,
  sourceContext: string,
  provider: AIProvider = 'claude'
): Promise<Array<{ name: string; website: string; description: string; source_url: string }>> {
  try {
    const result = await routeJSON<{ companies: Array<{ name: string; website: string; description: string; source_url: string }> }>({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 2000,
      temperature: 0.2,
      system: `You are a BD researcher for Kima and Aeredium.

${PRODUCT_BRAIN_COMPACT}

Output REAL, SPECIFIC, NAMED companies that could be B2B customers for payment/settlement infrastructure — never categories.

CRITICAL — every "name" MUST be a single real company you could google and land on one company's website:
- GOOD (real companies): "Bybit", "Coinbase", "Binance", "Circle", "MetaMask", "Fireblocks", "JPMorgan", "Revolut", "Stripe", "Ripple".
- BANNED (categories / segments / groupings — NEVER output these as a name): "Crypto Exchanges", "Banks", "Exchanges", "Stablecoin Issuers", "Lending Platforms", "Custody", "Wallets", "DEXs", "Payment Companies", "RWA Platforms", "Neobanks", "Bridges", "Cross-border Payment Providers", "Fintechs".

EXPAND CATEGORIES INTO REAL COMPANIES:
- If the content points at a CATEGORY, expand it into specific real companies that best fit Kima/Aeredium's ICP.
  · "crypto exchanges" → Binance, Bybit, OKX, Kraken, Bitget, KuCoin
  · "banks" → JPMorgan, Standard Chartered, DBS Bank, BBVA, HSBC
  · "wallets" → MetaMask, Trust Wallet, Phantom, Rabby
  · "stablecoin issuers" → Circle, Tether, Paxos, Ethena
- Only name companies that genuinely exist with a findable website.
- Return 5 high-quality real companies rather than 15 vague ones.`,
      user: `Source: ${sourceContext}

Content:
${content}

Return up to 8 SPECIFIC, REAL, NAMED companies (quality over quantity — 8 great picks beats 15 mediocre ones). Never output a category/segment as a name. Return JSON:
{
  "companies": [
    {
      "name": "Real brand name (e.g. 'Bybit', 'JPMorgan') — NEVER a category",
      "website": "https://<real domain>",
      "description": "1-2 sentence description of what this company does",
      "source_url": "EXACT link from content about this company, or empty string"
    }
  ]
}`,
    })
    return Array.isArray(result.companies) ? result.companies : []
  } catch (e) {
    console.error('[extractCompanies]', e)
    return []
  }
}

// Removed: getLearnedIntelligence() — replaced by discoveryMemory() from lib/agent-memory.ts
// discoveryMemory() loads up to 56 knowledge entries (8 per type × 7 types) + active rules
// + feedback patterns, vs the old limit(30) by recency which dropped older knowledge.

// Full deep-dive research on a single company
async function deepResearch(
  company: {
  name: string
  website: string
  description: string
},
  learnedIntelligence?: string,
  provider: AIProvider = 'claude'
): Promise<Record<string, unknown> | null> {
  const domain = (company.website || '')
    .replace(/https?:\/\//, '')
    .replace(/\/.*/, '')
    .trim()

  try {
    const hunterData = await getHunterContacts(company.website)
    const hunterContext = hunterData ? `\nVerified emails from Hunter.io database:\n${hunterData}\nSelect the most relevant BD contacts from this list if any, otherwise guess patterns.` : ''

    // For Claude: Opus + extended thinking — the ONE place in the whole codebase
    // where Opus earns its cost. Extended thinking reasons through company-specific
    // pain points and finds real contacts rather than generic ones.
    // For OpenAI: standard gpt-4o via routeJSON.
    const deepResearchSystem = `You are a senior BD researcher for Kima and Aeredium.

${PRODUCT_BRAIN}

FIRST, validate the input is a REAL, SPECIFIC company (a brand you can google to one company's site like "Bybit", "JPMorgan", "Circle") and NOT a generic category/segment ("Crypto Exchanges", "Banks", "Fintechs", "Infrastructure", "AI", "RWA Platforms"). If it is a category, set "is_specific_real_company": false and leave other fields minimal.

SCORING (0-100):
High score (70+): clear pain point, active product, matches a target category, decision maker findable
Medium (40-69): possible fit but unclear pain point or no direct match
Low (<40): no clear use case for Kima/Aeredium
${learnedIntelligence || ''}`

    const deepResearchUser = `Do a deep BD research on this company for Kima/Aeredium:

Company: ${company.name}
Website: ${company.website || 'unknown'}
Description: ${company.description}${hunterContext}

PAIN POINT RULES — be specific, not generic:
- Do NOT write "they need faster settlement" or "they face cross-chain challenges". Anyone can write that.
- DO write the SPECIFIC pain: what exact product/feature breaks, what exact cost/risk/delay they face, what specific incident or architecture choice creates the vulnerability. Cite real facts about this company.
- For hacked protocols: name the exploit type, the amount lost, the exact vulnerability (bridge verifier set, oracle, relayer, smart-contract bug).
- For LayerZero users: explain what specific cross-chain flows they run and why bridge failure is existential for them.
- For Fireblocks users: what custody/signing limitation blocks their growth.
- pain_point_severity = critical only if there is a real incident or a blocking architectural dependency.

CONTACT RULES — find the REAL decision maker, not a generic title:
- Priority 1: Head of BD / VP Partnerships / Head of Growth — this person signs integration deals.
- Priority 2: CTO / VP Engineering / Head of Protocol — needs to evaluate technical fit.
- Priority 3: CEO / Co-Founder — for companies < 100 people, this person often owns BD.
- If you know their real name (from public LinkedIn, press releases, Twitter) use it. Otherwise null — never fabricate names.
- linkedin_hint must be specific: "FirstName LastName CompanyName Title"
- why_this_person must explain the specific buying authority, not just the title.

Return this exact JSON:
{
  "is_specific_real_company": true,
  "industry_category": "one specific industry category",
  "customer_category": ["array — pick from: Agentic Payments Customer, LayerZero Customer, Hacked Protocol, Needs On/Off Ramp, Fireblocks Customer, Web2 Stablecoin Settlement Customer, Other"],
  "product_to_sell": "the single most relevant Kima/Aeredium product for this company and WHY",
  "region": "their primary market region",
  "company_summary": "3-4 sentence summary: what they do, how big, what stack they use, what stage they're at",
  "business_model": "how they specifically make money",
  "supported_chains_or_rails": "exact blockchains or payment rails they currently use",
  "current_providers": "specific known payment/bridge/settlement providers they currently use",
  "pain_point": "THE specific pain point — one crisp sentence with a concrete fact",
  "pain_point_severity": "critical|high|medium|low",
  "pain_point_evidence": "concrete evidence: exact quote, hack amount + date, specific architectural dependency, or named product limitation",
  "pain_point_source_url": "EXACT full URL to the article/post proving the pain point. Empty string if none.",
  "pain_point_evidence_type": "verified_source|agent_analysis|inferred",
  "kima_fit": "exactly how Kima's specific product solves their specific pain — tied to their actual stack",
  "suggested_use_case": "the precise Kima integration to pitch",
  "aeredium_fit": "how Aeredium's TEE validators / AERKey / AERLink addresses their trust or compliance gap",
  "trigger_reason": "why reach out NOW — a specific recent event (funding, product launch, hire, hack). Must be datable and real.",
  "source_url": "exact URL to the trigger event. NOT a homepage. null if none.",
  "settlement_angle": "the exact settlement improvement Kima delivers for their specific flow",
  "integration_feasibility": "high|medium|low — with one sentence of reasoning",
  "revenue_potential": "realistic ARR estimate for Kima based on their volume/scale",
  "lead_score": 0,
  "priority": "excellent|qualified|needs_research|low_priority",
  "score_reasoning": "2-3 sentences: what drives the score up and what limits it",
  "contacts": [
    {
      "role": "exact title of the ideal person to contact",
      "name": "real full name if publicly known, or null — never fabricate",
      "linkedin_hint": "FirstName LastName CompanyName Title",
      "twitter_hint": "exact @handle if known, or null",
      "email_pattern": "firstname@${domain || 'company.com'}",
      "why_this_person": "specific reason they own the buying decision",
      "contact_confidence": "high|medium|low"
    }
  ]
}`

    // Sonnet for Claude, gpt-4o for OpenAI.
    // NOTE: Do NOT use Opus + thinking here — on Vercel Hobby (60s hard cap),
    // Opus takes ~20-25s per company × 8 companies = ~200s → timeout → 0 leads.
    // Sonnet takes ~3-5s per company × 8 = ~30-40s → fits comfortably within 60s.
    // Sonnet quality is more than sufficient for company pain-point research.
    return await routeJSON({
      provider,
      model: provider === 'claude' ? CLAUDE_FAST : 'gpt-4o',
      maxTokens: 4000,
      temperature: 0.2,
      system: deepResearchSystem,
      user: deepResearchUser,
    })
  } catch (e) {
    console.error('[deepResearch]', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Use service role key on the server so RLS doesn't block lead INSERT/SELECT ops.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { source_id, research_ai = 'claude' } = await req.json()
    if (!source_id) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
    }
    // research_ai: 'claude' (default) | 'openai' — set by the user in Settings.
    const researchProvider: 'claude' | 'openai' = research_ai === 'openai' ? 'openai' : 'claude'

    // Pre-flight: make sure the selected AI provider is actually configured.
    // Without this check, auth errors get swallowed deep in extractCompanies/deepResearch
    // and the pipeline silently returns 0 leads with no visible error.
    if (researchProvider === 'claude') {
      const { claudeConfigured } = await import('@/lib/claude')
      if (!claudeConfigured()) {
        return NextResponse.json({
          error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local (local) or Render environment (production). Get a key at https://console.anthropic.com',
        }, { status: 503 })
      }
    } else {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
          error: 'OPENAI_API_KEY is not configured. Add it to your .env.local (local) or Render environment (production).',
        }, { status: 503 })
      }
    }

    // 1. Load the source
    const { data: source, error: srcError } = await supabase
      .from('sources')
      .select('*')
      .eq('id', source_id)
      .single()

    if (srcError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }
    if (!source.source_url_or_query) {
      return NextResponse.json({ error: 'Source has no URL or query configured' }, { status: 400 })
    }

    // 2. Check current category counts. Only count *recent* unworked leads — once a
    // lead is contacted/reserved/qualified it stops counting (it's "in play").
    // Also exclude leads older than 7 days: a backlog from last week should never
    // permanently block fresh discovery. Stale leads are still in the DB and visible;
    // they just don't occupy a cap slot so the pipeline keeps flowing.
    const capCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('customer_category')
      .in('status', CAP_BLOCKING_STATUSES)
      .gte('created_at', capCutoff)

    const categoryCounts: Record<string, number> = {}
    CUSTOMER_CATEGORIES.forEach(c => { categoryCounts[c] = 0 })
    ;(existingLeads || []).forEach((lead: { customer_category?: string[] }) => {
      const cats = lead.customer_category || []
      cats.forEach((cat: string) => {
        if (categoryCounts[cat] !== undefined) categoryCounts[cat]++
      })
    })

    // 3. Get existing company names/websites/domains to avoid duplicates.
    // We match on: exact lowercased name, lowercased domain (most reliable),
    // and a slug version (removes spaces/punctuation) to catch "Gnosis Safe" vs "GnosisSafe".
    const { data: existingCompanies } = await supabase
      .from('leads')
      .select('company_name, website')

    function nameSlug(s: string) {
      return s.toLowerCase().replace(/[^a-z0-9]/g, '')
    }

    const existingNames = new Set(
      (existingCompanies || []).map((l: { company_name?: string }) =>
        (l.company_name || '').toLowerCase().trim()
      )
    )
    const existingNameSlugs = new Set(
      (existingCompanies || []).map((l: { company_name?: string }) =>
        nameSlug(l.company_name || '')
      ).filter(Boolean)
    )
    const existingDomains = new Set(
      (existingCompanies || [])
        .map((l: { website?: string }) => toDomain(l.website || ''))
        .filter(Boolean)
    )
    const existingWebsites = existingDomains // keep alias for compatibility

    // 4. Get the company list — either straight from Apollo, or by crawling a URL/search.
    const sourceQuery = source.source_url_or_query.trim()
    const isApolloSource = source.source_type === 'apollo_search' || /^apollo:/i.test(sourceQuery)
    let companies: Array<{ name: string; website: string; description: string; source_url: string }> = []

    if (isApolloSource) {
      if (!apolloConfigured()) {
        return NextResponse.json({ error: 'Apollo API key not configured. Add APOLLO_API_KEY to your environment.' }, { status: 400 })
      }
      const q = sourceQuery.replace(/^apollo:/i, '').trim()
      companies = await apolloSearchCompanies(q, 8)
      if (!companies.length) {
        return NextResponse.json({ error: 'Apollo returned no companies for that query — try different keywords.' }, { status: 400 })
      }
    } else if (source.source_type === 'exa_similar') {
      // Exa findSimilar — point at a good lead URL, get more companies like it.
      if (!exaConfigured()) {
        return NextResponse.json({ error: 'EXA_API_KEY not configured.' }, { status: 400 })
      }
      const { exaFindSimilar } = await import('@/lib/exa')
      const similar = await exaFindSimilar(sourceQuery, 8)
      companies = similar
      if (!companies.length) {
        return NextResponse.json({ error: 'Exa could not find similar companies for that URL.' }, { status: 400 })
      }
    } else if (source.source_type === 'exa_search' || (!sourceQuery.startsWith('http') && exaConfigured())) {
      // Exa neural search — semantically finds real companies matching the query.
      companies = await exaSearchCompanies(sourceQuery, 8)
      if (!companies.length) {
        return NextResponse.json({ error: 'Exa returned no companies for that query — try different keywords.' }, { status: 400 })
      }
    } else {
      let content = ''
      if (sourceQuery.startsWith('http://') || sourceQuery.startsWith('https://')) {
        content = await readUrl(sourceQuery)
      } else {
        // Exa not configured — fall back to Tavily.
        if (!process.env.TAVILY_API_KEY) {
          return NextResponse.json({ error: 'No search API configured. Add EXA_API_KEY (recommended) or TAVILY_API_KEY to your environment.' }, { status: 400 })
        }
        content = await searchWeb(sourceQuery)
      }

      if (!content || content.length < 100) {
        return NextResponse.json(
          { error: 'Could not fetch content or content too short (try a different URL or search query)' },
          { status: 400 }
        )
      }

      // Extract company list from the page
      companies = await extractCompanies(content, `${source.source_name} (${source.source_type})`, researchProvider)
    }

    // 5b. Load full memory: up to 56 knowledge entries (8 per type) + active rules + feedback patterns
    const learnedIntelligence = await discoveryMemory()

    // Drop generic categories that slipped through as "companies".
    const realCompanies = companies.filter(c => !isGenericName(c.name))

    const results = {
      found: realCompanies.length,
      saved: 0,
      skipped_duplicate: 0,
      skipped_generic: companies.length - realCompanies.length,
      skipped_cap: 0,
      skipped_low_score: 0,
      leads_saved: [] as string[],
    }

    // 6. Deep-research each company and save qualified ones
    for (const company of realCompanies) {
      const nameKey = (company.name || '').toLowerCase().trim()


      // Skip duplicates — check name, name slug, and domain (most reliable).
      const nameSlugKey = nameSlug(company.name || '')
      const domainKey = toDomain(company.website || '')
      if (existingNames.has(nameKey)) { results.skipped_duplicate++; continue }
      if (nameSlugKey && existingNameSlugs.has(nameSlugKey)) { results.skipped_duplicate++; continue }
      if (domainKey && existingDomains.has(domainKey)) { results.skipped_duplicate++; continue }

      // Enrich company context with real-time research before the main deep-dive.
      // Perplexity: grounded trigger research (recent news, funding, events).
      // Exa: recent news as additional context.
      // Both run in parallel; both fail soft.
      const websiteForResearch = company.website || ''
      const [perplexityContext, exaNewsContext] = await Promise.all([
        perplexityConfigured() ? researchCompanyTrigger(company.name, websiteForResearch, company.description) : Promise.resolve({ trigger: '', sourceUrls: [] }),
        exaConfigured() ? exaCompanyNews(company.name) : Promise.resolve(''),
      ])

      // Merge the enriched context into company description for deepResearch.
      const enrichedCompany = {
        ...company,
        description: [
          company.description,
          perplexityContext.trigger ? `\n\nRECENT INTELLIGENCE (Perplexity, grounded):\n${perplexityContext.trigger}` : '',
          exaNewsContext ? `\n\nRECENT NEWS (Exa):\n${exaNewsContext.slice(0, 800)}` : '',
        ].filter(Boolean).join(''),
      }

      // Full research — inject learned intelligence + live context
      const research = await deepResearch(enrichedCompany, learnedIntelligence, researchProvider)
      if (!research) continue

      // If Perplexity found citation URLs, prefer them as source_url.
      if (perplexityContext.sourceUrls.length) {
        research.source_url = perplexityContext.sourceUrls[0]
      }

      // Hard gate: the model itself confirms this is a real company, not a category.
      if (research.is_specific_real_company === false) { results.skipped_generic++; continue }

      // Skip low-quality leads
      if ((research.lead_score as number) < 50) { results.skipped_low_score++; continue }

      // Determine relevant customer categories
      const categories = ((research.customer_category as string[]) || [])
        .filter(c => CUSTOMER_CATEGORIES.includes(c))
      if (categories.length === 0) categories.push('Other')

      // Check if any matching category has room (CATEGORY_CAP unworked leads)
      const hasRoom = categories.some(cat => (categoryCounts[cat] || 0) < CATEGORY_CAP)
      if (!hasRoom) { results.skipped_cap++; continue }

      // Resolve website — required before saving. If the extractor didn't find it,
      // do a quick search to look it up. Skip the lead if we still can't find one.
      let website = company.website?.trim() || (research.website as string | undefined)?.trim() || ''
      if (!website) {
        website = await resolveWebsite(company.name)
      }
      if (!website) { results.skipped_low_score++; continue } // no website = can't reach out

      // Safety check — never save a phishing / malicious domain.
      const safe = await isSafeDomain(website)
      if (!safe) {
        console.warn(`[discover] Skipping ${company.name} — domain flagged as phishing: ${website}`)
        results.skipped_duplicate++ // reuse counter; will log clearly in console
        continue
      }

      // Pull real social links. Crawl the website first; fall back to a search.
      let socials = await fetchSocials(website, company.name)
      if (!socials.twitter_url && !socials.telegram_url && !socials.discord_url) {
        const searchSocials = await fetchSocialsFromSearch(company.name)
        socials = { ...searchSocials, ...Object.fromEntries(Object.entries(socials).filter(([, v]) => v)) }
      }

      // Insert lead
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          company_name: company.name,
          website: website || null,
          twitter_url: socials.twitter_url || null,
          telegram_url: socials.telegram_url || null,
          discord_url: socials.discord_url || null,
          description: company.description,
          industry_category: research.industry_category,
          customer_category: research.customer_category,
          product_to_sell: research.product_to_sell,
          region: research.region,
          business_model: research.business_model,
          product_summary: research.company_summary,
          supported_chains_or_rails: research.supported_chains_or_rails,
          current_providers: research.current_providers,
          pain_point: research.pain_point,
          pain_point_severity: research.pain_point_severity,
          pain_point_evidence: research.pain_point_evidence,
          pain_point_source_url: research.pain_point_source_url || null,
          pain_point_evidence_type: research.pain_point_evidence_type || 'agent_analysis',
          kima_fit: research.kima_fit,
          aeredium_fit: research.aeredium_fit,
          suggested_use_case: research.suggested_use_case,
          trigger_reason: research.trigger_reason,
          settlement_angle: research.settlement_angle,
          integration_feasibility: research.integration_feasibility,
          revenue_potential: research.revenue_potential,
          lead_score: research.lead_score,
          priority: research.priority,
          source_url: pickBestUrl([
            company.source_url,            // exact link copied from the source page (most reliable)
            research.source_url as string, // AI-found specific URL
            source.source_url_or_query,    // the discovery source (may be a homepage/query)
            company.website,
          ]) || source.source_url_or_query,
          status: 'new',
        })
        .select('id')
        .single()

      if (!leadErr && newLead) {
        // Contact strategy (quality-first, three-tier):
        //
        // Tier 1 — Apollo people search by domain + seniority (real people, real titles,
        //          verified emails). Best quality; works even when we don't know names.
        // Tier 2 — Apollo person-match on AI-suggested names (enriches known names with
        //          verified email + LinkedIn).
        // Tier 3 — AI-guessed contacts (LinkedIn search URL + email pattern). Fallback only.
        const { apolloSearchPeople } = await import('@/lib/apollo')
        const domain = toDomain(website)
        const aiContacts = (research.contacts as Record<string, string>[]) || []

        // BD-relevant seniority signals to filter Apollo results
        const BD_ROLES = ['partnerships', 'business development', 'bd ', 'growth', 'cto', 'coo', 'chief technology', 'chief operating', 'vp eng', 'head of eng', 'founder', 'co-founder', 'ceo', 'chief executive']

        let contactsSaved = 0

        // Tier 1: Apollo people search
        if (domain && contactsSaved === 0) {
          const apolloPeople = await apolloSearchPeople(company.name, domain)
          const bdPeople = apolloPeople
            .filter(p => BD_ROLES.some(r => p.title?.toLowerCase().includes(r)))
            .slice(0, 3)
          const toInsert = bdPeople.length > 0 ? bdPeople : apolloPeople.slice(0, 2)
          for (const c of toInsert) {
            const { error: ce } = await supabase.from('contacts').insert({
              lead_id: newLead.id,
              name: c.name,
              role: c.title || 'Decision maker',
              company: company.name,
              linkedin_url: c.linkedin_url || null,
              email: c.email || null,
              contact_confidence: c.email ? 'high' : 'medium',
              reason_this_person: `Found via Apollo people search${c.seniority ? ` · ${c.seniority}` : ''}${c.title ? ` · ${c.title}` : ''}`,
            })
            if (!ce) contactsSaved++
          }
        }

        // Tier 2: Enrich AI-named contacts via Apollo (adds email + LinkedIn to known names)
        if (contactsSaved === 0 && domain) {
          const namedAiContacts = aiContacts.filter(c => c.name && !/^null$/i.test(String(c.name)))
          const apolloEnriched = namedAiContacts.length > 0
            ? await apolloEnrichContacts(domain, company.name, namedAiContacts.map(c => ({ name: c.name, role: c.role })))
            : []
          for (const c of apolloEnriched.slice(0, 3)) {
            const { error: ce } = await supabase.from('contacts').insert({
              lead_id: newLead.id,
              name: c.name,
              role: c.title || 'Decision maker',
              company: company.name,
              linkedin_url: c.linkedin_url || null,
              email: c.email || null,
              contact_confidence: c.email ? 'high' : 'medium',
              reason_this_person: `Verified via Apollo name-match${c.seniority ? ` · ${c.seniority}` : ''}`,
            })
            if (!ce) contactsSaved++
          }
        }

        // Tier 3: AI-suggested contacts (LinkedIn search URL + guessed email pattern)
        if (contactsSaved === 0) {
          for (const contact of aiContacts.slice(0, 3)) {
            const linkedinUrl = contact.linkedin_hint
              ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contact.linkedin_hint)}`
              : null
            const twitterUrl = contact.twitter_hint
              ? contact.twitter_hint.startsWith('http')
                ? contact.twitter_hint
                : `https://x.com/search?q=${encodeURIComponent(contact.twitter_hint)}`
              : null
            await supabase.from('contacts').insert({
              lead_id: newLead.id,
              name: contact.name || null,
              role: contact.role,
              company: company.name,
              linkedin_url: linkedinUrl,
              twitter_url: twitterUrl,
              email: contact.email_pattern || null,
              contact_confidence: contact.contact_confidence || 'low',
              reason_this_person: contact.why_this_person,
            })
          }
        }

        // Update in-memory counts
        categories.forEach(cat => {
          if (categoryCounts[cat] !== undefined) categoryCounts[cat]++
        })
        existingNames.add(nameKey)
        if (nameSlugKey) existingNameSlugs.add(nameSlugKey)
        if (domainKey) existingDomains.add(domainKey)

        results.saved++
        results.leads_saved.push(company.name)
      }
    }

    // 7. Update source last_run_at and total leads_generated
    await supabase
      .from('sources')
      .update({
        last_run_at: new Date().toISOString(),
        leads_generated: (source.leads_generated || 0) + results.saved,
      })
      .eq('id', source_id)

    return NextResponse.json({ success: true, ...results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Discovery pipeline failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
