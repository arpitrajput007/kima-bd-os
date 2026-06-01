import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN, PRODUCT_BRAIN_COMPACT } from '@/lib/kima-knowledge'
import { pickBestUrl, extractSocials, type Socials } from '@/lib/utils'
import { apolloConfigured, apolloEnrichContacts, apolloSearchCompanies, toDomain } from '@/lib/apollo'
import { isGenericName } from '@/lib/leadQuality'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CUSTOMER_CATEGORIES = [
  'Agentic Payments Customer',
  'LayerZero Customer',
  'Hacked Protocol',
  'Needs On/Off Ramp',
  'Fireblocks Customer',
  'Web2 Stablecoin Settlement Customer',
]
const CATEGORY_CAP = 5

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
  sourceContext: string
): Promise<Array<{ name: string; website: string; description: string; source_url: string }>> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a BD researcher for Kima and Aeredium.

${PRODUCT_BRAIN_COMPACT}

Output REAL, SPECIFIC, NAMED companies that could be B2B customers for payment/settlement infrastructure — never categories.

CRITICAL — every "name" MUST be a single real company you could google and land on one company's website:
- GOOD (real companies): "Bybit", "Coinbase", "Binance", "Circle", "MetaMask", "Fireblocks", "JPMorgan", "Revolut", "Stripe", "Ripple".
- BANNED (categories / segments / groupings — NEVER output these as a name): "Crypto Exchanges", "Banks", "Exchanges", "Stablecoin Issuers", "Lending Platforms", "Custody", "Wallets", "DEXs", "Payment Companies", "RWA Platforms", "Neobanks", "Bridges", "Cross-border Payment Providers", "Fintechs".

EXPAND CATEGORIES INTO REAL COMPANIES (very important):
- If the content (or the source/search topic) points at a CATEGORY like "crypto exchanges" or "banks", DO NOT return the category. Instead, name the specific, real, well-known companies in that segment that best fit Kima/Aeredium's ICP.
  · "crypto exchanges" → Binance, Bybit, OKX, Kraken, Bitget, KuCoin, Coinbase
  · "banks" → JPMorgan, Standard Chartered, DBS Bank, BBVA, Santander, HSBC
  · "wallets" → MetaMask, Trust Wallet, Phantom, Rabby
  · "stablecoin issuers" → Circle, Tether, Paxos, Ethena
- Only name companies that genuinely exist. Each must be a real brand with a findable website.

Quality bar: it is far better to return 5 real, correctly-named companies than 15 vague ones. If you truly cannot name any real company, return an empty list — but prefer naming the real market leaders/best-fit players in the relevant segment.

Return ONLY valid JSON. No markdown.`,
        },
        {
          role: 'user',
          content: `Source: ${sourceContext}

Content:
${content}

Return up to 15 SPECIFIC, REAL, NAMED companies. If the source points at a category, expand it into the actual best-fit named companies (see rules above). Never output a category/segment as a name. Return JSON:
{
  "companies": [
    {
      "name": "The specific company's real brand name (a proper noun like 'Bybit' or 'JPMorgan', NEVER a category like 'Crypto Exchanges')",
      "website": "https://<the company's real domain> — required; give your best real guess (e.g. https://www.bybit.com) rather than leaving blank",
      "description": "1-2 sentence description of what this specific company actually does",
      "source_url": "the EXACT link from the content that is specifically about THIS company, copied verbatim. Empty string if none."
    }
  ]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000,
    })
    const result = JSON.parse(completion.choices[0].message.content || '{"companies":[]}')
    return Array.isArray(result.companies) ? result.companies : []
  } catch (e) {
    console.error('[extractCompanies]', e)
    return []
  }
}

