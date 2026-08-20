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
