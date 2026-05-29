import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function domainOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function hasPath(url: string): boolean {
  try {
    return new URL(url.trim()).pathname.replace(/\/+$/, '').length > 0
  } catch {
    return false
  }
}

const STOP_TOKENS = new Set([
  'protocol', 'finance', 'network', 'labs', 'lab', 'app', 'io', 'inc',
  'the', 'foundation', 'capital', 'ventures', 'group', 'global', 'dao',
  'defi', 'exchange', 'wallet', 'chain', 'crypto', 'web3', 'company',
])

function meaningfulTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP_TOKENS.has(t))
}

// Find the exact article URL on the same domain that is about this company.
async function findExactSource(companyName: string, domain: string): Promise<string | null> {
  if (!process.env.TAVILY_API_KEY) return null
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: companyName,
        include_domains: [domain],
        search_depth: 'advanced',
        max_results: 8,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json()
    const results: { url: string; title?: string }[] = data.results || []

    // Keep only specific pages on the target domain (not the homepage).
    const candidates = results
      .map(r => r.url)
      .filter(u => typeof u === 'string' && domainOf(u) === domain && hasPath(u))

    if (candidates.length === 0) return null

    const tokens = meaningfulTokens(companyName)
    // Keep URLs whose slug contains a meaningful token from the company name.
    const matched = candidates.filter(u => {
      const slug = u.toLowerCase()
      return tokens.some(t => slug.includes(t))
    })

    const pool = matched.length > 0 ? matched : candidates
    // Prefer canonical (non-localized) URLs: skip ones with a /xx/ or /xx-XX/
    // language segment right after the domain (e.g. /zh/, /es/).
    const isLocalized = (u: string) => {
      try {
        return /^\/[a-z]{2}(-[a-z]{2})?\//i.test(new URL(u).pathname)
      } catch {
        return false
      }
    }
    const canonical = pool.filter(u => !isLocalized(u))
    return (canonical[0] || pool[0]) ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.TAVILY_API_KEY) {
    return NextResponse.json({ error: 'TAVILY_API_KEY required for source backfill.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const leadId: string | undefined = body.lead_id
  const force: boolean = body.force === true

  // Load candidate leads
  let query = supabase.from('leads').select('id, company_name, source_url')
  if (leadId) query = query.eq('id', leadId)
  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only fix leads that have a domain we can scope to and that currently
  // point at a bare domain (unless force re-resolves everything).
  const toFix = (leads || []).filter(l => {
    if (!l.source_url) return false
    const d = domainOf(l.source_url)
    if (!d) return false
    return force || !hasPath(l.source_url)
  })

  const results = {
    scanned: leads?.length || 0,
    candidates: toFix.length,
    updated: 0,
    not_found: 0,
    updates: [] as { company: string; from: string; to: string }[],
  }

  for (const lead of toFix) {
    const domain = domainOf(lead.source_url)!
    const exact = await findExactSource(lead.company_name, domain)
    if (exact && exact !== lead.source_url) {
      const { error: upErr } = await supabase
        .from('leads')
        .update({ source_url: exact, updated_at: new Date().toISOString() })
        .eq('id', lead.id)
      if (!upErr) {
        results.updated++
        results.updates.push({ company: lead.company_name, from: lead.source_url, to: exact })
        continue
      }
    }
    results.not_found++
  }

  return NextResponse.json({ success: true, ...results })
}
