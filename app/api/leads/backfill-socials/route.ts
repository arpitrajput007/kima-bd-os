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

// Domains that are never a company's own official website.
const NON_OFFICIAL_DOMAINS = [
  'twitter.com', 'x.com', 't.me', 'telegram.org', 'discord.gg', 'discord.com',
  'reddit.com', 'youtube.com', 'youtu.be', 'linkedin.com', 'medium.com',
  'github.com', 'facebook.com', 'instagram.com', 'tiktok.com',
  'coingecko.com', 'coinmarketcap.com', 'defillama.com', 'iq.wiki',
  'everipedia.org', 'certik.com', 'rekt.news', 'wikipedia.org',
  'crunchbase.com', 'rootdata.com', 'cryptorank.io', 'messari.io',
  'google.com', 'bing.com', 'binance.com', 'gov.uk',
]

const STOP_TOKENS = new Set([
  'protocol', 'finance', 'network', 'labs', 'lab', 'app', 'io', 'inc',
  'the', 'foundation', 'capital', 'ventures', 'group', 'global', 'dao',
  'defi', 'exchange', 'wallet', 'chain', 'crypto', 'web3', 'company', 'xyz',
])

function meaningfulTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP_TOKENS.has(t))
}

function domainOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function handleMatches(handle: string, tokens: string[]): boolean {
  const flat = handle.toLowerCase().replace(/[_+-]/g, '')
  return tokens.some(t => flat.includes(t) || t.includes(flat))
}

// Strict, per-platform search fallback for SPA sites where the footer can't be
// read. Searches the platform's own domain and accepts a profile ONLY when its
// handle matches the company name (Discord codes are opaque, so the top hit is
// taken as best-effort). Returns a verified social URL or null.
async function searchSocialUrl(
  companyName: string,
  platform: 'twitter' | 'telegram' | 'discord'
): Promise<string | null> {
  if (!process.env.TAVILY_API_KEY) return null
  const domains =
    platform === 'twitter' ? ['twitter.com', 'x.com'] :
    platform === 'telegram' ? ['t.me'] :
    ['discord.gg', 'discord.com']
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${companyName} official ${platform}`,
        include_domains: domains,
        search_depth: 'advanced',
        max_results: 8,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json()
    const urls: string[] = (data.results || []).map((r: { url?: string }) => r.url).filter(Boolean)
    const tokens = meaningfulTokens(companyName)

    for (const url of urls) {
      if (platform === 'twitter') {
        const m = url.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]{1,30})/i)
        if (m && handleMatches(m[1], tokens)) return `https://x.com/${m[1]}`
      } else if (platform === 'telegram') {
        const m = url.match(/t\.me\/([A-Za-z0-9_+]{3,40})/i)
        if (m && m[1].toLowerCase() !== 'share' && handleMatches(m[1], tokens)) return `https://t.me/${m[1]}`
      } else {
        // Discord invite codes are opaque, so a random search hit can't be
        // verified. Only accept a vanity code that matches the company name
        // (e.g. discord.gg/aave). Trusted Discords come from the website read.
        const m = url.match(/(?:discord\.gg|discord\.com\/invite)\/([A-Za-z0-9-]{3,40})/i)
        if (m && handleMatches(m[1], tokens)) return `https://${m[0]}`
      }
    }
    return null
  } catch {
    return null
  }
}

// Find the company's OWN official website via search, so we can read its
// footer for real socials. Only accepts a domain that looks like the company
// (name token in the domain) and is not a social/aggregator site.
async function findOfficialSite(companyName: string): Promise<string | null> {
  if (!process.env.TAVILY_API_KEY) return null
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${companyName} official website`,
        search_depth: 'advanced',
        max_results: 8,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json()
    const results: { url?: string }[] = data.results || []
    const tokens = meaningfulTokens(companyName)
    if (tokens.length === 0) return null

    for (const r of results) {
      if (!r.url) continue
      const domain = domainOf(r.url)
      if (!domain) continue
      if (NON_OFFICIAL_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`))) continue
      // Domain must contain a meaningful token from the company name.
      const flat = domain.replace(/[^a-z0-9]/g, '')
      if (tokens.some(t => flat.includes(t))) return `https://${domain}`
    }
    return null
  } catch {
    return null
  }
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
    updates: [] as { company: string; website?: string; found: Socials }[],
  }

  for (const lead of toFix) {
    // Resolve the company's own website — the only reliable source of socials.
    let website: string | null = lead.website || null
    let discoveredWebsite = false
    if (!website) {
      website = await findOfficialSite(lead.company_name)
      discoveredWebsite = !!website
    }

    // Read the official site and extract socials from its footer/header.
    const found: Socials = website
      ? extractSocials(await readUrl(website), lead.company_name)
      : {}

    // SPA fallback: if the site couldn't be read for a platform, do a strict
    // per-platform, name-matched search so we don't grab the wrong account.
    const needTw = force || !lead.twitter_url
    const needTg = force || !lead.telegram_url
    const needDc = force || !lead.discord_url
    if (needTw && !found.twitter_url) {
      found.twitter_url = (await searchSocialUrl(lead.company_name, 'twitter')) || undefined
    }
    if (needTg && !found.telegram_url) {
      found.telegram_url = (await searchSocialUrl(lead.company_name, 'telegram')) || undefined
    }
    if (needDc && !found.discord_url) {
      found.discord_url = (await searchSocialUrl(lead.company_name, 'discord')) || undefined
    }

    // Only write fields we actually found (don't wipe existing values).
    const update: Socials & { website?: string } = {}
    if (found.twitter_url && (force || !lead.twitter_url)) update.twitter_url = found.twitter_url
    if (found.telegram_url && (force || !lead.telegram_url)) update.telegram_url = found.telegram_url
    if (found.discord_url && (force || !lead.discord_url)) update.discord_url = found.discord_url
    if (discoveredWebsite && website) update.website = website

    if (Object.keys(update).length > 0) {
      const { error: upErr } = await supabase
        .from('leads')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', lead.id)
      if (!upErr) {
        results.updated++
        results.updates.push({
          company: lead.company_name,
          website: discoveredWebsite && website ? website : undefined,
          found: update,
        })
        continue
      }
    }
    results.unchanged++
  }

  return NextResponse.json({ success: true, ...results })
}
