// Shared Hunter.io domain-search helper. Tries HUNTER_API_KEY first, then
// falls back to HUNTER_API_KEY_2 if the primary key errors out (e.g. account
// out of credits, 401/403/429). Centralized here so every call site gets the
// fallback instead of re-implementing it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HunterEmail = any

export function hunterKeys(): string[] {
  return [process.env.HUNTER_API_KEY, process.env.HUNTER_API_KEY_2].filter(Boolean) as string[]
}

export async function hunterDomainSearch(domain: string, limit = 10): Promise<HunterEmail[]> {
  const keys = hunterKeys()
  if (!keys.length || !domain) return []
  for (const key of keys) {
    try {
      const res = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${key}&limit=${limit}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) continue // credits exhausted / invalid key → try next key
      const data = await res.json()
      return data?.data?.emails || []
    } catch { /* try next key */ }
  }
  return []
}