// Fetch all active agent_knowledge for injection into prompts
async function getLearnedIntelligence(): Promise<string> {
  try {
    const { data } = await supabase
      .from('agent_knowledge')
      .select('title, content, knowledge_type, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30)
    if (!data || data.length === 0) return ''
    const lines = data.map(
      (k: { title: string; content: string; knowledge_type: string; created_at: string }) =>
        `[${new Date(k.created_at).toISOString().split('T')[0]}][${k.knowledge_type}] ${k.title}:\n${k.content}`
    )
    return `\n\nLEARNED INTELLIGENCE (from your training sessions — use this to score and analyze leads more precisely):\n${lines.join('\n\n---\n')}`
  } catch {
    return ''
  }
}

// Full deep-dive research on a single company
async function deepResearch(
  company: {
  name: string
  website: string
  description: string
},
  learnedIntelligence?: string
): Promise<Record<string, unknown> | null> {
  const domain = (company.website || '')
    .replace(/https?:\/\//, '')
    .replace(/\/.*/, '')
    .trim()

  try {
    const hunterData = await getHunterContacts(company.website)
    const hunterContext = hunterData ? `\nVerified emails from Hunter.io database:\n${hunterData}\nSelect the most relevant BD contacts from this list if any, otherwise guess patterns.` : ''

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior BD researcher for Kima and Aeredium.

${PRODUCT_BRAIN}

FIRST, validate the input is a REAL, SPECIFIC company (a brand you can google to one company's site like "Bybit", "JPMorgan", "Circle") and NOT a generic category/segment ("Crypto Exchanges", "Banks", "Fintechs", "Infrastructure", "AI", "RWA Platforms", "Analytics Platforms", "Payments", "Wallets"). If it is a category and not a real single company, set "is_specific_real_company": false and you may leave other fields minimal.

SCORING (0-100):
High score (70+): clear pain point, active product, matches a target category, decision maker findable
Medium (40-69): possible fit but unclear pain point or no direct match
Low (<40): no clear use case for Kima/Aeredium

Return ONLY valid JSON. No markdown.${learnedIntelligence || ''}`,
        },
        {
          role: 'user',
          content: `Do a full BD research on this company for Kima/Aeredium:

Company: ${company.name}
Website: ${company.website || 'unknown'}
Description: ${company.description}${hunterContext}

Return this exact JSON:
{
  "is_specific_real_company": true,
  "industry_category": "one industry category",
  "customer_category": ["array — pick from: Agentic Payments Customer, LayerZero Customer, Hacked Protocol, Needs On/Off Ramp, Fireblocks Customer, Web2 Stablecoin Settlement Customer, Other"],
  "product_to_sell": "best Kima product pitch for this company",
  "region": "their primary market region",
  "company_summary": "2-3 sentence summary of what they do",
  "business_model": "how they make money",
  "supported_chains_or_rails": "blockchains or payment rails they use",
  "current_providers": "known payment/bridge/settlement providers they currently use",
  "pain_point": "single most important pain point Kima solves for them",
  "pain_point_severity": "critical|high|medium|low",
  "pain_point_evidence": "evidence or reasoning for this pain point",
  "kima_fit": "exactly how Kima helps this company",
  "suggested_use_case": "specific Kima use case to pitch",
  "aeredium_fit": "how Aeredium strengthens the pitch",
  "trigger_reason": "why is NOW a good time to reach out? funding, expansion, hack, etc.",
  "source_url": "the exact, specific URL (news article, funding announcement, blog post, tweet) that best evidences the trigger_reason — must be a full link to a specific page, NOT a homepage. Use null if you don't have a specific real URL.",
  "settlement_angle": "how Kima improves their settlement",
  "integration_feasibility": "high|medium|low",
  "revenue_potential": "estimated business impact for them",
  "lead_score": 0,
  "priority": "excellent|qualified|needs_research|low_priority",
  "score_reasoning": "why this exact score",
  "contacts": [
    {
      "role": "ideal title to contact (e.g. Head of Partnerships, CTO, CEO)",
      "name": "real name if publicly known, or null",
      "linkedin_hint": "search query to find them on LinkedIn (e.g. John Smith Acme DeFi Head of BD)",
      "twitter_hint": "their Twitter/X handle or a search term to find them",
      "email_pattern": "firstname@${domain || 'company.com'}",
      "why_this_person": "why this is the right person to contact",
      "contact_confidence": "high|medium|low"
    }
  ]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 3000,
    })
    return JSON.parse(completion.choices[0].message.content || '{}')
  } catch (e) {
    console.error('[deepResearch]', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { source_id } = await req.json()
    if (!source_id) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
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

    // 2. Check current category counts (only non-rejected, non-archived leads)
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('customer_category')
      .not('status', 'in', '("rejected","archived")')

    const categoryCounts: Record<string, number> = {}
    CUSTOMER_CATEGORIES.forEach(c => { categoryCounts[c] = 0 })
    ;(existingLeads || []).forEach((lead: { customer_category?: string[] }) => {
      const cats = lead.customer_category || []
      cats.forEach((cat: string) => {
        if (categoryCounts[cat] !== undefined) categoryCounts[cat]++
      })
    })

    // 3. Get existing company names/websites to avoid duplicates
    const { data: existingCompanies } = await supabase
      .from('leads')
      .select('company_name, website')

    const existingNames = new Set(
      (existingCompanies || []).map((l: { company_name?: string }) =>
        (l.company_name || '').toLowerCase().trim()
      )
    )
    const existingWebsites = new Set(
      (existingCompanies || [])
        .map((l: { website?: string }) => (l.website || '').toLowerCase().trim())
        .filter(Boolean)
    )

    // 4. Get the company list — either straight from Apollo, or by crawling a URL/search.
    const sourceQuery = source.source_url_or_query.trim()
    const isApolloSource = source.source_type === 'apollo_search' || /^apollo:/i.test(sourceQuery)
    let companies: Array<{ name: string; website: string; description: string; source_url: string }> = []

    if (isApolloSource) {
      if (!apolloConfigured()) {
        return NextResponse.json({ error: 'Apollo API key not configured. Add APOLLO_API_KEY to your environment.' }, { status: 400 })
      }
      const q = sourceQuery.replace(/^apollo:/i, '').trim()
      companies = await apolloSearchCompanies(q, 20)
      if (!companies.length) {
        return NextResponse.json({ error: 'Apollo returned no companies for that query — try different keywords.' }, { status: 400 })
      }
    } else {
      let content = ''
      if (sourceQuery.startsWith('http://') || sourceQuery.startsWith('https://')) {
        content = await readUrl(sourceQuery)
      } else {
        if (!process.env.TAVILY_API_KEY) {
          return NextResponse.json({ error: 'Tavily API key required for search queries. Add it to .env.local' }, { status: 400 })
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
      companies = await extractCompanies(content, `${source.source_name} (${source.source_type})`)
    }

    // 5b. Load learned intelligence to inject into all deepResearch calls
    const learnedIntelligence = await getLearnedIntelligence()

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
      const websiteKey = (company.website || '').toLowerCase().trim()

      // Skip duplicates
      if (existingNames.has(nameKey)) { results.skipped_duplicate++; continue }
      if (websiteKey && existingWebsites.has(websiteKey)) { results.skipped_duplicate++; continue }

      // Full research — inject learned intelligence
      const research = await deepResearch(company, learnedIntelligence)
      if (!research) continue

      // Hard gate: the model itself confirms this is a real company, not a category.
      if (research.is_specific_real_company === false) { results.skipped_generic++; continue }

      // Skip low-quality leads
      if ((research.lead_score as number) < 50) { results.skipped_low_score++; continue }

      // Determine relevant customer categories
      const categories = ((research.customer_category as string[]) || [])
        .filter(c => CUSTOMER_CATEGORIES.includes(c))
      if (categories.length === 0) categories.push('Other')

      // Check if any matching category has room (cap = 3)
      const hasRoom = categories.some(cat => (categoryCounts[cat] || 0) < CATEGORY_CAP)
      if (!hasRoom) { results.skipped_cap++; continue }

      // Resolve website — required before saving. If the extractor didn't find it,
      // do a quick search to look it up. Skip the lead if we still can't find one.
      let website = company.website?.trim() || (research.website as string | undefined)?.trim() || ''
      if (!website) {
        website = await resolveWebsite(company.name)
      }
      if (!website) { results.skipped_low_score++; continue } // no website = can't reach out

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
        // Verify the AI's named contacts against Apollo to attach REAL titles,
        // LinkedIn and verified work emails (no personal-email reveal → credit-safe).
        const domain = toDomain(website)
        const aiContacts = (research.contacts as Record<string, string>[]) || []
        const apolloContacts = domain
          ? await apolloEnrichContacts(domain, company.name, aiContacts.map(c => ({ name: c.name, role: c.role })))
          : []

        if (apolloContacts.length > 0) {
          for (const c of apolloContacts.slice(0, 3)) {
            await supabase.from('contacts').insert({
              lead_id: newLead.id,
              name: c.name,
              role: c.title || 'Decision maker',
              company: company.name,
              linkedin_url: c.linkedin_url,
              email: c.email,
              contact_confidence: c.email ? 'high' : 'medium',
              reason_this_person: `Verified via Apollo${c.seniority ? ` · ${c.seniority}` : ''}${c.title ? ` · ${c.title}` : ''}`,
            })
          }
        } else {
          // Fallback: AI-suggested contacts (guessed patterns).
          const contacts = (research.contacts as Record<string, string>[]) || []
          for (const contact of contacts.slice(0, 3)) {
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
              linkedin_url: linkedinUrl,
              twitter_url: twitterUrl,
              email: contact.email_pattern || null,
              contact_confidence: contact.contact_confidence,
              reason_this_person: contact.why_this_person,
            })
          }
        }

        // Update in-memory counts
        categories.forEach(cat => {
          if (categoryCounts[cat] !== undefined) categoryCounts[cat]++
        })
        existingNames.add(nameKey)
        if (websiteKey) existingWebsites.add(websiteKey)

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
