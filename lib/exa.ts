// ============================================================
// Exa.ai client — neural search for high-quality lead discovery.
//
// Why Exa over Tavily for BD:
//   - Semantic / neural search (understands "DeFi protocols with cross-chain
//     settlement problems" — not just keyword matching)
//   - findSimilar: point at one good lead → get 10 companies like it
//   - company category filter returns actual company homepages, not news articles
//   - Full page content retrieval included in one call
//
// All functions fail soft (return [] / '') so the agent keeps working with
// Tavily as fallback if the key is missing or Exa errors.
// ============================================================

const EXA_BASE = 'https://api.exa.ai'

export function exaConfigured(): boolean {
  return !!process.env.EXA_API_KEY
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.EXA_API_KEY || '',
  }
}

export interface ExaResult {
  id: string
  url: string
  title: string
  text?: string
  publishedDate?: string
}

// Neural search — returns semantically relevant results.
// `category: 'company'` restricts to company homepages (great for lead discovery).
export async function exaSearch(
  query: string,
  opts: { numResults?: number; category?: 'company' | 'news' | 'research paper' | 'tweet'; includeText?: boolean; startPublishedDate?: string } = {}
): Promise<ExaResult[]> {
  if (!exaConfigured()) return []
  try {
    const body: Record<string, unknown> = {
      query,
      numResults: opts.numResults ?? 15,
      type: 'neural',
    }
    if (opts.category) body.category = opts.category
    if (opts.includeText) body.contents = { text: { maxCharacters: 3000 } }
    if (opts.startPublishedDate) body.startPublishedDate = opts.startPublishedDate

    const res = await fetch(`${EXA_BASE}/search`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.results) ? data.results as ExaResult[] : []
  } catch { return [] }
}

// Find companies similar to a given URL — Exa's most powerful BD feature.
// Point at one good lead (e.g. "https://layerzero.network") and get more like it.
export async function exaFindSimilar(
  url: string,
  opts: { numResults?: number; category?: string; includeText?: boolean } = {}
): Promise<ExaResult[]> {
  if (!exaConfigured() || !url) return []
  try {
    const body: Record<string, unknown> = {
      url,
      numResults: opts.numResults ?? 15,
    }
    if (opts.category) body.category = opts.category
    if (opts.includeText) body.contents = { text: { maxCharacters: 2000 } }

    const res = await fetch(`${EXA_BASE}/findSimilar`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.results) ? data.results as ExaResult[] : []
  } catch { return [] }
}

// Search for real companies matching a BD query.
// Returns them in the same shape as extractCompanies() expects.
export async function exaSearchCompanies(
  query: string,
  numResults = 20
): Promise<Array<{ name: string; website: string; description: string; source_url: string }>> {
  const results = await exaSearch(query, { numResults, category: 'company', includeText: true })
  return results
    .filter(r => r.url && r.title)
    .map(r => ({
      name: r.title?.replace(/[\|\-–].*$/, '').trim() || '',
      website: r.url,
      description: (r.text || '').slice(0, 300).trim(),
      source_url: r.url,
    }))
    .filter(c => c.name && c.name.length > 1)
}

// Get full text content for a batch of Exa result IDs.
export async function exaGetContents(ids: string[]): Promise<ExaResult[]> {
  if (!exaConfigured() || !ids.length) return []
  try {
    const res = await fetch(`${EXA_BASE}/contents`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ ids, contents: { text: { maxCharacters: 5000 } } }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.results) ? data.results as ExaResult[] : []
  } catch { return [] }
}

// Search for recent news/events about a specific company (for trigger research).
export async function exaCompanyNews(companyName: string, daysBack = 60): Promise<string> {
  if (!exaConfigured()) return ''
  const since = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0]
  const results = await exaSearch(
    `${companyName} latest news funding partnership expansion`,
    { numResults: 6, category: 'news', includeText: true, startPublishedDate: since }
  )
  if (!results.length) return ''
  return results.map(r =>
    `[${r.publishedDate?.split('T')[0] || 'recent'}] ${r.title}\n${r.url}\n${(r.text || '').slice(0, 400)}`
  ).join('\n\n---\n\n')
}
