// ============================================================
// Reaction Content Studio — source configs + data fetchers
// Three tiers: Exa news search, DeFiLlama REST, RSS feeds
// All fetchers fail-soft so a broken source never blocks the rest.
// ============================================================

export interface ReactionNewsItem {
  topic: string
  title: string
  url: string
  source: string
  summary: string
  published_at: string | null
}

// ── Exa topic queries ─────────────────────────────────────────────────────────
export const EXA_TOPIC_QUERIES: Array<{ topic: string; query: string }> = [
  { topic: 'AI Agents',         query: 'AI agents autonomous agents news 2025' },
  { topic: 'Agentic AI',        query: 'agentic AI products developments 2025' },
  { topic: 'AI Payments',       query: 'AI payments autonomous payments infrastructure 2025' },
  { topic: 'AI Commerce',       query: 'AI commerce autonomous shopping agents 2025' },
  { topic: 'Stablecoins',       query: 'stablecoin news regulation launch 2025' },
  { topic: 'Cross-chain',       query: 'cross-chain infrastructure LayerZero Wormhole Axelar CCIP news' },
  { topic: 'DeFi',              query: 'DeFi protocol infrastructure news 2025' },
  { topic: 'Payments',          query: 'fintech embedded finance payments news 2025' },
  { topic: 'Treasury',          query: 'treasury automation crypto blockchain enterprise 2025' },
  { topic: 'Security',          query: 'crypto hack exploit vulnerability DeFi 2025' },
  { topic: 'Fundraising',       query: 'crypto AI startup funding round investment 2025' },
  { topic: 'Regulations',       query: 'crypto AI regulation SEC CFTC MiCA policy 2025' },
  { topic: 'Developer Tooling', query: 'crypto developer tooling SDK infrastructure launch 2025' },
  { topic: 'Product Launches',  query: 'crypto AI product launch announcement 2025' },
  { topic: 'Enterprise',        query: 'enterprise blockchain adoption institutional crypto 2025' },
]

// ── RSS feeds ─────────────────────────────────────────────────────────────────
const RSS_FEEDS: Array<{ url: string; topic: string; source: string }> = [
  { url: 'https://thedefiant.io/api/feed',                                             topic: 'DeFi',         source: 'The Defiant'    },
  { url: 'https://www.bankless.com/rss/feed',                                          topic: 'DeFi',         source: 'Bankless'       },
  { url: 'https://hub.rekt.news/rss',                                                  topic: 'Security',     source: 'Rekt News'      },
  { url: 'https://blockworks.co/feed',                                                 topic: 'Crypto',       source: 'Blockworks'     },
  { url: 'https://www.theblock.co/rss.xml',                                            topic: 'Crypto',       source: 'The Block'      },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',                            topic: 'Crypto',       source: 'CoinDesk'       },
  { url: 'https://www.paymentsdive.com/feeds/news/',                                   topic: 'Payments',     source: 'Payments Dive'  },
  { url: 'https://governance.aave.com/posts.rss',                                      topic: 'DeFi',         source: 'Aave Governance'},
  { url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&owner=include&count=10&output=atom', topic: 'Regulations', source: 'SEC.gov' },
  { url: 'https://blog.lido.fi/rss/',                                                  topic: 'DeFi',         source: 'Lido Blog'      },
  { url: 'https://news.curve.finance/rss',                                             topic: 'DeFi',         source: 'Curve News'     },
]

// Extract text between XML tags, handles CDATA and entities.
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return ''
  return m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

// Atom feeds use <link href="..."/> instead of <link>text</link>
function extractAtomLink(itemXml: string): string {
  const rel = itemXml.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i)
  if (rel) return rel[1]
  const href = itemXml.match(/<link[^>]+href="([^"]+)"/i)
  if (href) return href[1]
  const text = extractTag(itemXml, 'link')
  return text
}

function parseIsoDate(str: string): string | null {
  if (!str) return null
  try { return new Date(str).toISOString() } catch { return null }
}

