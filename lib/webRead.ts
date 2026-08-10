// ============================================================
// Shared page reader — fetches any URL as clean text via Jina.ai
// (free, no key needed). Used wherever a route needs real page
// content as evidence rather than a search-snippet summary.
// ============================================================

export async function readUrl(url: string, cap = 10000): Promise<string> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`)
    const text = await res.text()
    return text.slice(0, cap)
  } catch (e) {
    console.error('[readUrl]', e)
    return ''
  }
}
