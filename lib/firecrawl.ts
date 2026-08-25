// ============================================================
// Firecrawl client — deep page reading for sources whose real
// content is paginated, behind a "Load More" button, or loaded
// via infinite scroll. readUrl() (Jina Reader, see webRead.ts)
// only ever sees whatever renders on first load — no interaction.
// This is the opt-in, heavier alternative for those specific
// sources (see sources.deep_crawl). Fails soft, like lib/exa.ts.
// Docs: https://docs.firecrawl.dev/api-reference/endpoint/scrape
// ============================================================

export function firecrawlConfigured(): boolean {
  return !!process.env.FIRECRAWL_API_KEY
}

interface FirecrawlAction {
  type: 'scroll' | 'click' | 'wait'
  direction?: 'down'
  selector?: string
  milliseconds?: number
}

// Hard cap on scroll/click cycles — each cycle costs Firecrawl "Interact"
// credits (2 per browser-minute) and adds latency; this is a per-source
// opt-in specifically because it's more expensive than a plain scrape, so
// keep it bounded regardless of what a source's own config requests.
const MAX_ACTION_CYCLES = 15

// Scrolls to the bottom (triggers infinite-scroll loads generically, no
// selector needed) and optionally clicks a "Load More" button between
// scrolls, repeated `maxActions` times, then returns the page's full
// rendered markdown after all of that has run. One synchronous HTTP call —
// deliberately NOT using Firecrawl's /crawl endpoint, which is async/
// job-based and would reintroduce the same timeout risk already fixed
// elsewhere in this pipeline (see the discover-route parallelization).
export async function firecrawlDeepScrape(
  url: string,
  opts: { maxActions?: number; buttonSelector?: string } = {},
): Promise<string> {
  if (!firecrawlConfigured()) return ''
  const cycles = Math.min(Math.max(opts.maxActions ?? 5, 1), MAX_ACTION_CYCLES)

  const actions: FirecrawlAction[] = []
  for (let i = 0; i < cycles; i++) {
    actions.push({ type: 'scroll', direction: 'down' })
    actions.push({ type: 'wait', milliseconds: 1200 })
    if (opts.buttonSelector) {
      actions.push({ type: 'click', selector: opts.buttonSelector })
      actions.push({ type: 'wait', milliseconds: 1200 })
    }
  }

  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: false, // we want everything that loaded, not just the article body
        actions,
        timeout: 90000,
      }),
      signal: AbortSignal.timeout(100000),
    })
    if (!res.ok) {
      console.error('[firecrawlDeepScrape] HTTP', res.status, await res.text().catch(() => ''))
      return ''
    }
    const json = await res.json()
    return (json?.data?.markdown as string | undefined) || ''
  } catch (e) {
    console.error('[firecrawlDeepScrape]', e)
    return ''
  }
}

// ============================================================
// Authority-evidence page finder — for the AERSeal pipeline's
// "structural evidence" requirement (see lib/aerseal-discovery.ts,
// evaluateGate). A company's own homepage almost never states who
// controls its ProxyAdmin or mint role; that lives on a docs,
// security, governance, or audit subpage the discovery pipeline
// never sees today (deepResearch/profileAuthority only crawl the
// homepage via readUrl()). Firecrawl's /map endpoint ranks a
// domain's own pages by relevance to a query without guessing URL
// paths, so this finds the right subpage instead of settling for
// whatever the homepage happens to mention.
// Docs: https://docs.firecrawl.dev/api-reference/endpoint/map
// ============================================================

// Re-ranking, applied on top of Firecrawl's own /map relevance ranking.
// /map's `search` param is a broad relevance query and still ranks
// marketing/blog pages ahead of actual documentation for a query this
// general — a live check against safe.global initially returned a "MPC
// vs multisig" blog post as the top hit over both /security and the docs
// site, because the blog title happened to contain more of the raw
// keywords. Scoring by URL PATH SEGMENT (not keyword-anywhere) and
// penalizing content-marketing paths fixes that: verified against
// safe.global (docs.safe.global/advanced/smart-account-overview and
// /security beat every blog post), aave.com (surfaces live
// governance.aave.com guardian-renewal and risk-steward threads — exactly
// the dated control-model evidence AERSeal needs), and circle.com
// (developers.circle.com .../console-roles-permissions beats the
// pressroom).
const STRUCTURAL_PATH_SEGMENTS = [
  'security', 'governance', 'admin', 'roles', 'role', 'docs', 'documentation',
  'audit', 'audits', 'risk', 'permissions', 'permission', 'access-control',
  'multisig', 'timelock', 'guardian', 'council', 'contracts', 'smart-account',
  'smart-accounts', 'owner', 'ownership',
]
// Content-marketing paths outrank documentation on raw keyword count often
// enough (a blog post *about* multisig security is not the same as the
// security page) that they need an explicit penalty rather than just losing
// on tie-break.
const CONTENT_MARKETING_SEGMENTS = ['blog', 'news', 'press', 'pressroom', 'events', 'careers', 'jobs', 'case-studies']

export interface AuthorityEvidencePage {
  url: string
  text: string
}

function rankAuthorityLink(
  link: { url: string },
  baseHost: string,
): number {
  let u: URL
  try {
    u = new URL(link.url)
  } catch {
    return -Infinity
  }
  if (u.hostname === baseHost && (u.pathname === '/' || u.pathname === '')) return -Infinity // homepage — already crawled separately
  const segments = u.pathname.toLowerCase().split('/').filter(Boolean)
  const structuralHits = segments.filter(seg => STRUCTURAL_PATH_SEGMENTS.some(k => seg.includes(k))).length
  if (structuralHits === 0) return -Infinity
  const penalty = segments.some(seg => CONTENT_MARKETING_SEGMENTS.includes(seg)) ? -6 : 0
  const docsSubdomain = u.hostname.startsWith('docs.') || u.hostname.startsWith('developers.') || u.hostname.startsWith('governance.') ? 3 : 0
  const shallow = segments.length <= 2 ? 1 : 0
  return structuralHits * 5 + docsSubdomain + shallow + penalty
}

export async function firecrawlFindAuthorityEvidence(
  website: string,
): Promise<AuthorityEvidencePage | null> {
  if (!firecrawlConfigured() || !website) return null
  const base = website.startsWith('http') ? website : `https://${website}`

  try {
    const mapRes = await fetch('https://api.firecrawl.dev/v2/map', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: base,
        search: 'security governance admin roles access control audit multisig upgrade timelock',
        limit: 50,
        sitemap: 'include',
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!mapRes.ok) return null
    const mapJson = await mapRes.json()
    const links = (mapJson?.links as Array<{ url: string; title?: string; description?: string }> | undefined) || []
    if (!links.length) return null

    const baseHost = new URL(base).hostname
    const best = links
      .map(l => ({ link: l, score: rankAuthorityLink(l, baseHost) }))
      .filter(s => s.score > -Infinity)
      .sort((a, b) => b.score - a.score)[0]?.link
    if (!best) return null

    const scrapeRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url: best.url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000,
      }),
      signal: AbortSignal.timeout(40000),
    })
    if (!scrapeRes.ok) return null
    const scrapeJson = await scrapeRes.json()
    const text = (scrapeJson?.data?.markdown as string | undefined) || ''
    if (!text) return null
    return { url: best.url, text: text.slice(0, 6000) }
  } catch (e) {
    console.error('[firecrawlFindAuthorityEvidence]', e)
    return null
  }
}
