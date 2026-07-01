// ============================================================
// Exa.ai client — neural search for high-quality lead discovery.
// Uses the official exa-js SDK. All functions fail soft.
// Docs: https://docs.exa.ai/reference/search-api-guide-for-coding-agents
// ============================================================

import Exa from 'exa-js'

export function exaConfigured(): boolean {
  return !!process.env.EXA_API_KEY
}

function client() {
  return new Exa(process.env.EXA_API_KEY!)
}

export interface ExaResult {
  id: string
  url: string
  title: string
  text?: string
  highlights?: string[]
  publishedDate?: string
}

type BDCompany = { name: string; website: string; description: string; source_url: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCompanies(results: any[]): BDCompany[] {
  return results
    .filter(r => r.url && r.title)
    .map(r => ({
      name: (r.title as string)?.replace(/[\|\-–].*$/, '').trim() || '',
      website: r.url as string,
      description: (Array.isArray(r.highlights) ? r.highlights.join(' ') : r.text || '') as string,
      source_url: r.url as string,
    }))
    .filter(c => c.name.length > 1)
}

// Neural company search — finds real companies matching a BD query.
// Uses category: 'company' which returns company homepages (not articles).
export async function exaSearchCompanies(
  query: string,
  numResults = 20
): Promise<Array<{ name: string; website: string; description: string; source_url: string }>> {
  if (!exaConfigured()) return []
  try {
    const exa = client()
    const res = await exa.search(query, {
      type: 'auto',
      numResults,
      category: 'company',
      contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } as unknown as true },
    } as Parameters<typeof exa.search>[1])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toCompanies((res.results || []) as any[])
  } catch (e) {
    console.error('[exaSearchCompanies]', e)
    return []
  }
}

// Find companies similar to a given URL — Exa's most powerful BD feature.
// Point at one good lead → get more companies like it.
export async function exaFindSimilar(
  url: string,
  numResults = 20
): Promise<Array<{ name: string; website: string; description: string; source_url: string }>> {
  if (!exaConfigured() || !url) return []
  try {
    const exa = client()
    const res = await exa.findSimilar(url, {
      numResults,
      contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } as unknown as true },
    } as Parameters<typeof exa.findSimilar>[1])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toCompanies((res.results || []) as any[])
  } catch (e) {
    console.error('[exaFindSimilar]', e)
    return []
  }
}

// Fetch recent news about a specific company for trigger research.
// Uses category: 'news' (date filters work on news, not on company/people).
export async function exaCompanyNews(companyName: string, daysBack = 60): Promise<string> {
  if (!exaConfigured()) return ''
  try {
    const exa = client()
    const since = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0]
    const res = await exa.search(
      `${companyName} latest news funding partnership expansion announcement`,
      {
        type: 'auto',
        numResults: 6,
        category: 'news',
        startPublishedDate: since,
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 } as unknown as true },
      } as Parameters<typeof exa.search>[1]
    )
    if (!res.results?.length) return ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (res.results as any[]).map((r) => {
      const text = Array.isArray(r.highlights) ? r.highlights.join(' ') : (r.text || '')
      return `[${(r.publishedDate as string)?.split('T')[0] || 'recent'}] ${r.title}\n${r.url}\n${text.slice(0, 350)}`
    }).join('\n\n---\n\n')
  } catch (e) {
    console.error('[exaCompanyNews]', e)
    return ''
  }
}

// Search for BD decision-makers at a company (people search).
// Use for contact enrichment when Apollo doesn't have coverage.
export async function exaFindPeople(
  query: string,
  numResults = 5
): Promise<Array<{ name: string; url: string; highlights: string }>> {
  if (!exaConfigured()) return []
  try {
    const exa = client()
    const res = await exa.search(query, {
      type: 'auto',
      numResults,
      category: 'people',
      contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } as unknown as true },
    } as Parameters<typeof exa.search>[1])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (res.results || [] as any[]).map((r: any) => ({
      name: (r.title as string)?.split('|')[0].trim() || '',
      url: r.url as string,
      highlights: Array.isArray(r.highlights) ? (r.highlights as string[]).join(' ') : '',
    }))
  } catch (e) {
    console.error('[exaFindPeople]', e)
    return []
  }
}

// Search for recent news across multiple topic queries — used by Reaction Content Studio.
// Runs all queries in parallel (Promise.allSettled), dedupes by URL, returns structured items.
export async function exaNewsTopics(
  queries: Array<{ topic: string; query: string }>,
  daysBack = 7,
  perQuery = 5
): Promise<Array<{ topic: string; title: string; url: string; summary: string; publishedDate?: string }>> {
  if (!exaConfigured()) return []
  const since = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0]
  const exa = client()

  const results = await Promise.allSettled(
    queries.map(({ topic, query }) =>
      exa.search(query, {
        type: 'auto',
        numResults: perQuery,
        category: 'news',
        startPublishedDate: since,
        contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } as unknown as true },
      } as Parameters<typeof exa.search>[1]).then(res => ({ topic, results: res.results || [] }))
    )
  )

  const seen = new Set<string>()
  const items: Array<{ topic: string; title: string; url: string; summary: string; publishedDate?: string }> = []

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of r.value.results as any[]) {
      if (!item.url || !item.title || seen.has(item.url)) continue
      seen.add(item.url)
      const summary = Array.isArray(item.highlights)
        ? (item.highlights as string[]).join(' ')
        : (item.text || '').slice(0, 300)
      items.push({
        topic: r.value.topic,
        title: item.title as string,
        url: item.url as string,
        summary,
        publishedDate: item.publishedDate as string | undefined,
      })
    }
  }

  return items
}

// Get full page content for known URLs (enrichment, not search).
// On /contents, highlights/text are top-level (not nested in contents).
export async function exaGetContents(urls: string[]): Promise<ExaResult[]> {
  if (!exaConfigured() || !urls.length) return []
  try {
    const exa = client()
    const res = await exa.getContents(urls, {
      text: { maxCharacters: 5000 },
    } as Parameters<typeof exa.getContents>[1])
    return (res.results || []) as ExaResult[]
  } catch (e) {
    console.error('[exaGetContents]', e)
    return []
  }
}
