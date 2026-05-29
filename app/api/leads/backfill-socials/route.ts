import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractSocials, type Socials } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Read a URL as text via Jina (free, no key).
async function readUrl(url: string): Promise<string> {
  try {
    const full = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch(`https://r.jina.ai/${full}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

// Fallback: search the web for the company's official channels.
async function searchSocials(companyName: string): Promise<string> {
  if (!process.env.TAVILY_API_KEY) return ''
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${companyName} official website twitter telegram discord`,
        search_depth: 'advanced',
        include_raw_content: true,
        max_results: 5,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json()
    const results: { url?: string; content?: string; raw_content?: string }[] = data.results || []
    return results.map(r => `${r.url || ''}\n${r.raw_content || r.content || ''}`).join('\n\n')
  } catch {
    return ''
  }
}

function hasAllSocials(s: Socials): boolean {
  return !!(s.twitter_url && s.telegram_url && s.discord_url)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const leadId: string | undefined = body.lead_id
  const force: boolean = body.force === true

  let query = supabase
    .from('leads')
    .select('id, company_name, website, twitter_url, telegram_url, discord_url')
  if (leadId) query = query.eq('id', leadId)
  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Process leads missing at least one social (unless force re-resolves all).
  const toFix = (leads || []).filter(l =>
    force || !l.twitter_url || !l.telegram_url || !l.discord_url
  )

  const results = {
    scanned: leads?.length || 0,
    candidates: toFix.length,
    updated: 0,
    unchanged: 0,
    updates: [] as { company: string; found: Socials }[],
  }

  for (const lead of toFix) {
    // 1) Try the company website (most reliable — footer links).
    let found: Socials = lead.website ? extractSocials(await readUrl(lead.website)) : {}

    // 2) Fall back to web search if anything is still missing.
    if (!hasAllSocials(found)) {
      const searchText = await searchSocials(lead.company_name)
      if (searchText) {
        const fromSearch = extractSocials(searchText)
        found = {
          twitter_url: found.twitter_url || fromSearch.twitter_url,
          telegram_url: found.telegram_url || fromSearch.telegram_url,
          discord_url: found.discord_url || fromSearch.discord_url,
        }
      }
    }

    // Only write fields we actually found (don't wipe existing values).
    const update: Socials = {}
    if (found.twitter_url && (force || !lead.twitter_url)) update.twitter_url = found.twitter_url
    if (found.telegram_url && (force || !lead.telegram_url)) update.telegram_url = found.telegram_url
    if (found.discord_url && (force || !lead.discord_url)) update.discord_url = found.discord_url

    if (Object.keys(update).length > 0) {
      const { error: upErr } = await supabase
        .from('leads')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', lead.id)
      if (!upErr) {
        results.updated++
        results.updates.push({ company: lead.company_name, found: update })
        continue
      }
    }
    results.unchanged++
  }

  return NextResponse.json({ success: true, ...results })
}