// Parse RSS 2.0 or Atom feed XML into ReactionNewsItem[].
function parseFeed(xml: string, topic: string, source: string): ReactionNewsItem[] {
  const isAtom = /<feed[^>]*xmlns/i.test(xml)
  const itemTag = isAtom ? 'entry' : 'item'
  const itemRe = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\\/${itemTag}>`, 'gi')
  const blocks = xml.match(itemRe) || []

  return blocks.slice(0, 6).map(block => {
    const title   = extractTag(block, 'title')
    const url     = isAtom ? extractAtomLink(block) : (extractTag(block, 'link') || extractTag(block, 'guid'))
    const summary = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content')
    const pubRaw  = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated')
    return {
      topic,
      title: title.slice(0, 300),
      url:   url.trim(),
      source,
      summary: summary.slice(0, 400),
      published_at: parseIsoDate(pubRaw),
    }
  }).filter(i => i.title && i.url)
}

// Fetch a single RSS/Atom feed. Fails soft.
async function fetchRssFeed(feedUrl: string, topic: string, source: string): Promise<ReactionNewsItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KimaBDBot/1.0)' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return []
    const text = await res.text()
    return parseFeed(text, topic, source)
  } catch {
    return []
  }
}

// Fetch all RSS feeds in parallel. Deduped by URL inside each feed only
// (cross-feed dedup happens in the API route using the DB).
export async function fetchAllRssItems(): Promise<ReactionNewsItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(f => fetchRssFeed(f.url, f.topic, f.source))
  )
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

// ── DeFiLlama REST endpoints (free, no auth) ──────────────────────────────────
interface LlamaHack {
  date: number
  name?: string
  displayName?: string
  amount?: number
  chain?: string
  chains?: string[]
  classification?: string
  technique?: string
}
interface LlamaRaise {
  date: number
  name?: string
  displayName?: string
  amount?: number
  round?: string
  leadInvestors?: string[]
  otherInvestors?: string[]
  chains?: string[]
}

export async function fetchDeFiLlamaHacks(daysBack = 14): Promise<ReactionNewsItem[]> {
  try {
    const res = await fetch('https://api.llama.fi/hacks', { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const json = await res.json() as { protocols?: LlamaHack[] } | LlamaHack[]
    const hacks: LlamaHack[] = Array.isArray(json) ? json : (json.protocols || [])
    const cutoff = Date.now() / 1000 - daysBack * 86400

    return hacks
      .filter(h => h.date > cutoff && (h.name || h.displayName))
      .map(h => {
        const name = h.displayName || h.name || 'Unknown Protocol'
        const amount = h.amount ? `$${(h.amount / 1e6).toFixed(1)}M` : 'unknown amount'
        const chain = (h.chains && h.chains.length > 0) ? h.chains[0] : (h.chain || '')
        const technique = h.technique || h.classification || 'exploit'
        return {
          topic: 'Security',
          title: `${name} hacked — ${amount} lost via ${technique}`,
          url: `https://defillama.com/hacks`,
          source: 'DeFiLlama Hacks',
          summary: `${name} suffered a ${technique} attack on ${chain ? chain + ' ' : ''}with ${amount} in losses. Classification: ${h.classification || 'unknown'}.`,
          published_at: new Date(h.date * 1000).toISOString(),
        }
      })
  } catch {
    return []
  }
}

export async function fetchDeFiLlamaRaises(daysBack = 14): Promise<ReactionNewsItem[]> {
  try {
    const res = await fetch('https://api.llama.fi/raises', { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const json = await res.json() as { raises?: LlamaRaise[] }
    const raises: LlamaRaise[] = json.raises || []
    const cutoff = Date.now() / 1000 - daysBack * 86400

    return raises
      .filter(r => r.date > cutoff && (r.name || r.displayName))
      .map(r => {
        const name = r.displayName || r.name || 'Unknown'
        const amount = r.amount ? `$${(r.amount / 1e6).toFixed(0)}M` : 'undisclosed amount'
        const round = r.round || 'funding round'
        const leads = (r.leadInvestors || []).slice(0, 2).join(', ')
        return {
          topic: 'Fundraising',
          title: `${name} raises ${amount} ${round}${leads ? ` led by ${leads}` : ''}`,
          url: `https://defillama.com/raises`,
          source: 'DeFiLlama Raises',
          summary: `${name} secured ${amount} in a ${round}${leads ? `, led by ${leads}` : ''}. Chains: ${(r.chains || []).join(', ') || 'unspecified'}.`,
          published_at: new Date(r.date * 1000).toISOString(),
        }
      })
  } catch {
    return []
  }
}
