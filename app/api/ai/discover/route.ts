import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  'LayerZero Customer',
  'Hacked Protocol',
  'Needs On/Off Ramp',
  'Fireblocks Customer',
  'Web2 Stablecoin Settlement Customer',
]
const CATEGORY_CAP = 3

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
): Promise<Array<{ name: string; website: string; description: string }>> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a BD researcher for Kima (cross-chain settlement infra) and Aeredium (TEE blockchain infra).
Extract companies from web content that could be B2B customers for payment/settlement infrastructure.
Focus on: DeFi protocols, wallets, exchanges, payment companies, fintechs, neobanks, cross-border payment companies, stablecoin issuers, RWA platforms.
Return ONLY valid JSON. No markdown.`,
        },
        {
          role: 'user',
          content: `Source: ${sourceContext}

Content:
${content}

Extract up to 15 companies mentioned. Return JSON:
{
  "companies": [
    {
      "name": "Company name",
      "website": "https://... or empty string if unknown",
      "description": "1-2 sentence description of what they do"
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

// Full deep-dive research on a single company
async function deepResearch(company: {
  name: string
  website: string
  description: string
}): Promise<Record<string, unknown> | null> {
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

KIMA: Universal settlement layer. Moves value across crypto and TradFi without bridges, wrapped assets, or smart contracts.
Use cases: cross-chain deposits, fiat-to-crypto onboarding, stablecoin payments, cross-border settlement, treasury rebalancing, RWA delivery-versus-payment. Single API, free and instant.

AEREDIUM: TEE-attested blockchain infra. MEV resistance, execution accountability, compliance-ready. Institutional-grade settlement.

TARGET CUSTOMER CATEGORIES:
1. LayerZero Customer — using LayerZero or similar cross-chain messaging
2. Hacked Protocol — affected by bridge/smart contract/oracle exploits
3. Needs On/Off Ramp — needing fiat<->crypto conversion
4. Fireblocks Customer — using Fireblocks or similar custody infra
5. Web2 Stablecoin Settlement Customer — traditional companies needing stablecoin rails

SCORING (0-100):
High score (70+): clear pain point, active product, matches a target category, decision maker findable
Medium (40-69): possible fit but unclear pain point or no direct match
Low (<40): no clear use case for Kima/Aeredium

Return ONLY valid JSON. No markdown.`,
        },
        {
          role: 'user',
          content: `Do a full BD research on this company for Kima/Aeredium:

Company: ${company.name}
Website: ${company.website || 'unknown'}
Description: ${company.description}${hunterContext}

Return this exact JSON:
{
  "industry_category": "one industry category",
  "customer_category": ["array — pick from: LayerZero Customer, Hacked Protocol, Needs On/Off Ramp, Fireblocks Customer, Web2 Stablecoin Settlement Customer, Other"],
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

    // 4. Get content via URL or Search
    const sourceQuery = source.source_url_or_query.trim()
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

    // 5. Extract company list from the page
    const companies = await extractCompanies(
      content,
      `${source.source_name} (${source.source_type})`
    )

    const results = {
      found: companies.length,
      saved: 0,
      skipped_duplicate: 0,
      skipped_cap: 0,
      skipped_low_score: 0,
      leads_saved: [] as string[],
    }

    // 6. Deep-research each company and save qualified ones
    for (const company of companies) {
      const nameKey = (company.name || '').toLowerCase().trim()
      const websiteKey = (company.website || '').toLowerCase().trim()

      // Skip duplicates
      if (existingNames.has(nameKey)) { results.skipped_duplicate++; continue }
      if (websiteKey && existingWebsites.has(websiteKey)) { results.skipped_duplicate++; continue }

      // Full research
      const research = await deepResearch(company)
      if (!research) continue

      // Skip low-quality leads
      if ((research.lead_score as number) < 50) { results.skipped_low_score++; continue }

      // Determine relevant customer categories
      const categories = ((research.customer_category as string[]) || [])
        .filter(c => CUSTOMER_CATEGORIES.includes(c))
      if (categories.length === 0) categories.push('Other')

      // Check if any matching category has room (cap = 3)
      const hasRoom = categories.some(cat => (categoryCounts[cat] || 0) < CATEGORY_CAP)
      if (!hasRoom) { results.skipped_cap++; continue }

      // Insert lead
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          company_name: company.name,
          website: company.website || null,
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
          source_url: source.source_url_or_query,
          status: 'new',
        })
        .select('id')
        .single()

      if (!leadErr && newLead) {
        // Save contacts
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
